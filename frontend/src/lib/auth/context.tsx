"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { CurrentUser } from "./types";
import { getCurrentUser, clearToken } from "../api/auth";
import { ApiError } from "../api/client";
import { signOutEntra } from "./entra";

interface AuthContextType {
  user: CurrentUser | null;
  loading: boolean;
  error: string | null;
  /** Signed in with a UTORid that has no ExamFlow role: the server's explanation. */
  denied: string | null;
  /** Reload the signed-in user; resolves to them, or null when not signed in or refused. */
  refreshUser: () => Promise<CurrentUser | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState<string | null>(null);

  const refreshUser = async () => {
    try {
      setLoading(true);
      setError(null);
      setDenied(null);
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      return currentUser;
    } catch (err) {
      setUser(null);
      setError(err instanceof Error ? err.message : "Authentication failed");
      if (err instanceof ApiError && err.status === 403) setDenied(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setUser(null);
    setDenied(null);
    clearToken();
    // A UTORid sign-in also ends the Microsoft session for ExamFlow (this redirects away).
    await signOutEntra().catch(() => {});
  };

  useEffect(() => {
    const fetchUser = async () => {
      await refreshUser();
    };
    fetchUser();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, error, denied, refreshUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

/** The exam office (ADMIN, STAFF) sees every course and does the scheduling; others only view their courses. */
export function isExamOffice(user: CurrentUser | null): boolean {
  return user?.role === "ADMIN" || user?.role === "STAFF";
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
