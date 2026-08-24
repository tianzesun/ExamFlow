const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function generateQr(examId: string): Promise<{ generated: number }> {
  const response = await fetch(`${API_BASE}/api/exams/${examId}/qr/generate`, {
    method: "POST",
    credentials: "include",
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Failed" }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }
  return response.json();
}

export function getSignatureListUrl(examId: string, roomId: string): string {
  return `${API_BASE}/api/exams/${examId}/signature-list/${roomId}`;
}

export function getSeatingMapUrl(examId: string, roomId: string): string {
  return `${API_BASE}/api/exams/${examId}/seating-map/${roomId}`;
}

export async function generatePackage(examId: string): Promise<{ filename: string; size: number }> {
  const response = await fetch(`${API_BASE}/api/exams/${examId}/package/generate`, {
    method: "POST",
    credentials: "include",
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Failed" }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }
  return response.json();
}

export function getPackageDownloadUrl(examId: string): string {
  return `${API_BASE}/api/exams/${examId}/package/download`;
}
