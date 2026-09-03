const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

export interface TTBReferenceData {
  status: string;
  data: {
    sessions: Array<{ label: string; value: string }>;
    divisions: Array<{ label: string; value: string }>;
  };
}

export interface TTBSyncResponse {
  status: string;
  synced: number;
  semester: string;
}

export async function getTTBReferenceData(): Promise<TTBReferenceData> {
  return fetchApi<TTBReferenceData>("/api/ttb/reference-data");
}

export async function syncTTBCourses(semester: string = "20269"): Promise<TTBSyncResponse> {
  return fetchApi<TTBSyncResponse>(`/api/ttb/sync?semester=${semester}`, {
    method: "POST",
  });
}
