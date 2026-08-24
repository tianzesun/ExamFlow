const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface ExamTemplate {
  id: string;
  exam_id: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  file_hash: string;
  template_type: string;
  version: number;
  is_active: boolean;
  crowdmark_exam_id: string | null;
  crowdmark_url: string | null;
  created_at: string | null;
}

export async function uploadTemplate(
  examId: string,
  file: File,
  crowdmarkExamId?: string,
  crowdmarkUrl?: string
): Promise<ExamTemplate> {
  const formData = new FormData();
  formData.append("file", file);
  if (crowdmarkExamId) formData.append("crowdmark_exam_id", crowdmarkExamId);
  if (crowdmarkUrl) formData.append("crowdmark_url", crowdmarkUrl);

  const response = await fetch(`${API_BASE}/api/exams/${examId}/templates`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Upload failed" }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }
  return response.json();
}

export async function listTemplates(examId: string): Promise<ExamTemplate[]> {
  const response = await fetch(`${API_BASE}/api/exams/${examId}/templates`, {
    credentials: "include",
  });
  if (!response.ok) throw new Error("Failed to list templates");
  return response.json();
}

export function getTemplateDownloadUrl(examId: string, templateId: string): string {
  return `${API_BASE}/api/exams/${examId}/templates/${templateId}/download`;
}

export async function activateTemplate(examId: string, templateId: string): Promise<ExamTemplate> {
  const response = await fetch(`${API_BASE}/api/exams/${examId}/templates/${templateId}/activate`, {
    method: "POST",
    credentials: "include",
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Activation failed" }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }
  return response.json();
}

export async function archiveTemplate(examId: string, templateId: string): Promise<ExamTemplate> {
  const response = await fetch(`${API_BASE}/api/exams/${examId}/templates/${templateId}/archive`, {
    method: "POST",
    credentials: "include",
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Archive failed" }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }
  return response.json();
}
