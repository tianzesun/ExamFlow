import { fetchApi } from "./client";
import { AttendanceStatus, ExamStudent } from "../types";

export async function getRoster(
  examId: string,
  page = 1,
  pageSize = 50
): Promise<{ students: ExamStudent[]; total: number }> {
  return fetchApi(`/api/exams/${examId}/roster?page=${page}&page_size=${pageSize}`);
}

export async function getRosterStats(examId: string): Promise<{ total_students: number; exam_id: string }> {
  return fetchApi(`/api/exams/${examId}/roster/stats`);
}

export interface RosterDrop {
  student_id: string;
  student_number: string;
  full_name: string;
  room: string | null;
  seat_code: string | null;
}

export async function previewRosterImport(
  examId: string,
  file: File
): Promise<{
  total_rows: number;
  valid_rows: number;
  duplicate_in_file: number;
  already_in_roster: number;
  new_students: number;
  errors: string[];
  preview: { student_number: string; full_name: string }[];
  /** Students in the exam but not in the file: they may have dropped the course. */
  not_in_file: RosterDrop[];
}> {
  const formData = new FormData();
  formData.append("file", file);
  return fetchApi(`/api/exams/${examId}/roster/import/preview`, {
    method: "POST",
    body: formData,
  });
}

/** Add the file's students. With removeMissing, the file is the whole class list and students not in it are removed. */
export async function confirmRosterImport(
  examId: string,
  file: File,
  removeMissing = false,
): Promise<{ imported: number; skipped: number; removed: number }> {
  const formData = new FormData();
  formData.append("file", file);
  return fetchApi(`/api/exams/${examId}/roster/import/confirm?remove_missing=${removeMissing}`, {
    method: "POST",
    body: formData,
  });
}

export async function removeFromRoster(examId: string, studentId: string): Promise<void> {
  return fetchApi(`/api/exams/${examId}/roster/${studentId}`, {
    method: "DELETE",
  });
}

/** Every student on the roster, fetched page by page. */
export async function getFullRoster(examId: string): Promise<ExamStudent[]> {
  const pageSize = 200;
  const first = await getRoster(examId, 1, pageSize);
  const pages = Math.ceil(first.total / pageSize);
  const rest = await Promise.all(
    Array.from({ length: Math.max(0, pages - 1) }, (_, i) => getRoster(examId, i + 2, pageSize)),
  );
  return [first, ...rest].flatMap((p) => p.students);
}

export async function setAttendance(
  examId: string,
  studentId: string,
  attendance_status: AttendanceStatus,
): Promise<ExamStudent> {
  return fetchApi(`/api/exams/${examId}/roster/${studentId}/attendance`, {
    method: "PUT",
    body: JSON.stringify({ attendance_status }),
  });
}

/** Correct a student's name or UTORid, in every exam they're in. */
export async function updateStudentDetails(
  examId: string,
  studentId: string,
  data: { full_name: string; utorid: string | null },
): Promise<ExamStudent> {
  return fetchApi(`/api/exams/${examId}/roster/${studentId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function setAccommodation(
  examId: string,
  studentId: string,
  data: { extra_time_minutes: number; accommodation_notes: string | null },
): Promise<ExamStudent> {
  return fetchApi(`/api/exams/${examId}/roster/${studentId}/accommodation`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}
