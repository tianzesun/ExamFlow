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
