"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { FileText, ArrowRight, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { devLogin, getDevTokens } from "@/lib/api/auth";
import { useAuth } from "@/lib/auth/context";
import { Button } from "@/components";
import { cn } from "@/lib/utils";

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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-canvas px-4">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-violet/5" />

      {/* Floating decorative elements */}
      <div className="absolute left-1/4 top-1/4 h-64 w-64 rounded-full bg-accent/5 blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 h-64 w-64 rounded-full bg-violet/5 blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative w-full max-w-md"
      >
        <div className="surface-card p-8">
          {/* Logo */}
          <div className="flex flex-col items-center text-center">
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-violet shadow-lg shadow-accent/20"
            >
              <FileText className="h-7 w-7 text-white" />
            </motion.div>
            <motion.h1
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="mt-5 text-2xl font-bold tracking-tight text-ink"
            >
              Welcome to ExamFlow
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="mt-2 text-sm text-ink-2"
            >
              Sign in to manage your examinations
            </motion.p>
          </div>

          {/* Form */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-8 space-y-5"
          >
            {/* Dev mode warning */}
            <div className="rounded-lg border border-warning/20 bg-warning/5 p-3">
              <div className="flex items-center gap-2 text-xs font-medium text-warning">
                <Sparkles className="h-3.5 w-3.5" />
                Development Mode
              </div>
              <p className="mt-1 text-xs text-ink-2">
                Select a test user below. Production uses SSO authentication.
              </p>
            </div>

            {/* User select */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-ink">
                Select User
              </label>
              <select
                value={selectedToken}
                onChange={(e) => setSelectedToken(e.target.value)}
                className={cn(
                  "w-full rounded-lg border bg-surface px-4 py-2.5 text-sm text-ink transition-colors",
                  "border-line hover:border-line-strong",
                  "focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20",
                  "disabled:cursor-not-allowed disabled:opacity-50"
                )}
              >
                <option value="">Choose a user...</option>
                {tokens.map((t) => (
                  <option key={t.token} value={t.token}>
                    {t.name} ({t.role})
                  </option>
                ))}
              </select>
            </div>

            {/* Error message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-lg border border-danger/20 bg-danger/5 p-3 text-sm text-danger"
              >
                {error}
              </motion.div>
            )}

            {/* Submit button */}
            <Button
              onClick={handleLogin}
              disabled={!selectedToken}
              loading={signingIn}
              className="w-full"
              size="lg"
            >
              {signingIn ? (
                "Signing in..."
              ) : (
                <>
                  Sign in
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>

            {/* Footer text */}
            <p className="text-center text-xs text-ink-3">
              University Examination Administration System
            </p>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
