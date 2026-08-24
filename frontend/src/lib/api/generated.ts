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

export interface GeneratedExam {
  id: string;
  student_number: string;
  full_name: string;
  file_name: string;
  file_size: number;
  status: string;
  generation_version: number;
  template_version: number | null;
  qr_token: string | null;
  created_at: string | null;
}

export interface GeneratedExamListResponse {
  exams: GeneratedExam[];
  total: number;
  page: number;
  page_size: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface GenerationResult {
  generated: number;
  failed: number;
  generation_version: number;
}

export async function validateGeneration(examId: string): Promise<ValidationResult> {
  return fetchApi(`/api/exams/${examId}/generated/validate`);
}

export async function generateExams(examId: string): Promise<GenerationResult> {
  return fetchApi(`/api/exams/${examId}/generated`, { method: "POST" });
}

export async function listGeneratedExams(
  examId: string,
  opts?: { query?: string; page?: number; page_size?: number }
): Promise<GeneratedExamListResponse> {
  const params = new URLSearchParams();
  if (opts?.query) params.set("query", opts.query);
  if (opts?.page) params.set("page", String(opts.page));
  if (opts?.page_size) params.set("page_size", String(opts.page_size));
  const qs = params.toString();
  return fetchApi(`/api/exams/${examId}/generated${qs ? "?" + qs : ""}`);
}

export function getGeneratedExamDownloadUrl(generatedExamId: string): string {
  return `${API_BASE}/api/generated-exams/${generatedExamId}/download`;
}
