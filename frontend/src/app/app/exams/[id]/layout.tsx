"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { ArrowRight, Calendar, Clock, Timer } from "lucide-react";
import { getExam } from "@/lib/api/exams";
import { Exam } from "@/lib/types";
import { Badge, STATUS_BADGES } from "@/components/badge";
import { Button } from "@/components/button";
import { PageContainer } from "@/components/page-header";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatDateLong, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Pages in this workspace dispatch this (with the updated Exam as detail) after mutating the exam. */
const EXAM_UPDATED_EVENT = "examflow:exam-updated";

const TABS = [
  { label: "Overview", segment: "" },
  { label: "Roster", segment: "roster" },
  { label: "Seating", segment: "seating" },
  { label: "Seat map", segment: "seat-map" },
  { label: "Documents", segment: "documents" },
  { label: "Administration", segment: "administration" },
] as const;

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  CONFIGURED: "Configured",
  READY: "Ready",
  GENERATED: "Generated",
  COMPLETED: "Completed",
  ARCHIVED: "Archived",
};

const NEXT_STEP: Record<string, { label: string; segment: string }> = {
  DRAFT: { label: "Set up roster", segment: "roster" },
  CONFIGURED: { label: "Assign seating", segment: "seating" },
  READY: { label: "Generate documents", segment: "documents" },
  GENERATED: { label: "Prepare administration", segment: "administration" },
  COMPLETED: { label: "View documents", segment: "documents" },
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

export default function ExamWorkspaceLayout({ children }: { children: ReactNode }) {
  const params = useParams();
  const pathname = usePathname();
  const examId = params.id as string;
  const base = `/app/exams/${examId}`;

  const [exam, setExam] = useState<Exam | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getExam(examId)
      .then((e) => { if (!cancelled) setExam(e); })
      .catch(() => { if (!cancelled) setFailed(true); });
    const onUpdate = (ev: Event) => {
      const detail = (ev as CustomEvent<Exam | undefined>).detail;
      if (detail && detail.id === examId) setExam(detail);
      else getExam(examId).then((e) => { if (!cancelled) setExam(e); }).catch(() => {});
    };
    window.addEventListener(EXAM_UPDATED_EVENT, onUpdate);
    return () => {
      cancelled = true;
      window.removeEventListener(EXAM_UPDATED_EVENT, onUpdate);
    };
  }, [examId]);

  const activeSegment = pathname.startsWith(`${base}/`) ? pathname.slice(base.length + 1).split("/")[0] : "";
  const next = exam ? NEXT_STEP[exam.status] : undefined;

  return (
    <PageContainer className="space-y-6">
      <div className="print:hidden">
        {/* Workspace header */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          {exam ? (
            <div className="min-w-0">
              <p className="eyebrow mb-1.5">
                {exam.course_code} · {exam.term} {exam.academic_year}
              </p>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="truncate text-2xl font-semibold tracking-tight text-ink">{displayTitle(exam)}</h1>
                <Badge variant={STATUS_BADGES[exam.status] || "default"}>
                  {STATUS_LABELS[exam.status] || exam.status}
                </Badge>
              </div>
              <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-2">
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-ink-3" />
                  {formatDateLong(exam.exam_date)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-ink-3" />
                  {formatTime(exam.start_time, "—")}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Timer className="h-3.5 w-3.5 text-ink-3" />
                  {formatDuration(exam.duration_minutes)}
                </span>
              </p>
            </div>
          ) : failed ? (
            <div>
              <p className="eyebrow mb-1.5">Exam</p>
              <h1 className="text-2xl font-semibold tracking-tight text-ink">Exam unavailable</h1>
              <p className="mt-1 text-sm text-ink-2">This exam could not be loaded.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-7 w-80" />
              <Skeleton className="h-4 w-64" />
            </div>
          )}
          {next && activeSegment !== next.segment && (
            <Link href={`${base}/${next.segment}`} className="shrink-0">
              <Button>
                {next.label}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          )}
        </header>

        {/* Sub-navigation */}
        <nav aria-label="Exam sections" className="mt-6 overflow-x-auto shadow-[inset_0_-1px_0_var(--line)] [scrollbar-width:none]">
          <ul className="flex min-w-max gap-1">
            {TABS.map((tab) => {
              const active = activeSegment === tab.segment;
              return (
                <li key={tab.label}>
                  <Link
                    href={tab.segment ? `${base}/${tab.segment}` : base}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative inline-flex h-10 items-center border-b-2 px-3 text-sm font-medium transition-colors",
                      active
                        ? "border-accent text-ink"
                        : "border-transparent text-ink-3 hover:border-line-strong hover:text-ink",
                    )}
                  >
                    {tab.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>

      {children}
    </PageContainer>
  );
}
