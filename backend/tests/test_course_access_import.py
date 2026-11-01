"""Adding instructors and TAs to many courses from one CSV."""

import uuid

from tests.test_seat_map import ADMIN_HEADERS, INSTRUCTOR_HEADERS, client


def _course(code: str) -> dict:
    r = client.post("/api/courses", json={"course_code": code, "course_name": "Import test"}, headers=ADMIN_HEADERS)
    assert r.status_code == 201, r.text
    return r.json()


def _import(csv_text: str, confirm: bool, headers=ADMIN_HEADERS):
    return client.post(
        "/api/courses/access/import", params={"confirm": confirm},
        files={"file": ("people.csv", csv_text, "text/csv")}, headers=headers,
    )


def test_preview_then_confirm():
    tag = uuid.uuid4().hex[:5].upper()
    a, b = _course(f"IMP{tag} 101"), _course(f"IMP{tag}201")
    csv_text = (
        "Course Code,Email\n"
        f"imp{tag}101,instructor@example.local\n"         # spaces and case don't matter
        f"IMP{tag}201,ta.one@example.invalid\n"
        f"IMP{tag}201,TA.One@example.invalid\n"           # same person twice
        f"NOPE{tag},someone@example.invalid\n"            # unknown course
        f"IMP{tag}201,not-an-address\n"
    )
    preview = _import(csv_text, confirm=False).json()
    assert (preview["added"], preview["already"], len(preview["errors"])) == (2, 1, 2)
    assert "no course" in preview["errors"][0] and "isn't an email" in preview["errors"][1]
    # A preview saves nothing.
    assert client.get(f"/api/courses/{a['id']}", headers=INSTRUCTOR_HEADERS).status_code == 404

    done = _import(csv_text, confirm=True).json()
    assert done["added"] == 2
    assert client.get(f"/api/courses/{a['id']}", headers=INSTRUCTOR_HEADERS).status_code == 200
    people = client.get(f"/api/courses/{b['id']}/people", headers=ADMIN_HEADERS).json()["people"]
    assert [p["email"] for p in people] == ["ta.one@example.invalid"]
    # Running it again adds nobody twice.
    assert _import(csv_text, confirm=True).json()["already"] == 3


def test_needs_the_right_columns_and_the_exam_office():
    assert _import("course,name\nX,Y\n", confirm=False).status_code == 400
    assert _import("course_code,email\n", confirm=False, headers=INSTRUCTOR_HEADERS).status_code == 403
