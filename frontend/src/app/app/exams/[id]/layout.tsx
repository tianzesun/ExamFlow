"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { AlertTriangle, ArrowRight, Calendar, Check, Clock, LayoutGrid, List, Timer, LayoutDashboard } from "lucide-react";
import { getExam } from "@/lib/api/exams";
import { getExamSummary, type ExamSummary } from "@/lib/api/readiness";
import { Exam } from "@/lib/types";
import { Badge, STATUS_BADGES } from "@/components/badge";
import { Button } from "@/components/button";
import { PageContainer } from "@/components/page-header";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  EXAM_UPDATED_EVENT, ExamWorkspaceContext, computeSteps, nextStep, type WorkspaceStep,
} from "@/components/exam/workspace";
import { formatDateLong, formatRelative, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  CONFIGURED: "Configured",
  READY: "Ready",
  GENERATED: "Generated",
  COMPLETED: "Completed",
  ARCHIVED: "Archived",
};

function displayTitle(exam: Exam) {
  // Exam names are often "CODE — Course name"; the code is already shown as the eyebrow.
  const prefix = `${exam.course_code} — `;
  return exam.exam_name.startsWith(prefix) ? exam.exam_name.slice(prefix.length) : exam.exam_name;
}

function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

function StepMarker({ step }: { step: WorkspaceStep }) {
  return (
    <span
      className={cn(
        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tnum",
        step.state === "done" && "bg-success text-white",
        step.state === "current" && "bg-grad-primary text-white shadow-[var(--glow-accent)]",
        step.state === "attention" && "bg-warning/15 text-warning ring-1 ring-warning/40",
        step.state === "todo" && "bg-surface text-ink-3 ring-1 ring-line-strong",
      )}
    >
      {step.state === "done" ? (
        <Check className="h-3.5 w-3.5" strokeWidth={3} />
      ) : step.state === "attention" ? (
        <AlertTriangle className="h-3 w-3" />
      ) : (
        step.number
      )}
    </span>
  );
}

export default function ExamWorkspaceLayout({ children }: { children: ReactNode }) {
  const params = useParams();
  const pathname = usePathname();
  const examId = params.id as string;
  const base = `/app/exams/${examId}`;

  const [exam, setExam] = useState<Exam | null>(null);
  const [progress, setProgress] = useState<ExamSummary | null>(null);
  const [failed, setFailed] = useState(false);

  const loadProgress = useCallback(
    () => getExamSummary(examId).then(setProgress).catch(() => {}),
    [examId],
  );

  useEffect(() => {
    let cancelled = false;
    getExam(examId)
      .then((e) => { if (!cancelled) setExam(e); })
      .catch(() => { if (!cancelled) setFailed(true); });
    const onUpdate = (ev: Event) => {
      const detail = (ev as CustomEvent<Exam | undefined>).detail;
      if (detail && detail.id === examId) setExam(detail);
      else getExam(examId).then((e) => { if (!cancelled) setExam(e); }).catch(() => {});
      loadProgress();
    };
    window.addEventListener(EXAM_UPDATED_EVENT, onUpdate);
    return () => {
      cancelled = true;
      window.removeEventListener(EXAM_UPDATED_EVENT, onUpdate);
    };
  }, [examId, loadProgress]);

  // Refresh progress whenever the user moves between steps.
  useEffect(() => {
    loadProgress();
  }, [pathname, loadProgress]);

  const activeSegment = pathname.startsWith(`${base}/`) ? pathname.slice(base.length + 1).split("/")[0] : "";
  const steps = useMemo(() => computeSteps(exam, progress), [exam, progress]);
  const next = progress ? nextStep(steps) : undefined;
  const inSeats = activeSegment === "seating" || activeSegment === "seat-map";
  const isActive = (step: WorkspaceStep) =>
    step.key === "seats" ? inSeats : activeSegment === step.segment;
  // An earlier step that must be done before the one being viewed (exam day only needs papers).
  const activeStep = steps.find(isActive);
  const blocker =
    progress && activeStep
      ? steps.find((st) => st.number < activeStep.number && st.state !== "done" && !(st.key === "seats" && activeStep.key === "papers" && (progress.assigned_count ?? 0) > 0))
      : undefined;
  const workspace = useMemo(() => ({ exam, progress, steps }), [exam, progress, steps]);

  return (
    <ExamWorkspaceContext.Provider value={workspace}>
      <PageContainer className="space-y-6">
        <div className="print:hidden">
          {/* Workspace header */}
          <header className="hero-panel animate-rise flex flex-col gap-4 px-6 py-6 sm:flex-row sm:items-end sm:justify-between sm:px-7">
            {exam ? (
              <div className="min-w-0">
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">
                  {exam.course_code} · {exam.term} {exam.academic_year}
                </p>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="truncate text-2xl font-semibold tracking-tight text-white sm:text-[28px]">{displayTitle(exam)}</h1>
                  <span className="dark">
                    <Badge variant={STATUS_BADGES[exam.status] || "default"}>
                      {STATUS_LABELS[exam.status] || exam.status}
                    </Badge>
                  </span>
                </div>
                <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-white/85">
                  <span className="hero-chip inline-flex items-center gap-1.5 rounded-full px-3 py-1">
                    <Calendar className="h-3.5 w-3.5 text-white/60" />
                    {formatDateLong(exam.exam_date)}
                    <span className="text-white/60">({formatRelative(exam.exam_date)})</span>
                  </span>
                  <span className="hero-chip inline-flex items-center gap-1.5 rounded-full px-3 py-1">
                    <Clock className="h-3.5 w-3.5 text-white/60" />
                    {formatTime(exam.start_time, "—")}
                  </span>
                  <span className="hero-chip inline-flex items-center gap-1.5 rounded-full px-3 py-1">
                    <Timer className="h-3.5 w-3.5 text-white/60" />
                    {formatDuration(exam.duration_minutes)}
                  </span>
                </p>
              </div>
            ) : failed ? (
              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">Exam</p>
                <h1 className="text-2xl font-semibold tracking-tight text-white">Exam unavailable</h1>
                <p className="mt-1 text-sm text-white/70">This exam could not be loaded.</p>
              </div>
            ) : (
              <div className="space-y-2">
                <Skeleton className="h-3 w-32 bg-white/15" />
                <Skeleton className="h-7 w-80 bg-white/15" />
                <Skeleton className="h-4 w-64 bg-white/15" />
              </div>
            )}
            {next && activeSegment !== "" && !isActive(next) && !blocker && (
              <Link href={`${base}/${next.segment}`} className="shrink-0">
                <Button variant="secondary" className="border-transparent bg-white text-[#1e2f86] hover:bg-white/90">
                  Next: {next.action}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            )}
          </header>

          {/* Step navigation: the order is the order of work. */}
          <nav aria-label="Exam setup steps" className="mt-6 overflow-x-auto [scrollbar-width:none]">
            <ol className="flex min-w-max gap-2 lg:grid lg:min-w-0 lg:grid-cols-[auto_repeat(4,minmax(0,1fr))]">
              <li>
                <Link
                  href={base}
                  aria-current={activeSegment === "" ? "page" : undefined}
                  className={cn(
                    "flex h-full items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-medium transition-colors",
                    activeSegment === ""
                      ? "border-accent/60 bg-surface text-accent shadow-[0_0_0_3px_var(--accent-subtle),var(--shadow-md)]"
                      : "border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink",
                  )}
                >
                  <LayoutDashboard className="h-4 w-4" />
                  Overview
                </Link>
              </li>
              {steps.map((step) => {
                const active = isActive(step);
                return (
                  <li key={step.key} className="min-w-[170px] lg:min-w-0">
                    <Link
                      href={`${base}/${step.segment}`}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex h-full items-center gap-3 rounded-xl border px-3.5 py-3 transition-all duration-150",
                        active
                          ? "border-accent/60 bg-surface shadow-[0_0_0_3px_var(--accent-subtle),var(--shadow-md)]"
                          : "border-line bg-surface hover:-translate-y-0.5 hover:border-line-strong hover:shadow-[var(--shadow-md)]",
                      )}
                    >
                      <StepMarker step={step} />
                      <span className="min-w-0">
                        <span className={cn("block truncate text-sm font-medium", active ? "text-accent" : "text-ink")}>
                          {step.label}
                        </span>
                        <span
                          className={cn(
                            "block truncate text-xs",
                            step.state === "attention" ? "text-warning" : "text-ink-3",
                          )}
                        >
                          {progress ? step.status : " "}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </nav>

          {inSeats && (
            <div className="mt-4 inline-flex rounded-lg border border-line bg-surface p-0.5 text-sm" role="tablist" aria-label="Seat views">
              {[
                { segment: "seating", label: "Rooms & assignments", icon: List },
                { segment: "seat-map", label: "Seat map", icon: LayoutGrid },
              ].map((v) => (
                <Link
                  key={v.segment}
                  href={`${base}/${v.segment}`}
                  role="tab"
                  aria-selected={activeSegment === v.segment}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-md px-3 font-medium transition-colors",
                    activeSegment === v.segment ? "bg-surface-hover text-ink" : "text-ink-3 hover:text-ink",
                  )}
                >
                  <v.icon className="h-3.5 w-3.5" />
                  {v.label}
                </Link>
              ))}
            </div>
          )}
        </div>

        {blocker && (
          <div role="status" className="flex flex-col gap-3 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
            <p className="flex items-start gap-2 text-sm text-ink">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <span>
                <span className="font-medium">Step {blocker.number} ({blocker.label}) isn&rsquo;t finished yet.</span>{" "}
                <span className="text-ink-2">{blocker.description}</span>
              </span>
            </p>
            <Link href={`${base}/${blocker.segment}`} className="shrink-0">
              <Button size="sm" variant="secondary">
                Go to step {blocker.number} <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        )}

        {children}
      </PageContainer>
    </ExamWorkspaceContext.Provider>
  );
}
