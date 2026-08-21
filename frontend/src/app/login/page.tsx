"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { devLogin, getDevTokens } from "@/lib/api/auth";
import { DevToken } from "@/lib/auth/types";

export default function LoginPage() {
  const router = useRouter();
  const [tokens, setTokens] = useState<DevToken[]>([]);
  const [selectedToken, setSelectedToken] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDevTokens()
      .then(setTokens)
      .catch(() => setError("Failed to load development tokens"));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedToken) return;

    setIsLoading(true);
    setError(null);

    try {
      await devLogin(selectedToken);
      router.push("/app");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
      <div className="w-full max-w-md space-y-8 rounded-lg border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-black dark:text-white">
            ExamFlow
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Development Authentication
          </p>
          <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
            DEVELOPMENT ONLY - Not for production use
          </p>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-4 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="token"
              className="block text-sm font-medium text-zinc-900 dark:text-zinc-100"
            >
              Select Development User
            </label>
            <select
              id="token"
              value={selectedToken}
              onChange={(e) => setSelectedToken(e.target.value)}
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              required
            >
              <option value="">Select a user...</option>
              {tokens.map((t) => (
                <option key={t.token} value={t.token}>
                  {t.name} ({t.role})
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={isLoading || !selectedToken}
            className="w-full rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            {isLoading ? "Signing in..." : "Sign in (Development)"}
          </button>
        </form>

        <div className="text-center text-xs text-zinc-500 dark:text-zinc-500">
          Phase 1 - Development Authentication
        </div>
      </div>
    </div>
  );
}
