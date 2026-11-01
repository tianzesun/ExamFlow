"""UTORid sign-in: Entra access tokens are checked and mapped to ExamFlow roles."""

import time
import uuid
from unittest import mock

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa

from app.auth import entra
from app.config import get_settings
from tests.test_seat_map import client

TENANT = str(uuid.uuid4())
CLIENT = str(uuid.uuid4())
KEY = rsa.generate_private_key(public_exponent=65537, key_size=3072)
OTHER_KEY = rsa.generate_private_key(public_exponent=65537, key_size=3072)


@pytest.fixture(autouse=True)
def entra_configured():
    settings = get_settings()
    with (
        mock.patch.object(settings, "ENTRA_TENANT_ID", TENANT),
        mock.patch.object(settings, "ENTRA_CLIENT_ID", CLIENT),
        mock.patch.object(entra, "_signing_key", lambda token, tenant: KEY.public_key()),
    ):
        yield


def _token(key=KEY, **overrides) -> str:
    now = int(time.time())
    claims = {
        "iss": f"https://login.microsoftonline.com/{TENANT}/v2.0",
        "aud": CLIENT,
        "tid": TENANT,
        "oid": str(uuid.uuid4()),
        "iat": now,
        "nbf": now,
        "exp": now + 3600,
        "scp": "access_as_user",
        "roles": ["ExamFlow.Staff"],
        "name": "Test Person",
        "preferred_username": "test.person@example.invalid",
        **overrides,
    }
    return jwt.encode({k: v for k, v in claims.items() if v is not None}, key, algorithm="RS256")


def _me(token: str):
    return client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})


def test_signed_in_user_gets_their_entra_role():
    r = _me(_token())
    assert r.status_code == 200, r.text
    assert r.json()["role"] == "STAFF" and r.json()["display_name"] == "Test Person"


def test_strongest_role_wins_and_role_changes_follow_entra():
    oid = str(uuid.uuid4())
    assert _me(_token(oid=oid, roles=["ExamFlow.Instructor", "ExamFlow.Admin"])).json()["role"] == "ADMIN"
    assert _me(_token(oid=oid, roles=["ExamFlow.Instructor"])).json()["role"] == "INSTRUCTOR"


def test_university_account_without_an_examflow_role_is_refused():
    r = _me(_token(roles=None))
    assert r.status_code == 403 and "access to ExamFlow" in r.json()["detail"]


@pytest.mark.parametrize("overrides", [
    {"aud": str(uuid.uuid4())},                                            # meant for another app
    {"tid": str(uuid.uuid4())},                                            # another tenant
    {"iss": "https://login.microsoftonline.com/common/v2.0"},              # wrong issuer
    {"exp": int(time.time()) - 600},                                       # expired
    {"scp": "User.Read"},                                                  # not issued for this API
    {"oid": None},                                                         # no stable user id
])
def test_tokens_not_issued_for_examflow_are_rejected(overrides):
    assert _me(_token(**overrides)).status_code == 401


def test_token_signed_with_another_key_is_rejected():
    assert _me(_token(key=OTHER_KEY)).status_code == 401


def test_unsigned_token_is_rejected():
    claims = jwt.decode(_token(), options={"verify_signature": False})
    assert _me(jwt.encode(claims, key=None, algorithm="none")).status_code == 401


def test_sign_in_page_config_names_the_api_scope():
    config = client.get("/api/auth/config").json()
    assert config["entra"] == {"tenant_id": TENANT, "client_id": CLIENT, "scopes": [f"api://{CLIENT}/access_as_user"]}
