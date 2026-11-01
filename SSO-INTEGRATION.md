# UTORid Sign-in (Microsoft Entra ID)

ExamFlow signs staff in with their UTORid through the University of Toronto's Microsoft Entra ID.
Test accounts (`dev-admin-token` and so on) remain for development and pilot servers only.

## How it works

```
Sign-in page ── "Sign in with UTORid" ──▶ Microsoft (UofT sign-in, MFA)
      ▲                                          │
      └──────── back to /login with a code ◀─────┘
Browser (MSAL) exchanges the code for an access token (PKCE, no client secret)
Every API call: Authorization: Bearer <Entra access token>
API checks the token and maps the user's Entra app role to an ExamFlow role
```

- **No ExamFlow session.** Entra owns the session: how long sign-in lasts, MFA, Conditional
  Access and sign-out are all set by the university's identity team. The browser library
  (MSAL) keeps tokens in `sessionStorage`, so they end when the tab closes, and renews them
  quietly while the Microsoft session lasts.
- **No client secret.** The frontend is a single-page app using the authorization code flow
  with PKCE. The API only verifies tokens, using Microsoft's published signing keys.
- **Sign-out** ends the ExamFlow tokens and the Microsoft session for ExamFlow, then returns to
  the sign-in page.

Code: `backend/app/auth/entra.py` (token checks, role mapping, user records) and
`frontend/src/lib/auth/entra.ts` (MSAL). Nothing else in the app knows about Entra.

## What the API checks on every request

| Check | Value |
|-------|-------|
| Signature | RS256, key from `https://login.microsoftonline.com/<tenant>/discovery/v2.0/keys` |
| Issuer | `https://login.microsoftonline.com/<tenant>/v2.0` (or the v1 `sts.windows.net` form) |
| Tenant (`tid`) | `ENTRA_TENANT_ID` |
| Audience (`aud`) | `ENTRA_CLIENT_ID` or `api://<ENTRA_CLIENT_ID>` |
| Scope (`scp`) | contains `ENTRA_API_SCOPE` (default `access_as_user`) |
| Expiry | `exp` and `iat` required; 60 seconds' clock leeway |
| User | `oid` required; becomes `users.external_id` as `entra:<oid>` |

A token that fails any check gets **401**. A valid university sign-in with no ExamFlow role gets
**403** ("Your UTORid doesn't have access to ExamFlow yet…"); the sign-in page shows that message.

## Roles

Access is granted only by assigning an **Entra app role**; there is no default role, because
every ExamFlow role can see student rosters. The role is read from the token on every request,
so a change in Entra applies at the user's next token (within about an hour), and removing the
role removes access.

| Entra app role value | ExamFlow role |
|----------------------|---------------|
| `ExamFlow.Admin` | ADMIN |
| `ExamFlow.Staff` | STAFF |
| `ExamFlow.Instructor` | INSTRUCTOR |
| `ExamFlow.TA` | TA |

A user with several roles gets the strongest. To use other role names, set
`ENTRA_ROLE_MAP`, e.g. `Registrar.Admin=ADMIN,Exams.Coordinator=STAFF`.

The first sign-in creates the user record (`USER_PROVISIONED` in the audit log); a role change
from Entra is recorded as `USER_ROLE_CHANGED`. User records are never deleted.

## Setting up the app registration

Ask the university's Microsoft Entra ID administrators to create the registration, or to approve
one, in the UofT tenant.

1. **App registration** → New registration, e.g. "ExamFlow". Single tenant.
2. **Authentication** → Add a platform → **Single-page application**. Redirect URIs:
   `https://<examflow host>/login` (and `http://localhost:3000/login` for development).
   Front-channel logout URL: `https://<examflow host>/login`. Leave implicit grant off.
3. **Expose an API** → Application ID URI `api://<client id>` → Add a scope
   `access_as_user` (Admins and users; "Access ExamFlow as the signed-in user").
4. **API permissions** → add *My APIs → ExamFlow → access_as_user* and grant admin consent.
5. **Manifest** → set `"requestedAccessTokenVersion": 2` (shown as `accessTokenAcceptedVersion`
   in older portals).
6. **App roles** → create the four roles above (allowed member types: Users/Groups).
7. **Enterprise applications → ExamFlow → Properties** → *Assignment required: Yes*, then under
   *Users and groups* assign people or groups to roles. With assignment required, people
   without a role can't even start a sign-in to ExamFlow.

No client secret or certificate is needed. Don't create one.

## Server settings

Set these in the backend's environment (they are identifiers, not secrets):

```bash
ENTRA_TENANT_ID=<UofT directory (tenant) ID>
ENTRA_CLIENT_ID=<ExamFlow application (client) ID>
# Optional
ENTRA_API_SCOPE=access_as_user
ENTRA_ROLE_MAP=ExamFlow.Admin=ADMIN,ExamFlow.Staff=STAFF,ExamFlow.Instructor=INSTRUCTOR,ExamFlow.TA=TA

# Production
APP_ENV=production
AUTH_DEV_MODE=false
```

The frontend reads them from `GET /api/auth/config`, so it needs no extra build settings. Its
Content-Security-Policy already allows `https://login.microsoftonline.com`.

The old `OIDC_*` settings are no longer used and can be removed.

## Checking it works

1. Open `/login`: a **Sign in with UTORid** button appears once both settings are present.
2. Sign in with a UTORid that has a role: you land in ExamFlow; the sidebar shows your role.
3. Sign in with a UTORid without a role (if assignment isn't required): the sign-in page says
   you don't have access yet.
4. Sign out: you return to the sign-in page, and the next sign-in asks which account to use.
