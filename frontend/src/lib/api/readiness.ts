const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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
  const response = await fetch(`${API_BASE}/api/exams/${examId}/readiness`, {
    credentials: "include",
  });
  if (!response.ok) throw new Error("Failed to check readiness");
  return response.json();
}

export async function getExamSummary(examId: string): Promise<ExamSummary> {
  const response = await fetch(`${API_BASE}/api/exams/${examId}/summary`, {
    credentials: "include",
  });
  if (!response.ok) throw new Error("Failed to get summary");
  return response.json();
}
