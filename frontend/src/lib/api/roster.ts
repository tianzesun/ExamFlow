import { fetchApi } from "./client";
import { ExamStudent } from "../types";

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
}> {
  const formData = new FormData();
  formData.append("file", file);
  return fetchApi(`/api/exams/${examId}/roster/import/preview`, {
    method: "POST",
    body: formData,
  });
}

export async function confirmRosterImport(
  examId: string,
  file: File
): Promise<{ imported: number; skipped: number }> {
  const formData = new FormData();
  formData.append("file", file);
  return fetchApi(`/api/exams/${examId}/roster/import/confirm`, {
    method: "POST",
    body: formData,
  });
}

export async function removeFromRoster(examId: string, studentId: string): Promise<void> {
  return fetchApi(`/api/exams/${examId}/roster/${studentId}`, {
    method: "DELETE",
  });
}
