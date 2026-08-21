import { CurrentUser, DevToken } from "../auth/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
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

export async function getCurrentUser(): Promise<CurrentUser> {
  return fetchApi<CurrentUser>("/api/auth/me");
}

export async function devLogin(token: string): Promise<CurrentUser> {
  return fetchApi<CurrentUser>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export async function getDevTokens(): Promise<DevToken[]> {
  const response = await fetchApi<{ tokens: DevToken[] }>("/api/auth/dev-tokens");
  return response.tokens;
}
