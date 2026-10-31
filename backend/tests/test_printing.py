"""Printed output: stamped papers, the print file, seating lists and room maps."""

import csv
import io
from types import SimpleNamespace

import pymupdf

from app.services import admin_service, pdf_service
from tests.test_exam_day import _ready_exam_with_papers
from tests.test_seat_map import ADMIN_HEADERS, INSTRUCTOR_HEADERS, _create_exam_with_students, client

EXAM = SimpleNamespace(course_code="TEST101", exam_name="Final")
ROOM = SimpleNamespace(building="IC", room_number="130")
SEAT = SimpleNamespace(seat_code="C07")


def _template(pages: int, content_y: float) -> bytes:
    doc = pymupdf.open()
    for i in range(pages):
        doc.new_page().insert_text((72, content_y), f"Question {i + 1}", fontsize=14)
    return doc.tobytes()


def _stamp(template: bytes, name: str = "Test Student") -> pymupdf.Document:
    student = SimpleNamespace(full_name=name, student_number="1000000001")
    return pymupdf.open(stream=pdf_service.generate_one_student_pdf(template, EXAM, student, ROOM, SEAT, "token"))


def _top_of(page: pymupdf.Page, text: str) -> float:
    return page.search_for(text)[0].y0


def test_stamp_never_covers_content_at_top_of_page():
    doc = _stamp(_template(pages=2, content_y=30))
    first = doc[0]
    assert "Test Student" in first.get_text() and "C07" in first.get_text() and "IC 130" in first.get_text()
    assert _top_of(first, "Question 1") >= pdf_service.FIRST_BAND
    assert _top_of(doc[1], "Question 2") >= pdf_service.OTHER_BAND
    assert "Page 2 of 2" in doc[1].get_text() and "Seat C07" in doc[1].get_text()


def test_stamp_keeps_layout_when_top_margin_is_free():
    template = _template(pages=1, content_y=200)
    original = _top_of(pymupdf.open(stream=template)[0], "Question 1")
    assert _top_of(_stamp(template)[0], "Question 1") == original


def test_stamp_prints_names_in_any_script():
    name = "Ngọc Trần-Ålesund 李华"
    assert name in _stamp(_template(pages=1, content_y=200), name)[0].get_text()


def _print_file(exam_id: str, **params) -> pymupdf.Document:
    r = client.get(f"/api/exams/{exam_id}/generated/print", params=params, headers=ADMIN_HEADERS)
    assert r.status_code == 200, r.text
    return pymupdf.open(stream=r.content)


def test_print_file_is_in_seat_order_with_room_divider():
    exam_id, room_id = _ready_exam_with_papers(student_count=3)
    doc = _print_file(exam_id)
    assert len(doc) == 1 + 3  # divider, then one page per paper
    assert "3 papers" in doc[0].get_text()

    seat_map = client.get(f"/api/exams/{exam_id}/assignments/seat-map", headers=ADMIN_HEADERS).json()
    seats = sorted(
        (s for room in seat_map["rooms"] for s in room["seats"] if s["occupant"]),
        key=lambda s: (s["row_number"], s["column_number"]),
    )
    for page, seat in zip(doc[1:], seats):
        assert seat["occupant"]["student_number"] in page.get_text()

    assert len(_print_file(exam_id, room_id=room_id)) == 4


def test_print_file_double_sided_starts_each_paper_on_a_new_sheet():
    exam_id, _ = _ready_exam_with_papers(student_count=3)
    doc = _print_file(exam_id, double_sided="true")
    assert len(doc) == 2 + 3 * 2
    assert all(not doc[i].get_text().strip() for i in (1, 3, 5, 7))


def test_print_file_needs_staff_and_papers():
    exam_id, _ = _ready_exam_with_papers(student_count=1)
    r = client.get(f"/api/exams/{exam_id}/generated/print", headers=INSTRUCTOR_HEADERS)
    assert r.status_code == 403

    bare_exam, _, _ = _create_exam_with_students(student_count=1, capacity=5)
    assert client.get(f"/api/exams/{bare_exam}/generated/print", headers=ADMIN_HEADERS).status_code == 400


def test_seating_list_pdf_and_csv():
    exam_id, _ = _ready_exam_with_papers(student_count=3)
    r = client.get(f"/api/exams/{exam_id}/seating-list", headers=ADMIN_HEADERS)
    assert r.status_code == 200 and r.content.startswith(b"%PDF")
    text = pymupdf.open(stream=r.content)[0].get_text()
    assert "Seating list" in text and "3 students" in text

    r = client.get(f"/api/exams/{exam_id}/seating-list", params={"format": "csv"}, headers=ADMIN_HEADERS)
    assert r.status_code == 200 and r.headers["content-type"].startswith("text/csv")
    rows = list(csv.reader(io.StringIO(r.content.decode("utf-8-sig"))))
    assert rows[0] == ["Name", "Student number", "UTORid", "Room", "Seat"]
    assert len(rows) == 4
    names = [row[0] for row in rows[1:]]
    assert names == sorted(names, key=str.casefold)
    assert all(row[1] in text for row in rows[1:])


def test_seating_list_without_seats_is_rejected():
    exam_id, _, _ = _create_exam_with_students(student_count=2, capacity=5)
    assert client.get(f"/api/exams/{exam_id}/seating-list", headers=ADMIN_HEADERS).status_code == 400


def test_csv_cells_cannot_become_formulas():
    assert admin_service._csv_cell("=HYPERLINK(1)") == "'=HYPERLINK(1)"
    assert admin_service._csv_cell("-1") == "'-1"
    assert admin_service._csv_cell("Ana") == "Ana"


def test_seating_map_fits_large_room_on_one_page():
    exam_id, room_id, _ = _create_exam_with_students(student_count=5, capacity=150)
    client.post(f"/api/exams/{exam_id}/assignments/confirm", headers=ADMIN_HEADERS)
    r = client.get(f"/api/exams/{exam_id}/seating-map/{room_id}", headers=ADMIN_HEADERS)
    assert r.status_code == 200
    doc = pymupdf.open(stream=r.content)
    assert len(doc) == 1
    page = doc[0]
    drawn = [d["rect"] for d in page.get_drawings()]
    assert drawn and all(page.rect.contains(rect) for rect in drawn)


def test_preview_paper_uses_sample_student_and_exam_room():
    exam_id, _ = _ready_exam_with_papers(student_count=2)
    r = client.get(f"/api/exams/{exam_id}/generated/preview", headers=INSTRUCTOR_HEADERS)
    assert r.status_code == 200 and r.headers["content-type"] == "application/pdf"
    assert r.headers["content-disposition"].startswith("inline")
    text = pymupdf.open(stream=r.content)[0].get_text()
    assert "Alexandra Sample-Studentname" in text and "SAMPLE" in text
    room = client.get(f"/api/exams/{exam_id}/assignments/seat-map", headers=ADMIN_HEADERS).json()["rooms"][0]
    assert room["building"] in text and room["seats"][0]["seat_code"] in text


def test_preview_paper_needs_a_template():
    exam_id, _, _ = _create_exam_with_students(student_count=1, capacity=5)
    assert client.get(f"/api/exams/{exam_id}/generated/preview", headers=ADMIN_HEADERS).status_code == 400


def test_stamp_keeps_a_long_room_name_and_the_seat():
    # Building and room number may be 150 characters together; the room must never drop off the paper.
    room = SimpleNamespace(building="Environmental Science and Chemistry Building " * 2, room_number="EV-142" * 6)
    student = SimpleNamespace(full_name="Test Student", student_number="1000000001")
    pdf = pdf_service.generate_one_student_pdf(_template(1, 200), EXAM, student, room, SEAT, "token")
    text = " ".join(pymupdf.open(stream=pdf)[0].get_text().split())
    assert "Environmental Science" in text and "EV-142" in text and SEAT.seat_code in text
