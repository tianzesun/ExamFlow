"""Admin › Settings: what an administrator changes, and where it takes effect."""

import uuid
from types import SimpleNamespace
from unittest import mock

import pymupdf

from app.auth import entra
from app.config import get_settings
from app.database import SessionLocal
from app.models.course import Course
from app.services import pdf_service, settings_service, ttb_service
from tests import test_entra
from tests.test_exam_day import _ready_exam_with_papers
from tests.test_seat_map import ADMIN_HEADERS, INSTRUCTOR_HEADERS, _create_exam_with_students, client

STAFF_HEADERS = {"Authorization": "Bearer dev-staff-token"}


def _settings() -> dict:
    r = client.get("/api/admin/settings", headers=ADMIN_HEADERS)
    assert r.status_code == 200, r.text
    return r.json()


def _save(**changes):
    return client.put("/api/admin/settings", json={**_settings()["settings"], **changes}, headers=ADMIN_HEADERS)


def test_only_admins_see_or_change_settings():
    for headers in (STAFF_HEADERS, INSTRUCTOR_HEADERS):
        assert client.get("/api/admin/settings", headers=headers).status_code == 403
        assert client.put("/api/admin/settings", json={}, headers=headers).status_code == 403


def test_defaults_and_deployment_info():
    data = _settings()
    assert data["settings"]["ttb_subjects"] and data["settings"]["max_upload_mb"] >= 1
    # The deployment is shown, not editable, and holds nothing secret.
    assert set(data["deployment"]) == {"environment", "test_accounts", "rate_limits", "public_app_url",
                                       "storage"}


def test_saving_tidies_values_and_records_only_what_changed():
    r = _save(department_name="  Mathematical   and Computational Sciences ", ttb_division="artsc",
              ttb_subjects=["csc", "MAT", "CSC"])
    assert r.status_code == 200, r.text
    saved = r.json()["settings"]
    assert saved["department_name"] == "Mathematical and Computational Sciences"
    assert (saved["ttb_division"], saved["ttb_subjects"]) == ("ARTSC", ["CSC", "MAT"])

    log = client.get("/api/admin/activity", params={"category": "system"}, headers=ADMIN_HEADERS).json()["entries"]
    assert log[0]["action"] == "SYSTEM_SETTINGS_UPDATED"
    assert set(log[0]["new_values"]) == {"department_name", "ttb_subjects"}  # the division was already ARTSC


def test_invalid_values_are_refused():
    for bad in ({"ttb_division": "ARTS&SCI"}, {"ttb_subjects": ["C5C"]}, {"ttb_subjects": []},
                {"max_upload_mb": 0}, {"department_name": "   "}, {"default_seating": {"versions": 5}}):
        assert _save(**bad).status_code == 422, bad


def test_sync_uses_the_division_subjects_and_department():
    assert _save(ttb_division="APSC", ttb_subjects=["ECE", "MIE"], department_name="Engineering").status_code == 200
    code = "ECE9Z9H1"
    fetch = mock.AsyncMock(return_value=[{"code": code, "name": "Settings test", "sections": []}])
    with mock.patch.object(ttb_service, "fetch_all_cs_courses", fetch):
        assert client.post("/api/ttb/sync", params={"semester": "20269"}, headers=ADMIN_HEADERS).status_code == 200
    assert fetch.call_args.kwargs == {"session_code": "20269", "division_code": "APSC", "subjects": ("ECE", "MIE")}
    with SessionLocal() as db:
        assert db.query(Course).filter_by(course_code=code).one().department == "Engineering"


def test_courses_are_kept_to_the_chosen_prefixes():
    xml = "<TTBResponse>" + "".join(
        f"<payload><code>{c}</code><name>x</name><sections/></payload>" for c in ("CSC108H1", "MAT137Y1", "STA130H1")
    ) + "</TTBResponse>"
    codes = {c["code"] for c in ttb_service.parse_courses_response(xml, ("CSC", "MAT"))}
    assert codes == {"CSC108H1", "MAT137Y1"}


def test_new_exams_start_with_the_default_seating_rules():
    rules = {"order": "random", "spacing": "every_other_seat", "versions": 2, "fill": "evenly",
             "front_row_empty": True}
    assert _save(default_seating=rules).status_code == 200
    exam_id, _, _ = _create_exam_with_students(4, 20)
    got = client.get(f"/api/exams/{exam_id}/assignments/rules", headers=ADMIN_HEADERS).json()
    assert {k: got[k] for k in rules} == rules


def test_upload_limit_follows_the_setting():
    exam_id, _, _ = _create_exam_with_students(1, 5)
    doc = pymupdf.open()
    page = doc.new_page()
    # Incompressible content, so the file really is over a megabyte.
    page.insert_image(page.rect, stream=pymupdf.Pixmap(pymupdf.csRGB, pymupdf.IRect(0, 0, 700, 700), 0).tobytes())
    pdf = doc.tobytes(deflate=False)
    assert _save(max_upload_mb=1).status_code == 200
    r = client.post(f"/api/exams/{exam_id}/templates", files={"file": ("big.pdf", pdf, "application/pdf")},
                    headers=ADMIN_HEADERS)
    assert len(pdf) > 1024 * 1024 and r.status_code == 400 and "max 1MB" in r.json()["detail"]


# ── UTORid sign-in set in the app ───────────────────────────

def _registration(**changes) -> dict:
    return {
        "tenant_id": str(uuid.uuid4()), "client_id": str(uuid.uuid4()), "api_scope": "access_as_user",
        "role_values": {"ADMIN": "Exams.Admin", "STAFF": "Exams.Office", "INSTRUCTOR": "Exams.Instructor",
                        "TA": "Exams.TA"},
        **changes,
    }


def _save_sign_in(body: dict, tenant_known: bool | None = True):
    with mock.patch.object(settings_service, "_tenant_exists", return_value=tenant_known):
        return client.put("/api/admin/settings/sign-in", json=body, headers=ADMIN_HEADERS)


def test_utorid_sign_in_set_in_the_app_is_used():
    body = _registration()
    r = _save_sign_in(body)
    assert r.status_code == 200, r.text
    assert r.json()["source"] == "settings" and r.json()["enabled"] is True

    # The sign-in page now offers it, and tokens for that registration sign in with the mapped role.
    config = client.get("/api/auth/config").json()["entra"]
    assert config["tenant_id"] == body["tenant_id"] and config["client_id"] == body["client_id"]
    token = test_entra._token(iss=f"https://login.microsoftonline.com/{body['tenant_id']}/v2.0",
                              aud=body["client_id"], tid=body["tenant_id"], roles=["Exams.Office"])
    with mock.patch.object(entra, "_signing_key", lambda token, tenant: test_entra.KEY.public_key()):
        me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200 and me.json()["role"] == "STAFF"

    log = client.get("/api/admin/activity", params={"category": "system"}, headers=ADMIN_HEADERS).json()["entries"]
    assert log[0]["action"] == "SYSTEM_SIGN_IN_SETTINGS_UPDATED"


def test_sign_in_settings_are_checked():
    assert _save_sign_in(_registration(client_id="")).status_code == 422             # one without the other
    assert _save_sign_in(_registration(tenant_id="uoft")).status_code == 422         # not an ID
    roles = {"ADMIN": "Same", "STAFF": "Same", "INSTRUCTOR": "I", "TA": "T"}
    assert _save_sign_in(_registration(role_values=roles)).status_code == 422        # roles must differ
    r = _save_sign_in(_registration(), tenant_known=False)
    assert r.status_code == 400 and "tenant" in r.json()["detail"]
    # Microsoft unreachable: saved anyway, as the IDs are well formed.
    assert _save_sign_in(_registration(), tenant_known=None).status_code == 200


def test_the_environment_wins_and_locks_the_page():
    s = get_settings()
    tenant, client_id = str(uuid.uuid4()), str(uuid.uuid4())
    with mock.patch.object(s, "ENTRA_TENANT_ID", tenant), mock.patch.object(s, "ENTRA_CLIENT_ID", client_id):
        got = client.get("/api/admin/settings/sign-in", headers=ADMIN_HEADERS).json()
        assert got["source"] == "environment" and got["sign_in"]["tenant_id"] == tenant
        r = _save_sign_in(_registration())
        assert r.status_code == 400 and "environment" in r.json()["detail"]


def test_sign_in_cannot_be_switched_off_without_test_accounts():
    assert _save_sign_in(_registration()).status_code == 200
    off = _registration(tenant_id="", client_id="")
    # As in production: no test accounts (only the check sees this, so the admin here can still call).
    production = mock.Mock(dev_auth_enabled=False, entra_enabled=False)
    with mock.patch.object(settings_service, "get_settings", return_value=production):
        r = _save_sign_in(off)
    assert r.status_code == 400 and "nobody" in r.json()["detail"]
    assert _save_sign_in(off).status_code == 200  # test accounts still work here
    assert client.get("/api/auth/config").json()["entra"] is None


# ── What's printed on papers and exam-day documents ─────────

def _stamped(stamp: settings_service.PaperStamp, pages: int = 2) -> pymupdf.Document:
    doc = pymupdf.open()
    for i in range(pages):
        doc.new_page().insert_text((72, 300), f"Question {i + 1}", fontsize=14)
    student = SimpleNamespace(full_name="Visible Name", student_number="1000000042", utorid="visiblen")
    exam = SimpleNamespace(course_code="TEST101", exam_name="Final")
    return pymupdf.open(stream=pdf_service.generate_one_student_pdf(
        doc.tobytes(), exam, student, SimpleNamespace(building="IC", room_number="130"),
        SimpleNamespace(seat_code="C07"), "token", None, stamp,
    ))


def test_anonymous_papers_carry_the_number_not_the_name():
    doc = _stamped(settings_service.PaperStamp(show_name=False, show_utorid=True))
    text = doc[0].get_text() + doc[1].get_text()
    assert "Visible Name" not in text
    assert "1000000042" in doc[0].get_text() and "visiblen" in doc[0].get_text() and "C07" in doc[0].get_text()
    assert "1000000042" in doc[1].get_text() and "visiblen" in doc[1].get_text()


def test_later_pages_can_go_unstamped():
    doc = _stamped(settings_service.PaperStamp(every_page=False))
    assert "Visible Name" in doc[0].get_text()
    assert doc[1].get_text().strip() == "Question 2"


def test_changing_the_stamp_makes_papers_out_of_date():
    exam_id, _ = _ready_exam_with_papers(student_count=2)
    status = lambda: client.get(f"/api/exams/{exam_id}/generated/status", headers=ADMIN_HEADERS).json()  # noqa: E731
    assert status()["up_to_date"] == 2
    assert _save(paper_stamp={"show_name": False, "show_utorid": False, "every_page": True}).status_code == 200
    assert status()["outdated"] == 2
    # Back to what the papers show: up to date again, nothing to reprint.
    assert _save(paper_stamp={"show_name": True, "show_utorid": False, "every_page": True}).status_code == 200
    assert status()["up_to_date"] == 2


def test_document_heading_on_exam_day_documents():
    assert _save(document_heading="  University of Toronto ·  Computer Science ").status_code == 200
    exam_id, _ = _ready_exam_with_papers(student_count=2)
    pdf = client.get(f"/api/exams/{exam_id}/seating-list", headers=ADMIN_HEADERS).content
    assert "University of Toronto · Computer Science" in pymupdf.open(stream=pdf)[0].get_text()


def test_new_exam_form_defaults():
    assert _save(default_duration_minutes=180, default_start_time="14:00").status_code == 200
    r = client.get("/api/exams/defaults", headers=STAFF_HEADERS)
    assert r.json() == {"duration_minutes": 180, "start_time": "14:00"}
    assert client.get("/api/exams/defaults", headers=INSTRUCTOR_HEADERS).status_code == 403
    assert _save(default_start_time="25:00").status_code == 422
    assert _save(default_duration_minutes=5).status_code == 422
