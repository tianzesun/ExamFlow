const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface PdfDocument {
  id: string;
  document_type: string;
  version: number;
  filename: string;
  file_size: number;
  created_at: string | null;
}

export async function uploadPdf(examId: string, file: File): Promise<{ id: string; filename: string; file_size: number }> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(`${API_BASE}/api/exams/${examId}/pdf/upload`, {
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

export async function generatePdf(examId: string): Promise<{ id: string; filename: string; file_size: number; version: number }> {
  const response = await fetch(`${API_BASE}/api/exams/${examId}/pdf/generate`, {
    method: "POST",
    credentials: "include",
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Generation failed" }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }
  return response.json();
}

export function getPdfDownloadUrl(examId: string): string {
  return `${API_BASE}/api/exams/${examId}/pdf/download`;
}

export async function listDocuments(examId: string): Promise<PdfDocument[]> {
  const response = await fetch(`${API_BASE}/api/exams/${examId}/pdf/documents`, {
    credentials: "include",
  });
  if (!response.ok) throw new Error("Failed to list documents");
  return response.json();
}
