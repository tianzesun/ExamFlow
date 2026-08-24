"use client";

import { AuthProvider, useAuth } from "@/lib/auth/context";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";

function AppContent({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
        <p className="text-zinc-600 dark:text-zinc-400">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <nav className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <Link href="/app" className="text-lg font-bold text-black dark:text-white">
            ExamFlow
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/app"
              className={`text-sm ${
                pathname === "/app"
                  ? "font-medium text-black dark:text-white"
                  : "text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-white"
              }`}
            >
              Home
            </Link>
            <Link
              href="/app/courses"
              className={`text-sm ${
                pathname.startsWith("/app/courses")
                  ? "font-medium text-black dark:text-white"
                  : "text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-white"
              }`}
            >
              Courses
            </Link>
            <Link
              href="/app/exams"
              className={`text-sm ${
                pathname.startsWith("/app/exams")
                  ? "font-medium text-black dark:text-white"
                  : "text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-white"
              }`}
            >
              Exams
            </Link>
            <Link
              href="/app/rooms"
              className={`text-sm ${
                pathname.startsWith("/app/rooms")
                  ? "font-medium text-black dark:text-white"
                  : "text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-white"
              }`}
            >
              Rooms
            </Link>
            {user.role === "ADMIN" && (
              <Link
                href="/app/admin"
                className={`text-sm ${
                  pathname === "/app/admin"
                    ? "font-medium text-black dark:text-white"
                    : "text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-white"
                }`}
              >
                Admin
              </Link>
            )}
            <div className="border-l border-zinc-200 pl-4 dark:border-zinc-800">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {user.display_name}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-500">
                {user.role}
              </p>
            </div>
            <button
              onClick={() => {
                logout();
                router.push("/login");
              }}
              className="text-sm text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-white"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>
      <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AppContent>{children}</AppContent>
    </AuthProvider>
  );
}
