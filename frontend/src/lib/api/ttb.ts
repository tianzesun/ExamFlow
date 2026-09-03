import { getToken } from "./auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    credentials: "include",
    headers,
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: "Request failed" }));
    let message: string = error.detail || `HTTP ${response.status}`;
    if (Array.isArray(message)) {
      // FastAPI validation errors: [{ loc, msg, ... }, ...]
      message = message
        .map((e: { msg?: string }) => e?.msg ?? String(e))
        .join("; ");
    } else if (typeof message !== "string") {
      message = JSON.stringify(message);
    }
    throw new Error(message);
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
