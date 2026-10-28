"use client";

import { useState, useEffect, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CalendarClock,
  Check,
  FileText,
  FlaskConical,
  GraduationCap,
  LayoutGrid,
  ShieldCheck,
  UserCog,
  type LucideIcon,
} from "lucide-react";
import { motion } from "framer-motion";
import { devLogin, getDevTokens } from "@/lib/api/auth";
import { useAuth } from "@/lib/auth/context";
import { Button } from "@/components";
import { cn } from "@/lib/utils";

const ROLE_META: Record<string, { label: string; description: string; icon: LucideIcon }> = {
  ADMIN: { label: "Admin", description: "Full access, including rooms and settings", icon: ShieldCheck },
  STAFF: { label: "Staff", description: "Exam office scheduling and seating", icon: UserCog },
  INSTRUCTOR: { label: "Instructor", description: "Own courses, exams and documents", icon: GraduationCap },
};

const FEATURES: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: CalendarClock, title: "Exam scheduling", text: "Plan sittings, rooms and invigilation in one place." },
  { icon: LayoutGrid, title: "Seating plans", text: "Assign seats automatically and adjust on a live map." },
  { icon: FileText, title: "Document generation", text: "Produce cover pages, seating lists and attendance sheets." },
];

/* The brand panel stays navy in both themes, so its text is always white. */
const DOT_STYLE = { "--line-strong": "color-mix(in srgb, var(--canvas) 16%, transparent)" } as CSSProperties;

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
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load dev tokens")
      )
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

  return (
    <div className="flex min-h-screen flex-col bg-canvas lg:flex-row">
      {/* Brand panel — full height on desktop, compact header on mobile */}
      <aside className="relative overflow-hidden bg-brand-panel text-white lg:flex lg:w-[44%] lg:max-w-[640px] lg:flex-col">
        <div className="dot-grid absolute inset-0 opacity-70" style={DOT_STYLE} aria-hidden />
        <div
          className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-violet/25 blur-3xl"
          aria-hidden
        />
        <div className="relative flex flex-1 flex-col px-6 py-6 sm:px-10 lg:px-12 lg:py-12">
          <Wordmark />

          <div className="mt-5 lg:mt-auto">
            <h2 className="max-w-md text-lg font-semibold leading-snug tracking-tight lg:text-[32px] lg:leading-[1.15]">
              Exam administration, from timetable to test day.
            </h2>
            <ul className="mt-10 hidden space-y-6 lg:block">
              {FEATURES.map((f) => (
                <li key={f.title} className="flex gap-3.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-canvas/10 ring-1 ring-inset ring-canvas/15">
                    <f.icon className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">{f.title}</p>
                    <p className="mt-0.5 text-sm text-white/70">{f.text}</p>
                  </div>
                </li>
              ))}
            </ul>
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 lg:hidden">
              {FEATURES.map((f) => (
                <li key={f.title} className="inline-flex items-center gap-1.5 text-xs text-white/80">
                  <f.icon className="h-3.5 w-3.5" />
                  {f.title}
                </li>
              ))}
            </ul>
          </div>

          <p className="mt-auto hidden pt-12 text-xs text-white/60 lg:block">
            University Examination Administration System
          </p>
        </div>
      </aside>

      {/* Sign-in */}
      <main className="flex flex-1 items-start justify-center px-4 py-8 sm:items-center sm:px-6 lg:py-12">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="w-full max-w-[420px]"
        >
          <div className="surface-card p-6 shadow-[var(--shadow-md)] sm:p-8">
            <h1 className="text-xl font-semibold tracking-tight text-ink">Sign in</h1>
            <p className="mt-1 text-sm text-ink-2">Choose a test account to continue.</p>

            <div className="mt-5 flex items-start gap-2.5 rounded-lg border border-warning/25 bg-warning/5 px-3 py-2.5">
              <FlaskConical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
              <p className="text-xs leading-relaxed text-ink-2">
                <span className="font-medium text-warning">Development mode.</span> Select a test
                user below. Production uses SSO authentication.
              </p>
            </div>

            <fieldset className="mt-6">
              <legend className="eyebrow mb-2">Test user</legend>
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-[60px] animate-pulse rounded-lg border border-line bg-surface-2" />
                  ))}
                </div>
              ) : tokens.length === 0 ? (
                <p className="rounded-lg border border-dashed border-line-strong px-3 py-4 text-sm text-ink-3">
                  No test users are available.
                </p>
              ) : (
                <div role="radiogroup" className="space-y-2">
                  {tokens.map((t) => {
                    const meta = ROLE_META[t.role] ?? {
                      label: t.role,
                      description: "Test account",
                      icon: UserCog,
                    };
                    const selected = selectedToken === t.token;
                    const Icon = meta.icon;
                    return (
                      <button
                        key={t.token}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setSelectedToken(t.token)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-[border-color,background-color,box-shadow]",
                          "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/20",
                          selected
                            ? "border-accent bg-accent-subtle ring-1 ring-accent"
                            : "border-line-strong bg-surface hover:border-ink-3/50 hover:bg-surface-hover"
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                            selected ? "bg-accent text-canvas" : "bg-surface-hover text-ink-2"
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="text-sm font-medium text-ink">{meta.label}</span>
                            <span className="truncate text-xs text-ink-3">{t.name}</span>
                          </span>
                          <span className="block truncate text-xs text-ink-2">{meta.description}</span>
                        </span>
                        <span
                          className={cn(
                            "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                            selected ? "border-accent bg-accent text-canvas" : "border-line-strong"
                          )}
                          aria-hidden
                        >
                          {selected && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </fieldset>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 rounded-lg border border-danger/20 bg-danger/5 p-3 text-sm text-danger"
                role="alert"
              >
                {error}
              </motion.div>
            )}

            <Button
              onClick={handleLogin}
              disabled={!selectedToken}
              loading={signingIn}
              className="mt-6 w-full"
              size="lg"
            >
              {signingIn ? (
                "Signing in…"
              ) : (
                <>
                  Sign in
                  <ArrowRight />
                </>
              )}
            </Button>
          </div>

          <p className="mt-4 text-center text-xs text-ink-3 lg:hidden">
            University Examination Administration System
          </p>
        </motion.div>
      </main>
    </div>
  );
}

function Wordmark() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-canvas text-brand shadow-[var(--shadow-sm)]">
        <FileText className="h-4 w-4" />
      </span>
      <span className="text-base font-semibold tracking-tight">ExamFlow</span>
    </div>
  );
}
