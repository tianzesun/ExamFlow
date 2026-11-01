"""Admin › Settings: what an administrator changes, and where it takes effect."""

from unittest import mock

import pymupdf

from app.database import SessionLocal
from app.models.course import Course
from app.services import ttb_service
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
    assert set(data["deployment"]) == {"environment", "utorid_sign_in", "test_accounts", "rate_limits",
                                       "public_app_url", "storage"}


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
    rules = {"order": "random", "spacing": "every_other_seat", "versions": 2}
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
