import { fetchApi, API_BASE } from "./client";

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

export interface GenerationJob {
  id: string;
  status: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED";
  total: number;
  done: number;
  generated: number;
  generation_version: number | null;
  error: string | null;
  created_at: string;
  finished_at: string | null;
}

export async function validateGeneration(examId: string): Promise<ValidationResult> {
  return fetchApi(`/api/exams/${examId}/generated/validate`);
}

/** Starts generation in the background; poll getLatestGenerationJob for progress. */
export async function startGenerationJob(examId: string): Promise<GenerationJob> {
  return fetchApi(`/api/exams/${examId}/generated/jobs`, { method: "POST" });
}

export async function getLatestGenerationJob(examId: string): Promise<{ job: GenerationJob | null }> {
  return fetchApi(`/api/exams/${examId}/generated/jobs/latest`);
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

/** All current papers in one PDF, in seat order, optionally for one room. */
export function getPrintFileUrl(examId: string, opts: { roomId?: string; doubleSided?: boolean } = {}): string {
  const params = new URLSearchParams();
  if (opts.roomId) params.set("room_id", opts.roomId);
  if (opts.doubleSided) params.set("double_sided", "true");
  const qs = params.toString();
  return `${API_BASE}/api/exams/${examId}/generated/print${qs ? "?" + qs : ""}`;
}

export function getGeneratedExamDownloadUrl(examId: string, generatedExamId: string): string {
  return `${API_BASE}/api/exams/${examId}/generated/${generatedExamId}/download`;
}
