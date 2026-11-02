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
  room: string | null;
  seat_code: string | null;
  /** False once the student moved seat or a new template was activated */
  up_to_date: boolean;
  printed_at: string | null;
}

export interface PaperStatus {
  seated: number;
  up_to_date: number;
  outdated: number;
  /** Seated students whose paper is missing or out of date */
  to_generate: number;
  /** Up-to-date papers not yet included in a print file */
  not_printed: number;
  /** Printed copies to take out of the stacks (see getPapersToPull). */
  to_pull: number;
}

/** A printed copy that is no longer the student's paper and must come out of the stack. */
export interface PaperToPull {
  id: string;
  room: string;
  room_id: string | null;
  seat_code: string;
  /** Empty when the student was removed from the roster. */
  student_number: string | null;
  full_name: string | null;
  reason: "removed" | "out_of_date" | "replaced";
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
  /** Worth knowing but not blocking, e.g. students who have no seat yet and so get no paper. */
  warnings: string[];
}

export interface GenerationJob {
  id: string;
  status: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED";
  total: number;
  done: number;
  generated: number;
  generation_version: number | null;
  error: string | null;
  only_changed: boolean;
  created_at: string;
  finished_at: string | null;
}

export async function validateGeneration(examId: string): Promise<ValidationResult> {
  return fetchApi(`/api/exams/${examId}/generated/validate`);
}

/**
 * Starts generation in the background; poll getLatestGenerationJob for progress.
 * By default only missing and out-of-date papers are made, so printed copies stay valid.
 */
export async function startGenerationJob(examId: string, onlyChanged = true): Promise<GenerationJob> {
  return fetchApi(`/api/exams/${examId}/generated/jobs?only_changed=${onlyChanged}`, { method: "POST" });
}

export async function getPaperStatus(examId: string): Promise<PaperStatus> {
  return fetchApi(`/api/exams/${examId}/generated/status`);
}

export async function getPapersToPull(examId: string): Promise<{ papers: PaperToPull[] }> {
  return fetchApi(`/api/exams/${examId}/generated/pull`);
}

/** Record that these printed copies were taken out of the stacks. */
export async function markPapersPulled(examId: string, ids: string[]): Promise<{ pulled: number }> {
  return fetchApi(`/api/exams/${examId}/generated/pull`, { method: "POST", body: JSON.stringify({ ids }) });
}

export async function getLatestGenerationJob(examId: string): Promise<{ job: GenerationJob | null }> {
  return fetchApi(`/api/exams/${examId}/generated/jobs/latest`);
}

export async function listGeneratedExams(
  examId: string,
  opts?: { query?: string; page?: number; page_size?: number; outdated_only?: boolean }
): Promise<GeneratedExamListResponse> {
  const params = new URLSearchParams();
  if (opts?.outdated_only) params.set("outdated_only", "true");
  if (opts?.query) params.set("query", opts.query);
  if (opts?.page) params.set("page", String(opts.page));
  if (opts?.page_size) params.set("page_size", String(opts.page_size));
  const qs = params.toString();
  return fetchApi(`/api/exams/${examId}/generated${qs ? "?" + qs : ""}`);
}

/** The template stamped for a sample student, watermarked SAMPLE. */
export function getPreviewUrl(examId: string): string {
  return `${API_BASE}/api/exams/${examId}/generated/preview`;
}

/** Up-to-date papers in one PDF, in seat order, optionally for one room or only those not yet printed. */
export function getPrintFileUrl(
  examId: string,
  opts: { roomId?: string; doubleSided?: boolean; onlyNew?: boolean } = {},
): string {
  const params = new URLSearchParams();
  if (opts.onlyNew) params.set("only_new", "true");
  if (opts.roomId) params.set("room_id", opts.roomId);
  if (opts.doubleSided) params.set("double_sided", "true");
  const qs = params.toString();
  return `${API_BASE}/api/exams/${examId}/generated/print${qs ? "?" + qs : ""}`;
}

export function getGeneratedExamDownloadUrl(examId: string, generatedExamId: string): string {
  return `${API_BASE}/api/exams/${examId}/generated/${generatedExamId}/download`;
}
