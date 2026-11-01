"""UTORid sign-in through Microsoft Entra ID.

The browser signs in with MSAL and calls the API with an Entra access token. This module
checks that token (signature, issuer, tenant, audience, scope, expiry) and maps the user's
Entra app role to an ExamFlow role. Entra owns the session: sign-in length, MFA and
sign-out all stay with the university's identity provider.
"""

import logging
from functools import lru_cache

import jwt
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.audit_log import AuditLog
from app.models.user import User

logger = logging.getLogger(__name__)

# Most privileged first: a user with several app roles gets the strongest one.
ROLE_ORDER = ("ADMIN", "STAFF", "INSTRUCTOR", "TA")
# Allowed clock difference between Entra and this server.
LEEWAY_SECONDS = 60


class NoExamFlowRoleError(Exception):
    """A valid university sign-in without an ExamFlow app role assigned."""

    def __init__(self, email: str | None = None):
        super().__init__(email)
        # Who was refused, so the sign-in record can say whom to give a role.
        self.email = email


def looks_like_jwt(token: str) -> bool:
    return token.count(".") == 2


@lru_cache
def _jwks_client(tenant_id: str) -> jwt.PyJWKClient:
    # Keys are cached and refetched when Entra rotates them (an unknown "kid").
    return jwt.PyJWKClient(
        f"https://login.microsoftonline.com/{tenant_id}/discovery/v2.0/keys", cache_keys=True, lifespan=3600
    )


def _signing_key(token: str, tenant_id: str):
    return _jwks_client(tenant_id).get_signing_key_from_jwt(token).key


def decode_token(token: str) -> dict:
    """The token's claims if Entra issued it for this API; raises jwt.InvalidTokenError otherwise."""
    settings = get_settings()
    tenant, client = settings.ENTRA_TENANT_ID.strip(), settings.ENTRA_CLIENT_ID.strip()
    claims = jwt.decode(
        token,
        _signing_key(token, tenant),
        algorithms=["RS256"],
        audience=[client, f"api://{client}"],
        # v2 tokens (accessTokenAcceptedVersion: 2) and v1 tokens name the issuer differently.
        issuer=[f"https://login.microsoftonline.com/{tenant}/v2.0", f"https://sts.windows.net/{tenant}/"],
        leeway=LEEWAY_SECONDS,
        options={"require": ["exp", "iat", "iss", "aud", "tid", "oid"]},
    )
    if claims["tid"] != tenant:
        raise jwt.InvalidTokenError("Token is from another tenant")
    if settings.ENTRA_API_SCOPE not in str(claims.get("scp", "")).split():
        raise jwt.InvalidTokenError("Token lacks the ExamFlow API scope")
    return claims


def role_from_claims(claims: dict) -> str | None:
    mapping = get_settings().entra_role_map
    roles = {mapping[r] for r in claims.get("roles", []) if r in mapping}
    return next((r for r in ROLE_ORDER if r in roles), None)


def verify_entra_token(token: str, db: Session) -> User | None:
    """The signed-in user, provisioned or updated from the token.

    Returns None for a token that isn't valid; raises NoExamFlowRoleError for a valid university
    sign-in that hasn't been given access to ExamFlow.
    """
    if not get_settings().entra_enabled or not looks_like_jwt(token):
        return None
    try:
        claims = decode_token(token)
    except jwt.PyJWKClientError:
        logger.exception("Entra signing keys could not be loaded")
        return None
    except jwt.InvalidTokenError as e:
        logger.info("Rejected Entra token: %s", e)
        return None

    email = claims.get("preferred_username") or claims.get("email") or claims.get("upn")
    role = role_from_claims(claims)
    if not role:
        raise NoExamFlowRoleError(email)

    external_id = f"entra:{claims['oid']}"
    name = claims.get("name") or email or "University user"
    user = db.query(User).filter(User.external_id == external_id).first()
    if not user:
        try:
            user = User(external_id=external_id, email=email, display_name=name, role=role, is_active=True)
            db.add(user)
            db.flush()
            db.add(AuditLog(user_id=user.id, action="USER_PROVISIONED", entity_type="user", entity_id=user.id,
                            new_values={"role": role, "source": "entra"}))
            db.commit()
            return user
        except IntegrityError:
            # The browser's first requests arrive together; another one created the record first.
            db.rollback()
            user = db.query(User).filter(User.external_id == external_id).one()

    changed = {}
    if user.role != role:
        changed["role"] = user.role
        user.role = role
    if (user.email, user.display_name) != (email, name):
        user.email, user.display_name = email, name
        changed.setdefault("profile", "updated")
    if changed:
        if "role" in changed:
            db.add(AuditLog(user_id=user.id, action="USER_ROLE_CHANGED", entity_type="user", entity_id=user.id,
                            old_values={"role": changed["role"]}, new_values={"role": role, "source": "entra"}))
        db.commit()
    return user
