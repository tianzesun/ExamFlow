import { ExamStudent } from "../types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  if (response.status === 204) return null as T;
  return response.json();
}

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
