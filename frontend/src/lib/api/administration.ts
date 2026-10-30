import { fetchApi, API_BASE } from "./client";

export async function generateQr(examId: string): Promise<{ generated: number }> {
  return fetchApi<{ generated: number }>(`/api/exams/${examId}/qr/generate`, {
    method: "POST",
  });
}

export function getSignatureListUrl(examId: string, roomId: string): string {
  return `${API_BASE}/api/exams/${examId}/signature-list/${roomId}`;
}

/** Every seated student by name with their room and seat, as a printable PDF or a CSV. */
export function getSeatingListUrl(examId: string, format: "pdf" | "csv" = "pdf"): string {
  return `${API_BASE}/api/exams/${examId}/seating-list?format=${format}`;
}

export function getSeatingMapUrl(examId: string, roomId: string): string {
  return `${API_BASE}/api/exams/${examId}/seating-map/${roomId}`;
}

export async function generatePackage(examId: string): Promise<{ filename: string; size: number }> {
  return fetchApi<{ filename: string; size: number }>(`/api/exams/${examId}/package/generate`, {
    method: "POST",
  });
}

export function getPackageDownloadUrl(examId: string): string {
  return `${API_BASE}/api/exams/${examId}/package/download`;
}
