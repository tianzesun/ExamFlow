import { getEntraToken } from "../auth/entra";

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

/** A test account's token if one was used, otherwise the UTORid (Entra) access token. */
async function buildHeaders(init?: RequestInit): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string> | undefined),
  };
  const token = headers["Authorization"] ? null : getStoredToken() ?? (await getEntraToken());
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

/** Error thrown for non-2xx responses; `requestId` is the backend correlation ID. */
export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly requestId: string | null) {
    super(message);
    this.name = "ApiError";
  }
}

/** Correlation reference for generic user-facing error messages, if available. */
export function errorReference(err: unknown): string {
  return err instanceof ApiError && err.requestId ? ` (Ref: ${err.requestId.slice(0, 8)})` : "";
}

/** The server's explanation when it refused a request (400, 409), otherwise a generic message with the reference. */
export function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError && (err.status === 400 || err.status === 409)
    ? err.message
    : `${fallback}${errorReference(err)}`;
}

/** Authenticated JSON fetch shared by all API modules. */
export async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const hasBody = options?.body !== undefined && options?.body !== null;
  const isFormData = typeof FormData !== "undefined" && hasBody && options?.body instanceof FormData;
  const headers = await buildHeaders(options);
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
    throw new ApiError(message, response.status, response.headers.get("X-Request-Id"));
  }

  if (response.status === 204) return null as T;
  return response.json();
}

/**
 * Download a protected file. Plain links can't send the bearer token, so fetch it
 * with auth headers and hand the browser a temporary object URL.
 */
async function fetchFile(url: string): Promise<Response> {
  const response = await fetch(url.startsWith("http") ? url : `${API_BASE}${url}`, {
    credentials: "include",
    headers: await buildHeaders(),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Download failed" }));
    throw new ApiError(String(error.detail ?? "Download failed"), response.status, response.headers.get("X-Request-Id"));
  }
  return response;
}

/**
 * Open an authenticated file (e.g. a PDF) in a new tab.
 * The tab is opened before the request so popup blockers allow it.
 */
export async function openFile(url: string): Promise<void> {
  const tab = window.open("", "_blank");
  try {
    const href = URL.createObjectURL(await (await fetchFile(url)).blob());
    if (tab) tab.location.href = href;
    else window.location.href = href;
    setTimeout(() => URL.revokeObjectURL(href), 60_000);
  } catch (err) {
    tab?.close();
    throw err;
  }
}

export async function downloadFile(url: string, fallbackName: string): Promise<void> {
  const response = await fetchFile(url);
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1];
  const plain = /filename="([^"]+)"/i.exec(disposition)?.[1];
  const name = utf8 ? decodeURIComponent(utf8) : plain || fallbackName;

  const href = URL.createObjectURL(await response.blob());
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 10_000);
}

export { API_BASE };
