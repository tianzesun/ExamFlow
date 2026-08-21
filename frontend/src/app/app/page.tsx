"use client";

import { useAuth } from "@/lib/auth/context";

export default function AppPage() {
  const { user } = useAuth();

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-black dark:text-white">
        ExamFlow
      </h1>
      
      <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-lg font-medium text-black dark:text-white">
          Authenticated User
        </h2>
        <dl className="mt-4 space-y-2">
          <div>
            <dt className="text-sm text-zinc-500 dark:text-zinc-500">Name</dt>
            <dd className="text-sm font-medium text-black dark:text-white">
              {user.display_name}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-zinc-500 dark:text-zinc-500">Email</dt>
            <dd className="text-sm font-medium text-black dark:text-white">
              {user.email || "Not provided"}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-zinc-500 dark:text-zinc-500">Role</dt>
            <dd className="text-sm font-medium text-black dark:text-white">
              {user.role}
            </dd>
          </div>
        </dl>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-lg font-medium text-black dark:text-white">
          Phase 1 - Application Foundation
        </h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Authentication and authorization infrastructure is working.
          Examination business functionality will be implemented in later phases.
        </p>
      </div>
    </div>
  );
}
