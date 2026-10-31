"use client";

import { Suspense, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Check,
  FileText,
  GraduationCap,
  LayoutGrid,
  Lock,
  Printer,
  ShieldCheck,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import { devLogin, getDevTokens } from "@/lib/api/auth";
import { ApiError, errorReference } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/context";
import type { DevToken } from "@/lib/auth/types";
import { Button } from "@/components";
import { cn } from "@/lib/utils";

const ROLE_META: Record<string, { label: string; description: string; icon: LucideIcon }> = {
  ADMIN: { label: "Administrator", description: "Everything, including rooms and settings", icon: ShieldCheck },
  STAFF: { label: "Exam office staff", description: "Rosters, seating and exam papers", icon: UserCog },
  INSTRUCTOR: { label: "Instructor", description: "View courses, exams and seating", icon: GraduationCap },
};

const STEPS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Users, title: "Students", text: "Import the roster for each exam." },
  { icon: LayoutGrid, title: "Seats", text: "Seat everyone by rule, then fine-tune on the map." },
  { icon: Printer, title: "Exam papers", text: "Every paper printed with the student's room and seat." },
];

// Remembers which test account was used last, so signing back in is one click.
const LAST_ROLE_KEY = "examflow_last_role";

/** Only return to pages inside the app, never to another site. */
function safeNext(next: string | null): string {
  return next && next.startsWith("/app") && !next.startsWith("//") ? next : "/app";
}

export default function LoginPage() {
  // useSearchParams (for ?next= after signing in) needs a Suspense boundary.
  return (
    <Suspense fallback={null}>
      <LoginScreen />
    </Suspense>
  );
}

function LoginScreen() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const { user, loading: userLoading, refreshUser } = useAuth();
  const [tokens, setTokens] = useState<DevToken[]>([]);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(true);
  // Test sign-in is switched off on this server (it answers 403).
  const [unavailable, setUnavailable] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState("");
  const options = useRef<(HTMLButtonElement | null)[]>([]);

  // Already signed in: go straight on.
  useEffect(() => {
    if (!userLoading && user) router.replace(next);
  }, [user, userLoading, next, router]);

  useEffect(() => {
    getDevTokens()
      .then((list) => {
        setTokens(list);
        const last = localStorage.getItem(LAST_ROLE_KEY);
        setSelected((list.find((t) => t.role === last) ?? list[0])?.token ?? "");
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) setUnavailable(true);
        else setError(`Sign-in options couldn't be loaded. Reload the page to try again.${errorReference(err)}`);
      })
      .finally(() => setLoading(false));
  }, []);

  const signIn = async (token = selected) => {
    if (!token || signingIn) return;
    setSigningIn(true);
    setError("");
    try {
      await devLogin(token);
      const role = tokens.find((t) => t.token === token)?.role;
      if (role) localStorage.setItem(LAST_ROLE_KEY, role);
      await refreshUser();
      router.replace(next);
    } catch (err) {
      setError(`You couldn't be signed in. Try again.${errorReference(err)}`);
      setSigningIn(false);
    }
  };

  // Arrow keys move through the accounts like any radio group; Enter signs in.
  const onOptionKey = (e: KeyboardEvent, index: number) => {
    const step = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
    if (step) {
      e.preventDefault();
      const i = (index + step + tokens.length) % tokens.length;
      setSelected(tokens[i].token);
      options.current[i]?.focus();
    } else if (e.key === "Enter") {
      e.preventDefault();
      signIn(tokens[index].token);
    }
  };

  const selectedRole = ROLE_META[tokens.find((t) => t.token === selected)?.role ?? ""]?.label;

  return (
    <div className="flex min-h-screen flex-col bg-canvas lg:flex-row">
      <BrandPanel />

      <main className="flex flex-1 flex-col px-4 py-8 sm:px-6 lg:py-12">
        <div className="flex flex-1 items-start justify-center sm:items-center">
          {/* A CSS entrance, so the form shows even if scripts are slow to start. */}
          <div className="w-full max-w-[420px] animate-scale-in">
            <div className="surface-card p-6 shadow-[var(--shadow-md)] sm:p-8">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h1 className="text-xl font-semibold tracking-tight text-ink">Sign in to ExamFlow</h1>
                  <p className="mt-1 text-sm text-ink-2">Exam administration for University of Toronto staff.</p>
                </div>
                {!unavailable && (
                  <span className="shrink-0 rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-[11px] font-medium text-warning">
                    Test sign-in
                  </span>
                )}
              </div>

              {unavailable ? (
                <div className="mt-6 flex gap-3 rounded-lg border border-line bg-surface-2 px-4 py-4">
                  <Lock className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" />
                  <div className="text-sm">
                    <p className="font-medium text-ink">Sign-in isn&apos;t set up on this server yet</p>
                    <p className="mt-1 text-ink-2">Ask your ExamFlow administrator for access.</p>
                  </div>
                </div>
              ) : (
                <fieldset className="mt-6" disabled={signingIn}>
                  <legend className="eyebrow mb-2">Choose an account</legend>
                  {loading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="h-[62px] animate-pulse rounded-lg border border-line bg-surface-2" />
                      ))}
                    </div>
                  ) : tokens.length === 0 ? (
                    !error && (
                      <p className="rounded-lg border border-dashed border-line-strong px-3 py-4 text-sm text-ink-3">
                        No accounts are available.
                      </p>
                    )
                  ) : (
                    <div role="radiogroup" aria-label="Account" className="space-y-2">
                      {tokens.map((t, i) => {
                        const meta = ROLE_META[t.role] ?? { label: t.role, description: t.name, icon: UserCog };
                        const isSelected = selected === t.token;
                        const Icon = meta.icon;
                        return (
                          <button
                            key={t.token}
                            ref={(el) => { options.current[i] = el; }}
                            type="button"
                            role="radio"
                            aria-checked={isSelected}
                            tabIndex={isSelected || (!selected && i === 0) ? 0 : -1}
                            onClick={() => setSelected(t.token)}
                            onDoubleClick={() => signIn(t.token)}
                            onKeyDown={(e) => onOptionKey(e, i)}
                            className={cn(
                              "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-[border-color,background-color,box-shadow]",
                              "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/20",
                              isSelected
                                ? "border-accent bg-accent-subtle ring-1 ring-accent"
                                : "border-line-strong bg-surface hover:border-ink-3/50 hover:bg-surface-hover",
                            )}
                          >
                            <span
                              className={cn(
                                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                                isSelected ? "bg-accent text-canvas" : "bg-surface-hover text-ink-2",
                              )}
                            >
                              <Icon className="h-4 w-4" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-medium text-ink">{meta.label}</span>
                              <span className="block truncate text-xs text-ink-2">{meta.description}</span>
                            </span>
                            <span
                              className={cn(
                                "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                                isSelected ? "border-accent bg-accent text-canvas" : "border-line-strong",
                              )}
                              aria-hidden
                            >
                              {isSelected && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </fieldset>
              )}

              {error && (
                <div
                  className="mt-4 animate-fade-in rounded-lg border border-danger/20 bg-danger/5 p-3 text-sm text-danger"
                  role="alert"
                >
                  {error}
                </div>
              )}

              {!unavailable && (
                <>
                  <Button
                    onClick={() => signIn()}
                    disabled={!selected}
                    loading={signingIn}
                    className="mt-6 w-full"
                    size="lg"
                  >
                    {signingIn ? "Signing in…" : (
                      <>
                        {selectedRole ? `Continue as ${selectedRole.toLowerCase()}` : "Continue"}
                        <ArrowRight />
                      </>
                    )}
                  </Button>
                  <p className="mt-4 text-center text-xs leading-relaxed text-ink-3">
                    Test accounts are for development and pilot servers only.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>

        <footer className="mt-8 text-center text-xs text-ink-3">
          ExamFlow · Examination administration
        </footer>
      </main>
    </div>
  );
}

function BrandPanel() {
  return (
    <aside
      className="relative overflow-hidden text-white lg:flex lg:w-[46%] lg:max-w-[680px] lg:flex-col"
      style={{ background: "var(--grad-hero)" }}
    >
      {/* Fine grid and a soft glow, as on the app's hero banners. */}
      <div
        className="absolute inset-0 opacity-60 [background-image:linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:28px_28px]"
        aria-hidden
      />
      <div className="absolute -right-24 -top-32 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(167,139,250,0.5),transparent_65%)]" aria-hidden />

      <div className="relative flex flex-1 flex-col px-6 py-6 sm:px-10 lg:px-14 lg:py-12">
        <Wordmark />

        <div className="mt-6 lg:my-auto lg:py-10">
          <h2 className="max-w-md text-lg font-semibold leading-snug tracking-tight lg:text-[34px] lg:leading-[1.15]">
            Every student in the right seat, with it printed on their paper.
          </h2>

          <PaperPreview />

          <ol className="mt-10 hidden space-y-5 lg:block">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-3.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-inset ring-white/15">
                  <s.icon className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold">
                    <span className="tnum mr-1.5 text-white/50">{i + 1}</span>
                    {s.title}
                  </p>
                  <p className="mt-0.5 text-sm text-white/70">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <p className="hidden text-xs text-white/55 lg:block">University of Toronto · Examination administration</p>
      </div>
    </aside>
  );
}

/** A small, stylised stamped paper and seat map: what ExamFlow produces. Decorative only. */
function PaperPreview() {
  const taken = new Set([0, 2, 4, 9, 11, 13, 16, 18, 20, 22]);
  return (
    <div className="mt-8 hidden items-end gap-4 lg:flex" aria-hidden>
      <div className="w-[260px] rotate-[-2deg] rounded-lg bg-white p-4 text-ink shadow-[0_24px_48px_-20px_rgba(0,0,0,0.55)]">
        <div className="flex items-start justify-between gap-3 border-b border-ink/70 pb-2.5">
          <div className="min-w-0">
            <p className="text-[8px] text-ink-3">MATA31H3 — Final Examination</p>
            <p className="mt-0.5 truncate text-[13px] font-bold">Alexandra Chen</p>
            <p className="text-[8px] text-ink-2">Student number: 1000000001</p>
          </div>
          <div className="w-[84px] shrink-0 border border-ink text-[7px]">
            <div className="flex items-baseline justify-between border-b border-ink/50 px-1.5 py-1">
              <span className="text-ink-3">ROOM</span>
              <span className="text-[10px] font-bold">IC 130</span>
            </div>
            <div className="flex items-baseline justify-between px-1.5 py-1">
              <span className="text-ink-3">SEAT</span>
              <span className="text-[12px] font-bold">C03</span>
            </div>
          </div>
        </div>
        <div className="mt-3 space-y-1.5">
          {[88, 72, 80, 56].map((w) => (
            <div key={w} className="h-1.5 rounded-full bg-ink/10" style={{ width: `${w}%` }} />
          ))}
        </div>
      </div>

      <div className="rounded-xl bg-white/10 p-3 ring-1 ring-inset ring-white/15 backdrop-blur-sm">
        <p className="mb-2 text-[9px] font-medium uppercase tracking-wider text-white/60">IC 130 · Seat map</p>
        <div className="grid grid-cols-6 gap-1">
          {Array.from({ length: 24 }).map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-3.5 w-3.5 rounded-[3px]",
                i === 14 ? "bg-white ring-2 ring-violet-300" : taken.has(i) ? "bg-white/70" : "bg-white/15",
                i % 6 === 2 && "mr-1.5",
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function Wordmark() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-brand shadow-[var(--shadow-sm)]">
        <FileText className="h-4 w-4" />
      </span>
      <span className="text-base font-semibold tracking-tight">ExamFlow</span>
    </div>
  );
}
