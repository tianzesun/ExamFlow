# Request: Microsoft Entra ID app registration for ExamFlow

*Draft to send to the University of Toronto's Microsoft Entra ID administrators. Fill in the
bracketed parts before sending. Technical background: [SSO-INTEGRATION.md](../../SSO-INTEGRATION.md).*

---

**Subject:** App registration for ExamFlow (exam seating and personalized exam papers): UTORid sign-in

Hello,

[Department] runs ExamFlow, a web application the exam office uses to seat students for exams
and print each student's exam paper with their room and seat. We'd like staff to sign in with
their UTORid through the university's Entra ID tenant. Could you create, or approve, the
following app registration?

**Application**
- Name: ExamFlow
- Supported account types: this organization only (single tenant)
- Platform: **Single-page application** (authorization code flow with PKCE)
- Redirect URIs: `https://[examflow host]/login`; for testing: `https://[pilot host]/login`
- Front-channel logout URL: `https://[examflow host]/login`
- Implicit grant: off. **No client secret or certificate is needed**; please don't create one.

**Expose an API**
- Application ID URI: `api://<application (client) id>`
- One delegated scope: `access_as_user` ("Access ExamFlow as the signed-in user"),
  consent by admins and users
- Under API permissions, add *My APIs › ExamFlow › access_as_user* and grant admin consent
- Manifest: `"requestedAccessTokenVersion": 2`

**App roles** (allowed member types: users/groups)

| Value | Who it's for |
|-------|--------------|
| `ExamFlow.Admin` | ExamFlow administrators ([names or group]) |
| `ExamFlow.Staff` | Exam office staff ([group]) |
| `ExamFlow.Instructor` | Instructors who should see their own courses' seating ([group, if any]) |
| `ExamFlow.TA` | Teaching assistants checking students in on exam day ([group, if any]) |

**Enterprise application**
- Assignment required: **Yes**. Only people given one of the roles above can sign in.
- Initial assignments: [list of people or groups for each role]

**What ExamFlow does with sign-ins**
- It checks each access token's signature (using Microsoft's published keys), tenant, audience,
  scope and expiry on every request, and reads the user's `oid`, name, `preferred_username` and
  app roles. It requests no Microsoft Graph permissions.
- ExamFlow keeps no session of its own. Sign-in length, MFA and Conditional Access are set by
  the tenant, and tokens are held only for the browser tab.
- The data in ExamFlow includes student names, student numbers, UTORids, emails, seating and
  exam accommodations. [An Information Risk Assessment is under way / has been completed: reference.]

**What we need back:** the **Directory (tenant) ID** and the **Application (client) ID**.
These are identifiers, not secrets.

Thank you,
[Name, role, contact]
