import { fetchApi, API_BASE } from "./client";

export interface ExamTemplate {
  id: string;
  exam_id: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  file_hash: string;
  template_type: string;
  /** Upload revision (1, 2, …) */
  version: number;
  /** Paper version (A–D); each has its own active upload */
  paper_version: string;
  is_active: boolean;
  crowdmark_exam_id: string | null;
  crowdmark_url: string | null;
  created_at: string | null;
}

export async function uploadTemplate(
  examId: string,
  file: File,
  crowdmarkExamId?: string,
  crowdmarkUrl?: string,
  paperVersion = "A",
): Promise<ExamTemplate> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("paper_version", paperVersion);
  if (crowdmarkExamId) formData.append("crowdmark_exam_id", crowdmarkExamId);
  if (crowdmarkUrl) formData.append("crowdmark_url", crowdmarkUrl);

  return fetchApi<ExamTemplate>(`/api/exams/${examId}/templates`, {
    method: "POST",
    body: formData,
  });
}

export async function listTemplates(examId: string): Promise<ExamTemplate[]> {
  return fetchApi<ExamTemplate[]>(`/api/exams/${examId}/templates`);
}

export function getTemplateDownloadUrl(examId: string, templateId: string): string {
  return `${API_BASE}/api/exams/${examId}/templates/${templateId}/download`;
}

export async function activateTemplate(examId: string, templateId: string): Promise<ExamTemplate> {
  return fetchApi<ExamTemplate>(`/api/exams/${examId}/templates/${templateId}/activate`, {
    method: "POST",
  });
}

export async function archiveTemplate(examId: string, templateId: string): Promise<ExamTemplate> {
  return fetchApi<ExamTemplate>(`/api/exams/${examId}/templates/${templateId}/archive`, {
    method: "POST",
  });
}

