"use client";

import { useAuth } from "@/lib/auth/context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function AdminPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [adminTest, setAdminTest] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user && user.role !== "ADMIN") {
      router.push("/app");
    }
  }, [user, router]);

  useEffect(() => {
    if (user?.role === "ADMIN") {
      fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/admin/test`, {
        credentials: "include",
      })
        .then((res) => {
          if (!res.ok) throw new Error("Failed to access admin endpoint");
          return res.json();
        })
        .then((data) => setAdminTest(data.message))
        .catch((err) => setError(err.message));
    }
  }, [user]);

  if (!user || user.role !== "ADMIN") {
    return null;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-black dark:text-white">
        Admin Area
      </h1>

      <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-lg font-medium text-black dark:text-white">
          Admin Test Endpoint
        </h2>
        {error ? (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : adminTest ? (
          <p className="mt-2 text-sm text-green-600 dark:text-green-400">
            {adminTest}
          </p>
        ) : (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Loading...
          </p>
        )}
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-lg font-medium text-black dark:text-white">
          Phase 1 - Admin Authorization
        </h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          This page is only accessible to ADMIN users.
          Backend authorization is enforced.
        </p>
      </div>
    </div>
  );
}
