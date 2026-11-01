# Pilot Test Script

One mock exam, start to finish, run by exam office staff on the pilot server. About 90 minutes.
Each test says what to check **on paper as well as on screen**: the printed seat is what matters.

*Matches ExamFlow as of 2026-10-31.*

## Before you start

- [ ] Pilot server running, database migrated (`alembic upgrade head`)
- [ ] **Synthetic data only.** No real student names or numbers in the pilot.
- [ ] Two people: **A** (exam office; ADMIN for TEST-06, since only administrators create rooms)
      and **B** (instructor)
- [ ] A printer, and two short PDFs to use as exam papers (version A and version B), each with
      something printed near the top of page 1
- [ ] A roster CSV like this, with 30–40 rows (made-up numbers starting `999`):

```csv
student_number,first_name,last_name,email
9990000001,Ada,Testperson,ada.testperson@example.invalid
9990000002,Bao,Testperson,bao.testperson@example.invalid
9990000003,Chloé,Testpersonne,chloe.t@example.invalid
```

Include one accented name, one very long name, one row with a missing name and one duplicate
student number, so the import checks are exercised.

## How to record results

For each test: ☐ PASS ☐ FAIL, and in Notes anything confusing even if it worked. Confusing
wording counts as a finding.

---

## 1. Sign-in and access

### TEST-01 Sign in
1. Open the pilot site. If **Sign in with UTORid** is shown, use it; otherwise pick the test
   account for your role.
2. You land on the Dashboard, and your name and role show at the bottom of the menu.

Status ☐ PASS ☐ FAIL · Notes: ____________

### TEST-02 An instructor sees only their own courses
1. **B** signs in. The Dashboard says they haven't been added to any courses yet.
2. **A** opens Courses → the mock course → *People with access*, and adds B's sign-in email.
3. **B** reloads: the course and its exam now appear. B can open the seat map but can't move
   anyone.

Status ☐ PASS ☐ FAIL · Notes: ____________

## 2. Set up the exam

### TEST-03 Create the exam
1. Exams → **Create exam**: the mock course, "Pilot Final", a date next week, 9:00, 120 minutes.
2. The exam opens on its Overview, with the four steps Students → Seats → Exam papers → Exam day.

Status ☐ PASS ☐ FAIL · Notes: ____________

### TEST-04 Import the roster
1. **Students** → **Import CSV** → choose the file → **Preview import**.
2. The preview shows the valid rows, the duplicate and the row with a missing name.
3. Confirm. The student count on the Students step matches the valid rows.

Status ☐ PASS ☐ FAIL · Notes: ____________

### TEST-05 Accommodations
1. On two students choose **Accommodations**: 30 minutes extra time each.
2. They show "+30 min" on the Students page.

Status ☐ PASS ☐ FAIL · Notes: ____________

### TEST-06 Rooms
1. Rooms → **New room**: 6 rows × 8 seats. Open it, mark two seats **Not in use**, remove one
   seat with **No seat**, set the aisle to **Centre**, and **Save changes**.
2. Create a small second room (capacity 6) for accommodations.

Status ☐ PASS ☐ FAIL · Notes: ____________

## 3. Seats

### TEST-07 Seating rules and first seating
1. **Seats** → add both rooms.
2. Seating rules: Order *random*, Spacing *every other seat*, Accommodation room *the small
   room*, Paper versions *two*.
3. **Preview**, then confirm the assignment.
4. **Seat map**: nobody sits beside or directly behind anyone; the two accommodation students are
   in the small room; seats marked not in use are empty; seats alternate A/B.

Status ☐ PASS ☐ FAIL · Notes: ____________

### TEST-08 Move and swap
1. On the seat map, drag one student to an empty seat; drag another onto an occupied seat to swap.
2. Both changes show at once, and on **Rooms & assignments** the method reads *Manual*.

Status ☐ PASS ☐ FAIL · Notes: ____________

## 4. Exam papers

### TEST-09 Upload and preview
1. **Exam papers** → upload the version A PDF, then the version B PDF.
2. **Preview a paper**: the sample student's name, number, room, seat and a VERSION badge are at
   the top, and the paper's own text at the top of page 1 is **not covered**.

Status ☐ PASS ☐ FAIL · Notes: ____________

### TEST-10 Generate and print
1. **Check & generate papers**, and wait for the progress bar to finish.
2. **Download for printing**, then print it.
3. Take five printed papers at random. For each, find the student on the seat map and check:
   name, student number, **room, seat** and version match, and the paper is the right version
   (A or B content).
4. Each room's stack starts with a cover sheet giving its seat range.

Status ☐ PASS ☐ FAIL · Notes: ____________

### TEST-11 A late change
1. Move one student to another seat.
2. Exam papers says 1 paper needs updating. **Update** it.
3. Print with **Not yet printed** selected: only that one paper prints, with the new seat.

Status ☐ PASS ☐ FAIL · Notes: ____________

## 5. Exam day

### TEST-12 Room documents
1. **Exam day**: the readiness checklist is all green.
2. Download each room's **Signature list** and **Seating map**, and the **Seating list** for all
   rooms. Spot-check three students against the seat map.

Status ☐ PASS ☐ FAIL · Notes: ____________

### TEST-13 Check-in
1. In **Attendance**, find a student by typing their **seat code**.
2. The list shows their seat and room. Mark three present and one absent; undo one.
3. **B** (instructor) can do the same on their course's exam.

Status ☐ PASS ☐ FAIL · Notes: ____________

### TEST-14 QR codes
1. Scan the QR code on a printed paper with a phone: it says the paper is valid, with the course,
   exam and date, and **no student details**.
2. Scan the old paper of the student moved in TEST-11: it says the paper has been replaced.

Status ☐ PASS ☐ FAIL · Notes: ____________

### TEST-15 Exam-day package
1. **Generate package**, then **Download package**. The zip has the summary, each room's
   documents and every paper.

Status ☐ PASS ☐ FAIL · Notes: ____________

## 6. Afterwards

### TEST-16 The record
1. An ADMIN opens **Admin → Activity**, filtered to today.
2. The imports, seating, moves, paper generation, prints and downloads from this session are all
   there, under the right person.

Status ☐ PASS ☐ FAIL · Notes: ____________

### TEST-17 Archive
1. On the exam's Overview, set the status to **Archived** and confirm (it can't be reopened, so
   use the mock exam only). Seating, papers and the roster can no longer be changed, but
   everything can still be viewed and downloaded.

Status ☐ PASS ☐ FAIL · Notes: ____________

---

## Questions for the exam office after the run

1. Which step took longest, and why?
2. Was anything worded in a way you'd say differently?
3. On exam day, what did you need that wasn't on the screen?
4. Would you trust the printed seat without checking it against the seat map?
