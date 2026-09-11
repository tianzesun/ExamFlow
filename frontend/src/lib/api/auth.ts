import { CurrentUser, DevToken } from "../auth/types";
import { fetchApi } from "./client";

const TOKEN_KEY = "examflow_dev_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
}

export async function getCurrentUser(): Promise<CurrentUser> {
  return fetchApi<CurrentUser>("/api/auth/me");
}

export async function devLogin(token: string): Promise<CurrentUser> {
  const user = await fetchApi<CurrentUser>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
  setToken(token);
  return user;
}

export async function getDevTokens(): Promise<DevToken[]> {
  const response = await fetchApi<{ tokens: DevToken[] }>("/api/auth/dev-tokens");
  return response.tokens;
}
