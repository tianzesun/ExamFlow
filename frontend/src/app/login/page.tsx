"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { FileText, AlertTriangle } from "lucide-react";
import { devLogin, getDevTokens } from "@/lib/api/auth";
import { useAuth } from "@/lib/auth/context";
import { Button, Card, PageLoader } from "@/components";

export default function LoginPage() {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const [tokens, setTokens] = useState<{ token: string; role: string; name: string }[]>([]);
  const [selectedToken, setSelectedToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getDevTokens()
      .then((t) => setTokens(t))
      .catch(() => setError("Failed to load dev tokens"))
      .finally(() => setLoading(false));
  }, []);

  const handleLogin = async () => {
    if (!selectedToken) return;
    setSigningIn(true);
    setError("");
    try {
      await devLogin(selectedToken);
      await refreshUser();
      router.push("/app");
    } catch {
      setError("Invalid token");
    } finally {
      setSigningIn(false);
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-black">
      <Card className="w-full max-w-md p-8">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-black dark:bg-white">
            <FileText className="h-6 w-6 text-white dark:text-black" />
          </div>
          <h1 className="mt-4 text-xl font-bold text-black dark:text-white">Sign in to ExamFlow</h1>
          <p className="mt-1 text-sm text-zinc-500">Select a development token to continue</p>
        </div>

        <div className="mt-6 space-y-4">
          <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
            <div className="flex items-center gap-1.5 font-medium">
              <AlertTriangle className="h-3.5 w-3.5" /> Development Mode
            </div>
            <p className="mt-1">This is for development only. Production uses SSO authentication.</p>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">User</label>
            <select
              value={selectedToken}
              onChange={(e) => setSelectedToken(e.target.value)}
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
            >
              <option value="">Select a user...</option>
              {tokens.map((t) => (
                <option key={t.token} value={t.token}>
                  {t.name} ({t.role})
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}

          <Button
            onClick={handleLogin}
            disabled={!selectedToken}
            loading={signingIn}
            className="w-full"
          >
            Sign in
          </Button>
        </div>
      </Card>
    </div>
  );
}
