import { fetchApi } from "./client";
import { Exam, ExamListResponse } from "../types";

export interface ExamFilters {
  course_id?: string;
  term?: string;
  academic_year?: number;
  status?: string;
}

export async function getExams(
  filters: ExamFilters = {},
  page = 1,
  pageSize = 20
): Promise<ExamListResponse> {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("page_size", String(pageSize));
  if (filters.course_id) params.set("course_id", filters.course_id);
  if (filters.term) params.set("term", filters.term);
  if (filters.academic_year) params.set("academic_year", String(filters.academic_year));
  if (filters.status) params.set("status", filters.status);

  return fetchApi<ExamListResponse>(`/api/exams?${params.toString()}`);
}

export async function getExam(id: string): Promise<Exam> {
  return fetchApi<Exam>(`/api/exams/${id}`);
}

/** What the new-exam form starts with (set in Admin › Settings). */
export async function getExamDefaults(): Promise<{ duration_minutes: number; start_time: string }> {
  return fetchApi("/api/exams/defaults");
}

export async function createExam(data: {
  course_id: string;
  exam_name: string;
  term: string;
  academic_year: number;
  exam_date: string;
  start_time: string;
  duration_minutes: number;
  notes?: string | null;
}): Promise<Exam> {
  return fetchApi<Exam>("/api/exams", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateExam(
  id: string,
  data: {
    exam_name?: string;
    term?: string;
    academic_year?: number;
    exam_date?: string;
    start_time?: string;
    duration_minutes?: number;
    notes?: string | null;
    status?: string;
  }
): Promise<Exam> {
  return fetchApi<Exam>(`/api/exams/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

/** Every exam matching the filters, fetched page by page (the API caps pages at 100). */
export async function getAllExams(filters: ExamFilters = {}): Promise<ExamListResponse> {
  const first = await getExams(filters, 1, 100);
  const pages = Math.ceil(first.total / 100);
  const rest = await Promise.all(
    Array.from({ length: Math.max(0, pages - 1) }, (_, i) => getExams(filters, i + 2, 100)),
  );
  return { ...first, exams: [first, ...rest].flatMap((r) => r.exams), page_size: first.total };
}

export async function deleteExam(id: string): Promise<void> {
  return fetchApi<void>(`/api/exams/${id}`, { method: "DELETE" });
}
