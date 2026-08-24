import { Exam, ExamListResponse } from "../types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

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

export async function createExam(data: {
  course_id: string;
  exam_name: string;
  term: string;
  academic_year: number;
  exam_date: string;
  start_time: string;
  duration_minutes: number;
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
    status?: string;
  }
): Promise<Exam> {
  return fetchApi<Exam>(`/api/exams/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}
