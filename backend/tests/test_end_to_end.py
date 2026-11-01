"""End to end: roster → rooms → rules → seating → manual changes → papers → print, checking
that every printed paper names the student's actual room, seat and version."""

import csv
import io
import re
import uuid
from unittest import mock

import pymupdf

from app.services import generation_job_service
from tests.test_seat_map import ADMIN_HEADERS, client

H = ADMIN_HEADERS
_run_job = generation_job_service.run_job


def ok(r, code=200):
    assert r.status_code == code, (r.status_code, r.text[:400])
    return r.json() if r.headers.get("content-type", "").startswith("application/json") else r


def sfx():
    return uuid.uuid4().hex[:6].upper()


def template(marker):
    d = pymupdf.open()
    for i in range(2):
        d.new_page().insert_text((72, 200), f"{marker} page {i + 1}", fontsize=14)
    return d.tobytes()


def generate(exam_id, only_changed=True):
    queued = []
    with mock.patch.object(generation_job_service, "run_job", side_effect=queued.append):
        r = client.post(f"/api/exams/{exam_id}/generated/jobs", params={"only_changed": only_changed}, headers=H)
    assert r.status_code == 202, r.text
    for j in queued:
        _run_job(j)
    job = ok(client.get(f"/api/exams/{exam_id}/generated/jobs/latest", headers=H))["job"]
    assert job["status"] == "SUCCEEDED", job


def seat_map(exam_id):
    rooms = ok(client.get(f"/api/exams/{exam_id}/assignments/seat-map", headers=H))["rooms"]
    truth = {}
    for room in rooms:
        for s in room["seats"]:
            if s["occupant"]:
                o = s["occupant"]
                assert o["student_number"] not in truth, "student seated twice"
                truth[o["student_number"]] = (f"{room['building']} {room['room_number']}", s["seat_code"],
                                              o["paper_version"], s["is_usable"], room["id"], s["id"], o)
    return rooms, truth


def printed(exam_id, **params):
    r = client.get(f"/api/exams/{exam_id}/generated/print", params=params, headers=H)
    assert r.status_code == 200, r.text
    doc = pymupdf.open(stream=r.content)
    papers = {}
    for page in doc:
        text = " ".join(page.get_text().split())
        m = re.search(r"(.+?) · (\d{10}) · (.+?) · Seat (\S+) · Version ([A-D])", text)
        if m:  # page 2 line carries everything
            name, number, room, seat, version = m.groups()
            assert number not in papers, f"{number} printed twice"
            # Each paper is made from its own version's upload.
            assert f"PAPER-{version} page 2" in text, (number, version, text[:120])
            papers[number] = (room, seat, version, name.replace(f"PAPER-{version} page 2", "").strip())
        elif "Student number:" in text:
            first = text
            papers.setdefault("_first", []).append(first)
    return papers, doc


def check(exam_id, students, label):
    rooms, truth = seat_map(exam_id)
    papers, doc = printed(exam_id)
    firsts = papers.pop("_first", [])
    assert set(papers) == set(truth), (label, set(truth) ^ set(papers))
    for number, (room, seat, version, *_rest) in truth.items():
        assert papers[number][:3] == (room, seat, version), (label, number, papers[number], truth[number][:3])
        assert papers[number][3] == students[number], (label, "name", number)
        assert truth[number][3], (label, "seated in a seat not in use", number)
    # Every first page carries the student's seat in the big box, matching page 2.
    for text in firsts:
        number = re.search(r"Student number: (\d{10})", text).group(1)
        room, seat, version = truth[number][:3]
        assert seat in text and room.split()[0] in text and f"VERSION {version}" in text.replace("\n", " "), (
            label, number, text[:200])
    # Seating list CSV agrees.
    csv_text = client.get(f"/api/exams/{exam_id}/seating-list", params={"format": "csv"}, headers=H).text.lstrip("﻿")
    rows = {r["Student number"]: (r["Room"], r["Seat"], r["Version"]) for r in csv.DictReader(io.StringIO(csv_text))}
    assert rows == {n: t[:3] for n, t in truth.items()}, (label, "csv")
    # Signature list per room names exactly that room's students, with their seats.
    for room in rooms:
        pdf = client.get(f"/api/exams/{exam_id}/signature-list/{room['id']}", headers=H)
        text = " ".join(" ".join(p.get_text().split()) for p in pymupdf.open(stream=pdf.content))
        here = {n for n, t in truth.items() if t[4] == room["id"]}
        listed = set(re.findall(r"\b(\d{10})\b", text))
        assert listed == here, (label, room["room_number"], here ^ listed)
    return truth


def test_every_printed_paper_names_the_students_seat():
    course = ok(client.post("/api/courses", json={"course_code": f"E2E{sfx()}", "course_name": "Trace"},
                            headers=H), 201)
    exam = ok(client.post("/api/exams", json={
        "course_id": course["id"], "exam_name": "Final", "term": "Fall", "academic_year": 2026,
        "exam_date": "2026-12-12", "start_time": "09:00:00", "duration_minutes": 120}, headers=H), 201)
    eid = exam["id"]

    # Room 1: 5 rows x 8, aisle after 4, back corners missing, two seats not in use.
    big = ok(client.post("/api/rooms", json={"building": f"TR{sfx()}", "room_number": "101", "rows": 5, "columns": 8,
                                             "aisles_after": [4]}, headers=H), 201)
    ok(client.put(f"/api/rooms/{big['id']}/layout", json={"rows": 5, "columns": 8, "aisles_after": [4],
                                                         "missing": [[5, 1], [5, 8]], "blocked": [[1, 1], [3, 5]]},
                  headers=H))
    # Accommodation room.
    acc = ok(client.post("/api/rooms", json={"building": f"TR{sfx()}", "room_number": "ACC", "capacity": 6},
                         headers=H), 201)
    for r in (big, acc):
        ok(client.post(f"/api/exams/{eid}/assignments/rooms", json={"room_id": r["id"]}, headers=H), 201)

    prefix = uuid.uuid4().int % 10**6
    students = {f"9{prefix:06d}{i:03d}": f"Student{i:02d} Trace" for i in range(20)}
    # Names that test the stamp: accents and a very long name.
    first = sorted(students)
    students[first[1]] = "Nguyễn Thị Minh Khai"
    students[first[2]] = "Maximiliana Anastasia Featherstonehaugh-Wolfeschlegelsteinhausen"
    body = "student_number,name\n" + "\n".join(f"{n},{name}" for n, name in students.items())
    ok(client.post(f"/api/exams/{eid}/roster/import/confirm", files={"file": ("r.csv", body, "text/csv")}, headers=H))
    roster = ok(client.get(f"/api/exams/{eid}/roster", params={"page_size": 200}, headers=H))["students"]
    by_number = {s["student_number"]: s for s in roster}
    # Three students need the accommodation room.
    for n in first[-3:]:
        ok(client.put(f"/api/exams/{eid}/roster/{by_number[n]['student_id']}/accommodation",
                      json={"extra_time_minutes": 30, "accommodation_notes": None}, headers=H))

    ok(client.put(f"/api/exams/{eid}/assignments/rules", json={
        "order": "random", "spacing": "every_other_seat", "accommodation_room_id": acc["id"], "versions": 2},
        headers=H))
    ok(client.post(f"/api/exams/{eid}/assignments/confirm", headers=H))

    rooms, truth = seat_map(eid)
    assert all(truth[n][4] == acc["id"] for n in first[-3:]), "accommodation students not in the accommodation room"
    assert all(truth[n][4] == big["id"] for n in first[:-3]), "others should be in the main room"
    # Checkerboard: no two seated students side by side or front/back in the big room.
    big_seats = next(r for r in rooms if r["id"] == big["id"])["seats"]
    seats = {(s["row_number"], s["column_number"]) for s in big_seats if s["occupant"]}
    for (row, col) in seats:
        assert (row, col + 1) not in seats and (row + 1, col) not in seats, ("neighbours", row, col)

    ok(client.post(f"/api/exams/{eid}/templates", files={"file": ("a.pdf", template("PAPER-A"), "application/pdf")},
                   data={"paper_version": "A"}, headers=H), 201)
    ok(client.post(f"/api/exams/{eid}/templates", files={"file": ("b.pdf", template("PAPER-B"), "application/pdf")},
                   data={"paper_version": "B"}, headers=H), 201)
    generate(eid, only_changed=False)
    check(eid, students, "after generation")

    # Manual changes: move one student to an empty seat, swap two others.
    rooms, truth = seat_map(eid)
    big_room = next(r for r in rooms if r["id"] == big["id"])
    empty = next(s for s in big_room["seats"] if s["is_usable"] and not s["occupant"])
    mover, a, b = first[3], first[4], first[5]
    ok(client.post(f"/api/exams/{eid}/assignments/move", json={"student_id": truth[mover][6]["student_id"],
                                                               "seat_id": empty["id"]}, headers=H))
    ok(client.post(f"/api/exams/{eid}/assignments/move", json={"student_id": truth[a][6]["student_id"],
                                                               "seat_id": truth[b][5]}, headers=H))
    status = ok(client.get(f"/api/exams/{eid}/generated/status", headers=H))
    assert status["to_generate"] >= 3

    generate(eid, only_changed=True)
    # Only the changed papers come out in a "not yet printed" run (before the full reprint below).
    new_papers, _ = printed(eid, only_new=True)
    new_papers.pop("_first", None)
    assert set(new_papers) == {mover, a, b}, set(new_papers)
    after = check(eid, students, "after moves and update")
    assert after[mover][1] == empty["seat_code"]
    assert (after[a][1], after[b][1]) == (truth[b][1], truth[a][1]), "swap"


    # Besides the papers, the print file has one cover sheet per room, naming its seat range.
    _, doc = printed(eid)
    covers = [" ".join(p.get_text().split()) for p in doc
              if "Student number:" not in p.get_text() and " · Seat " not in p.get_text()]
    assert len(covers) == 2 and all("in seat order" in c for c in covers), covers
