const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const TOKEN_KEY = "examflow_dev_token";

function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function buildHeaders(init?: RequestInit): Record<string, string> {
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string> | undefined),
  };
  const token = getStoredToken();
  if (token && !headers["Authorization"]) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

/** Authenticated JSON fetch shared by all API modules. */
export async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const hasBody = options?.body !== undefined && options?.body !== null;
  const isFormData = typeof FormData !== "undefined" && hasBody && options?.body instanceof FormData;
  const headers = buildHeaders(options);
  if (hasBody && !isFormData && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    credentials: "include",
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Request failed" }));
    let message: string = error.detail || `HTTP ${response.status}`;
    if (Array.isArray(message)) {
      message = message.map((e: { msg?: string }) => e?.msg ?? String(e)).join("; ");
    } else if (typeof message !== "string") {
      message = JSON.stringify(message);
    }
    throw new Error(message);
  }

  if (response.status === 204) return null as T;
  return response.json();
}

export { API_BASE };
