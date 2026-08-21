"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { CurrentUser } from "./types";
import { getCurrentUser } from "../api/auth";

interface AuthContextType {
  user: CurrentUser | null;
  loading: boolean;
  error: string | null;
  refreshUser: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshUser = async () => {
    try {
      setLoading(true);
      setError(null);
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    } catch (err) {
      setUser(null);
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    // In production, this would call a logout endpoint
    // and clear the session cookie
  };

  useEffect(() => {
    const fetchUser = async () => {
      await refreshUser();
    };
    fetchUser();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, error, refreshUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
