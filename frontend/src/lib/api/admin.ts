import { fetchApi } from "./client";

export interface AdminUser {
  id: string;
  display_name: string;
  email: string | null;
  role: string;
  is_active: boolean;
  first_signed_in: string;
  source: "UTORid" | "test account";
  /** Courses the person was added to (instructors and TAs) */
  courses: number;
}

export interface ActivityEntry {
  id: string;
  at: string;
  action: string;
  category: string;
  user: { id: string; name: string } | null;
  entity_type: string;
  entity_id: string | null;
  entity_label: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
}

export interface ActivityPage {
  entries: ActivityEntry[];
  total: number;
  page: number;
  page_size: number;
}

export async function getAdminUsers(): Promise<AdminUser[]> {
  return (await fetchApi<{ users: AdminUser[] }>("/api/admin/users")).users;
}

export async function setUserActive(userId: string, isActive: boolean): Promise<AdminUser> {
  return fetchApi<AdminUser>(`/api/admin/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify({ is_active: isActive }),
  });
}

export async function getActivity(filters: {
  category?: string;
  user_id?: string;
  day?: string;
  page?: number;
}): Promise<ActivityPage> {
  const params = new URLSearchParams({ page: String(filters.page ?? 1), page_size: "50" });
  if (filters.category) params.set("category", filters.category);
  if (filters.user_id) params.set("user_id", filters.user_id);
  if (filters.day) params.set("day", filters.day);
  return fetchApi<ActivityPage>(`/api/admin/activity?${params}`);
}

export interface SystemSettings {
  department_name: string;
  ttb_division: string;
  ttb_subjects: string[];
  default_seating: { order: string; spacing: string; versions: number; fill: string; front_row_empty: boolean };
  max_upload_mb: number;
  /** What each paper's stamp shows besides room, seat and QR code */
  paper_stamp: { show_name: boolean; show_utorid: boolean; every_page: boolean };
  /** Printed above the title of exam-day documents; empty for none */
  document_heading: string;
  default_duration_minutes: number;
  /** HH:MM, or empty */
  default_start_time: string;
}

/** How the server is set up; shown, not editable. */
export interface DeploymentInfo {
  environment: string;
  test_accounts: boolean;
  rate_limits: boolean;
  public_app_url: string;
  storage: string;
}

export interface SettingsPage {
  settings: SystemSettings;
  deployment: DeploymentInfo;
}

export async function getSystemSettings(): Promise<SettingsPage> {
  return fetchApi<SettingsPage>("/api/admin/settings");
}

export async function saveSystemSettings(settings: SystemSettings): Promise<SettingsPage> {
  return fetchApi<SettingsPage>("/api/admin/settings", { method: "PUT", body: JSON.stringify(settings) });
}

/** The Entra app registration for UTORid sign-in. Nothing here is secret (no client secret is used). */
export interface SignInSettings {
  tenant_id: string;
  client_id: string;
  api_scope: string;
  /** ExamFlow role → Entra app role value */
  role_values: Record<"ADMIN" | "STAFF" | "INSTRUCTOR" | "TA", string>;
}

export interface SignInSettingsPage {
  sign_in: SignInSettings;
  /** "environment": set on the server and can't be changed here */
  source: "environment" | "settings";
  enabled: boolean;
  test_accounts: boolean;
}

export async function getSignInSettings(): Promise<SignInSettingsPage> {
  return fetchApi<SignInSettingsPage>("/api/admin/settings/sign-in");
}

export async function saveSignInSettings(settings: SignInSettings): Promise<SignInSettingsPage> {
  return fetchApi<SignInSettingsPage>("/api/admin/settings/sign-in", { method: "PUT", body: JSON.stringify(settings) });
}
