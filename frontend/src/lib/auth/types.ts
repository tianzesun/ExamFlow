export type UserRole = "ADMIN" | "STAFF" | "INSTRUCTOR";

export interface CurrentUser {
  id: string;
  email: string | null;
  display_name: string;
  role: UserRole;
  is_active: boolean;
}

export interface DevToken {
  token: string;
  role: UserRole;
  name: string;
}
