import { fetchApi } from "./client";

export interface CheckResult {
  name: string;
  status: "PASS" | "FAIL" | "WARN";
  message: string;
  count: number | null;
  required: number | null;
}

export interface ReadinessResult {
  ready: boolean;
  checks: CheckResult[];
}

export interface ExamSummary {
  roster_count: number;
  assigned_count: number;
  unassigned_count: number;
  room_count: number;
  generated_count: number;
  qr_count: number;
  has_template: boolean;
  template_version: number | null;
}

export async function getReadiness(examId: string): Promise<ReadinessResult> {
  return fetchApi<ReadinessResult>(`/api/exams/${examId}/readiness`);
}

export async function getExamSummary(examId: string): Promise<ExamSummary> {
  return fetchApi<ExamSummary>(`/api/exams/${examId}/summary`);
}

/** Summaries for many exams in one request. */
export async function getExamSummaries(examIds: string[]): Promise<Record<string, ExamSummary>> {
  if (examIds.length === 0) return {};
  return fetchApi<Record<string, ExamSummary>>("/api/exams/summaries", {
    method: "POST",
    body: JSON.stringify({ exam_ids: examIds }),
  });
}
