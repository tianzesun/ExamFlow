"use client";

import { Suspense, useEffect, useMemo, useCallback, useState } from "react";
import Link from "next/link";
import {
  Plus,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Users,
  DoorOpen,
  ArrowRight,
  Upload,
  CalendarDays,
  Sparkles,
} from "lucide-react";
import { useCourseContext } from "@/lib/course-context";
import { useAuth } from "@/lib/auth/context";
import { getAllExams } from "@/lib/api/exams";
import { getExamSummaries } from "@/lib/api/readiness";
import { getCourses } from "@/lib/api/courses";
import { errorReference } from "@/lib/api/client";
import type { ExamSummary } from "@/lib/api/readiness";
import type { Exam } from "@/lib/types";
import { useNow } from "@/hooks/useNow";
import {
  formatDateLong,
  formatDateShort,
  formatMonthDay,
  formatMonthName,
  formatRelative,
  formatTime,
  plural,
} from "@/lib/format";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  STATUS_BADGES,
  Skeleton,
  StatCard,
  type StatCardProps,
  PageContainer,
} from "@/components";
import { PageTransition } from "@/components/page-transition";
import { RosterUploadDialog } from "@/components/dashboard/RosterUploadDialog";
import {
  MOCK_EXAMS_FULL,
  MOCK_COURSES,
  MOCK_SUMMARIES,
} from "@/lib/mock-dashboard";

const STATUS_ORDER: readonly string[] = [
  "DRAFT",
  "CONFIGURED",
  "READY",
  "GENERATED",
  "COMPLETED",
];
const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  CONFIGURED: "Configured",
  READY: "Ready",
  GENERATED: "Generated",
  COMPLETED: "Completed",
  ARCHIVED: "Archived",
};

const STATUS_COLOR: Record<string, string> = {
  DRAFT: "var(--ink-3)",
  CONFIGURED: "var(--accent)",
  READY: "var(--warning)",
  GENERATED: "var(--violet)",
  COMPLETED: "var(--success)",
  ARCHIVED: "var(--line-strong)",
};

const DAY = 86400000;

// ── Helpers ────────────────────────────────────────────────────────────────

function examDateTime(exam: Exam): Date {
  return new Date(`${exam.exam_date}T${exam.start_time || "00:00"}`);
}

/** Exams packages are printed once an exam is GENERATED; earlier means work remains. */
function isPrepared(exam: Exam): boolean {
  return exam.status === "GENERATED" || exam.status === "COMPLETED" || exam.status === "ARCHIVED";
}

function greeting(now: number): string {
  const h = new Date(now).getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

/** Exam counts for each of the next `weeks` weeks, starting at the current Monday. */
function weeklyLoad(exams: Exam[], now: number, weeks = 8) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  // Step with setDate (not ms arithmetic) so DST changes don't shift week boundaries.
  const buckets = Array.from({ length: weeks }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i * 7);
    return { start: d, count: 0 };
  });
  for (const e of exams) {
    const t = examDateTime(e).getTime();
    for (let i = weeks - 1; i >= 0; i--) {
      if (t >= buckets[i].start.getTime()) {
        const end = new Date(buckets[i].start);
        end.setDate(end.getDate() + 7);
        if (t < end.getTime()) buckets[i].count += 1;
        break;
      }
    }
  }
  return buckets;
}

// ── Page-level data loading ────────────────────────────────────────────────

interface DashboardData {
  exams: Exam[];
  summaries: Record<string, ExamSummary>;
  courses: { id: string; course_code: string; course_name: string }[];
}

/**
 * Loads exams for the workspace course (or all) plus per-exam readiness
 * summaries (roster/rooms/seats), which the dashboard KPIs depend on.
 */
function useDashboardData(courseId: string | null) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    // State transitions live in promise callbacks (not the effect body) so the
    // react-hooks/purity rule stays satisfied: the effect only kicks off I/O.
    let cancelled = false;
    Promise.resolve()
      .then(() => {
        if (!cancelled) {
          setLoading(true);
          setError(null);
        }
      })
      .then(async () => {
        if (cancelled) return null as null;
        const [examRes, courseRes] = await Promise.all([
          getAllExams(),
          getCourses(1, 100),
        ]);
        // Fall back to realistic seed data when the backend is unpopulated so
        // the dashboard reads like a shipping product on first run.
        const allExams = examRes.exams;
        const usingMock = allExams.length === 0;
        const sourceExams = usingMock ? MOCK_EXAMS_FULL : allExams;
        const courses = usingMock
          ? MOCK_COURSES
          : courseRes.courses.map((c) => ({
              id: c.id,
              course_code: c.course_code,
              course_name: c.course_name,
            }));

        const visible = courseId
          ? sourceExams.filter((e) => e.course_id === courseId)
          : sourceExams;

        let summaries: Record<string, ExamSummary>;
        if (usingMock) {
          summaries = MOCK_SUMMARIES;
        } else {
          summaries = await getExamSummaries(visible.map((e) => e.id)).catch(() => ({}));
        }

        return {
          exams: visible,
          courses,
          summaries,
        } as DashboardData;
      })
      .then((next) => {
        if (!cancelled && next) setData(next);
      })
      .catch((err) => {
        // Never show sample exams in place of real ones that failed to load.
        if (!cancelled) setError(`Dashboard data couldn't be loaded.${errorReference(err)}`);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  useEffect(() => {
    const cleanup = reload();
    return cleanup;
  }, [reload]);

  return { data, error, loading, reload, courses: data?.courses ?? [] };
}

function DataError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex h-full min-h-[280px] items-center justify-center">
      <div className="text-center">
        <AlertCircle className="mx-auto h-6 w-6 text-danger" />
        <p className="mt-2 text-sm text-ink-2">{message}</p>
        <Button size="sm" variant="secondary" onClick={onRetry} className="mt-3">
          Retry
        </Button>
      </div>
    </div>
  );
}

// ── Header ─────────────────────────────────────────────────────────────────

function WorkspaceHeader({
  exams = [],
  onImported = () => {},
}: {
  exams?: Exam[];
  onImported?: () => void;
}) {
  const { selectedCourseId, courses } = useCourseContext();
  const { user } = useAuth();
  const now = useNow(60_000);
  const [rosterOpen, setRosterOpen] = useState(false);
  const course = courses.find((c) => c.id === selectedCourseId);
  const firstName = (user?.display_name ?? "").split(/\s+/)[0];
  const thisWeek = exams.filter((e) => {
    const d = examDateTime(e).getTime() - now;
    return d >= 0 && d < 7 * DAY;
  }).length;

  return (
    <>
      <section className="hero-panel animate-rise px-6 py-7 sm:px-8 sm:py-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">
              {formatDateLong(new Date(now))}
            </p>
            <h1 className="mt-2 truncate text-3xl font-semibold tracking-tight sm:text-[34px]">
              {course ? course.course_code : `${greeting(now)}${firstName ? `, ${firstName}` : ""}`}
            </h1>
            <p className="mt-1.5 max-w-xl text-sm text-white/70">
              {course ? course.course_name : "Here's where every exam stands across your courses."}
            </p>
            {exams.length > 0 && <div className="mt-5 flex flex-wrap gap-2 text-xs">
              <span className="hero-chip inline-flex items-center gap-1.5 rounded-full px-3 py-1.5">
                <CalendarDays className="h-3.5 w-3.5 text-white/70" />
                <span className="tnum font-semibold">{thisWeek}</span> this week
              </span>
              <span className="hero-chip inline-flex items-center gap-1.5 rounded-full px-3 py-1.5">
                <FileText className="h-3.5 w-3.5 text-white/70" />
                <span className="tnum font-semibold">{exams.length}</span> {exams.length === 1 ? "exam" : "exams"} in view
              </span>
            </div>}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              className="hero-chip text-white hover:bg-white/15 hover:text-white"
              onClick={() => setRosterOpen(true)}
              disabled={!selectedCourseId}
              title={selectedCourseId ? undefined : "Choose a course in the sidebar first"}
            >
              <Upload /> Import students
            </Button>
            <Link href="/app/exams/new">
              <Button variant="secondary" className="border-transparent bg-white text-[#1e2f86] hover:bg-white/90">
                <Plus /> Create exam
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <RosterUploadDialog
        open={rosterOpen}
        onOpenChange={setRosterOpen}
        exams={exams.map((e) => ({ id: e.id, exam_name: e.exam_name }))}
        courseId={selectedCourseId}
        onImported={onImported}
      />
    </>
  );
}

// ── KPIs ───────────────────────────────────────────────────────────────────

function KpiCards({ exams, summaries }: { exams: Exam[]; summaries: Record<string, ExamSummary> }) {
  const now = useNow(60_000);
  const total = exams.length;
  const upcoming = exams.filter((e) => examDateTime(e).getTime() >= now);
  const nextTwoWeeks = upcoming.filter((e) => examDateTime(e).getTime() - now < 14 * DAY).length;
  const soonest = upcoming.reduce<Exam | null>(
    (a, e) => (!a || examDateTime(e) < examDateTime(a) ? e : a),
    null,
  );
  const withRoster = exams.filter((e) => (summaries[e.id]?.roster_count ?? 0) > 0).length;
  const prepared = exams.filter(isPrepared).length;
  const unassigned = exams.reduce((acc, e) => acc + (summaries[e.id]?.unassigned_count ?? 0), 0);
  const assigned = exams.reduce((acc, e) => acc + (summaries[e.id]?.assigned_count ?? 0), 0);

  const cards: StatCardProps[] = [
    {
      icon: CalendarDays,
      label: "Upcoming exams",
      value: upcoming.length,
      hint: nextTwoWeeks > 0
        ? `${nextTwoWeeks} in the next 14 days`
        : soonest
          ? `Next one ${formatRelative(examDateTime(soonest), new Date(now))}`
          : "Nothing scheduled",
      color: "accent",
    },
    {
      icon: Users,
      label: "Students imported",
      value: withRoster,
      hint: `of ${plural(total, "exam")}`,
      progress: withRoster / Math.max(1, total),
      color: "accent",
    },
    {
      icon: CheckCircle2,
      label: "Papers generated",
      value: prepared,
      hint: `of ${plural(total, "exam")}`,
      progress: prepared / Math.max(1, total),
      color: "success",
    },
    {
      icon: DoorOpen,
      label: "Students without a seat",
      value: unassigned,
      hint: unassigned > 0 ? "Assign seats to place them" : "Everyone rostered has a seat",
      progress: assigned + unassigned > 0 ? assigned / (assigned + unassigned) : undefined,
      color: unassigned > 0 ? "warning" : "success",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      {cards.map((c) => (
        <StatCard key={c.label} {...c} />
      ))}
    </div>
  );
}

// ── Needs attention ────────────────────────────────────────────────────────

interface AttentionItem {
  exam: Exam;
  reason: string;
  action: string;
  href: string;
  severity: "danger" | "warning";
}

function buildAttention(exams: Exam[], summaries: Record<string, ExamSummary>, now: number): AttentionItem[] {
  const items: AttentionItem[] = [];
  for (const e of exams) {
    const t = examDateTime(e).getTime();
    if (t < now || isPrepared(e)) continue;
    const s = summaries[e.id];
    const soon = t - now < 14 * DAY;
    if (!s || s.roster_count === 0) {
      items.push({ exam: e, reason: "No students imported", action: "Import students", href: `/app/exams/${e.id}/roster`, severity: soon ? "danger" : "warning" });
    } else if (s.room_count === 0) {
      items.push({ exam: e, reason: "No rooms chosen", action: "Assign seats", href: `/app/exams/${e.id}/seating`, severity: soon ? "danger" : "warning" });
    } else if (s.unassigned_count > 0) {
      items.push({ exam: e, reason: `${plural(s.unassigned_count, "student")} without a seat`, action: "Assign seats", href: `/app/exams/${e.id}/seating`, severity: soon ? "danger" : "warning" });
    } else if (!s.has_template) {
      items.push({ exam: e, reason: "Exam paper not uploaded", action: "Upload exam paper", href: `/app/exams/${e.id}/documents`, severity: soon ? "danger" : "warning" });
    } else if (soon) {
      items.push({ exam: e, reason: "Ready to generate papers", action: "Generate papers", href: `/app/exams/${e.id}/documents`, severity: "warning" });
    }
  }
  return items.sort(
    (a, b) =>
      (a.severity === b.severity ? 0 : a.severity === "danger" ? -1 : 1) ||
      examDateTime(a.exam).getTime() - examDateTime(b.exam).getTime(),
  );
}

function NeedsAttention({ exams, summaries }: { exams: Exam[]; summaries: Record<string, ExamSummary> }) {
  const now = useNow(60_000);
  const items = useMemo(() => buildAttention(exams, summaries, now), [exams, summaries, now]);
  const shown = items.slice(0, 6);

  return (
    <Card className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
        <div>
          <h3 className="text-sm font-semibold text-ink">Needs attention</h3>
          <p className="mt-0.5 text-xs text-ink-3">Upcoming exams with setup left to do, most urgent first</p>
        </div>
        {items.length > 0 && (
          <Badge variant={items.some((i) => i.severity === "danger") ? "danger" : "warning"}>
            {plural(items.length, "item")}
          </Badge>
        )}
      </div>
      {shown.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-5 py-10 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-success/10 text-success">
            <Sparkles className="h-5 w-5" />
          </span>
          <p className="mt-3 text-sm font-medium text-ink">You&rsquo;re all caught up</p>
          <p className="mt-0.5 text-xs text-ink-3">Every upcoming exam is on track.</p>
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {shown.map((it) => (
            <li key={it.exam.id} className="flex items-center gap-3 px-5 py-3">
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                  it.severity === "danger" ? "bg-danger/10 text-danger" : "bg-warning/10 text-warning"
                }`}
              >
                <AlertTriangle className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <Link href={`/app/exams/${it.exam.id}`} className="block truncate text-sm font-medium text-ink hover:text-accent">
                  <span className="font-mono text-xs text-ink-3">{it.exam.course_code}</span>{" "}
                  {it.exam.exam_name}
                </Link>
                <p className="mt-0.5 truncate text-xs text-ink-2">
                  {it.reason} · <span className="text-ink-3">{formatDateShort(it.exam.exam_date)}, {formatRelative(examDateTime(it.exam), new Date(now))}</span>
                </p>
              </div>
              <Link href={it.href}>
                <Button variant="secondary" size="sm">
                  {it.action}
                </Button>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {items.length > shown.length && (
        <Link
          href="/app/exams"
          className="mt-auto flex items-center justify-center gap-1 border-t border-line px-5 py-2.5 text-xs font-medium text-accent hover:bg-surface-2"
        >
          View all {items.length} <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </Card>
  );
}

// ── Status pipeline ────────────────────────────────────────────────────────

function StatusPipeline({ exams }: { exams: Exam[] }) {
  const counts = useMemo(() => {
    const m = new Map<string, number>(STATUS_ORDER.map((s) => [s, 0]));
    for (const e of exams) if (m.has(e.status)) m.set(e.status, (m.get(e.status) ?? 0) + 1);
    return STATUS_ORDER.map((s) => ({ status: s, count: m.get(s) ?? 0 }));
  }, [exams]);
  const total = counts.reduce((a, c) => a + c.count, 0);

  return (
    <Card className="h-full">
      <div className="border-b border-line px-5 py-3.5">
        <h3 className="text-sm font-semibold text-ink">Exam pipeline</h3>
        <p className="mt-0.5 text-xs text-ink-3">Where each exam sits in the workflow</p>
      </div>
      <div className="px-5 py-5">
        <div className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-surface-hover">
          {counts
            .filter((c) => c.count > 0)
            .map((c) => (
              <div
                key={c.status}
                className="h-full first:rounded-l-full last:rounded-r-full"
                style={{ width: `${(c.count / Math.max(1, total)) * 100}%`, background: STATUS_COLOR[c.status] }}
                title={`${STATUS_LABEL[c.status]}: ${c.count}`}
              />
            ))}
        </div>
        <ul className="mt-5 space-y-1">
          {counts.map((c) => (
            <li key={c.status}>
              <Link
                href={`/app/exams?status=${c.status}`}
                className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-surface-2"
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: STATUS_COLOR[c.status] }} />
                <span className="flex-1 text-ink-2">{STATUS_LABEL[c.status]}</span>
                <span className="tnum font-medium text-ink">{c.count}</span>
                <span className="tnum w-10 text-right text-xs text-ink-3">
                  {total > 0 ? `${Math.round((c.count / total) * 100)}%` : "—"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

// ── Weekly load ────────────────────────────────────────────────────────────

function WeeklyLoad({ exams }: { exams: Exam[] }) {
  const now = useNow(60_000);
  const weeks = useMemo(() => weeklyLoad(exams, now), [exams, now]);
  const max = Math.max(1, ...weeks.map((w) => w.count));
  const busiest = weeks.reduce((a, w) => (w.count > a.count ? w : a), weeks[0]);

  return (
    <Card className="h-full">
      <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-3.5">
        <div>
          <h3 className="text-sm font-semibold text-ink">Exam load, next 8 weeks</h3>
          <p className="mt-0.5 text-xs text-ink-3">Exams scheduled per week</p>
        </div>
        {busiest.count > 0 && (
          <p className="text-right text-xs text-ink-3">
            Busiest week
            <span className="block text-sm font-medium text-ink">
              {formatMonthDay(busiest.start)} · {plural(busiest.count, "exam")}
            </span>
          </p>
        )}
      </div>
      <div className="px-5 pb-4 pt-6">
        <div className="flex h-40 items-end gap-2 sm:gap-3">
          {weeks.map((w, i) => (
            <div key={i} className="group flex h-full flex-1 flex-col items-center justify-end gap-1.5">
              <span className={`tnum text-[11px] font-medium ${w.count ? "text-ink-2" : "text-ink-3/60"}`}>
                {w.count}
              </span>
              <div
                className={`w-full max-w-12 rounded-md transition-colors ${
                  i === 0 ? "bg-accent" : "bg-accent/25 group-hover:bg-accent/45"
                }`}
                style={{ height: `${Math.max(w.count > 0 ? 6 : 2, (w.count / max) * 100)}%` }}
                title={`Week of ${formatDateShort(w.start)}: ${plural(w.count, "exam")}`}
              />
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-2 border-t border-line pt-2 sm:gap-3">
          {weeks.map((w, i) => (
            <span key={i} className="tnum flex-1 truncate text-center text-[10px] text-ink-3">
              {i === 0 ? "This wk" : formatMonthDay(w.start)}
            </span>
          ))}
        </div>
      </div>
    </Card>
  );
}

// ── Upcoming exams ─────────────────────────────────────────────────────────

function ReadinessBar({ summary }: { summary?: ExamSummary }) {
  if (!summary || summary.roster_count === 0) {
    return <span className="text-xs text-ink-3">No roster</span>;
  }
  const pct = summary.assigned_count / Math.max(1, summary.roster_count);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-hover">
        <div
          className={`h-full rounded-full ${pct >= 1 ? "bg-success" : "bg-accent"}`}
          style={{ width: `${Math.round(pct * 100)}%` }}
        />
      </div>
      <span className="tnum text-xs text-ink-2">
        {summary.assigned_count}/{summary.roster_count}
      </span>
    </div>
  );
}

function UpcomingExams({ exams, summaries }: { exams: Exam[]; summaries: Record<string, ExamSummary> }) {
  const now = useNow(60_000);
  const upcoming = useMemo(
    () =>
      exams
        .filter((e) => examDateTime(e).getTime() >= now)
        .sort((a, b) => examDateTime(a).getTime() - examDateTime(b).getTime())
        .slice(0, 6),
    [exams, now]
  );

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
        <div>
          <h3 className="text-sm font-semibold text-ink">Upcoming exams</h3>
          <p className="mt-0.5 text-xs text-ink-3">Next sittings by date</p>
        </div>
        <Link href="/app/exams" className="flex items-center gap-1 text-xs font-medium text-accent hover:text-accent-strong">
          All exams <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      {upcoming.length === 0 ? (
        <EmptyState
          icon={<CalendarDays className="h-5 w-5 text-ink-3" />}
          title="Nothing scheduled"
          description="Upcoming exams will appear here."
        />
      ) : (
        <ul className="divide-y divide-line">
          {upcoming.map((e) => {
            const when = examDateTime(e);
            const soon = when.getTime() - now < 3 * DAY;
            return (
              <li key={e.id}>
                <Link
                  href={`/app/exams/${e.id}`}
                  className="group flex items-center gap-4 px-5 py-3 transition-colors hover:bg-surface-2"
                >
                  <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg border border-line bg-surface-2 leading-none">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-accent">
                      {formatMonthName(when)}
                    </span>
                    <span className="tnum mt-0.5 text-base font-semibold text-ink">{when.getDate()}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">
                      {e.exam_name}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-ink-3">
                      <span className="font-mono">{e.course_code}</span>
                      <span aria-hidden="true">·</span>
                      <Clock className="h-3 w-3" />
                      {formatTime(e.start_time)}
                      {e.duration_minutes ? ` · ${e.duration_minutes} min` : ""}
                    </p>
                  </div>
                  <div className="hidden md:block">
                    <ReadinessBar summary={summaries[e.id]} />
                  </div>
                  <Badge variant={STATUS_BADGES[e.status]} className="hidden sm:inline-flex">
                    {STATUS_LABEL[e.status] ?? e.status}
                  </Badge>
                  <span className={`tnum w-24 shrink-0 text-right text-xs ${soon ? "font-medium text-danger" : "text-ink-3"}`}>
                    {formatRelative(when, new Date(now))}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

// ── Activity feed ──────────────────────────────────────────────────────────

interface ActivityEvent {
  id: string;
  when: string;
  kind: "roster" | "seating" | "ready" | "exam";
  title: string;
  detail: string;
}

function buildActivity(exams: Exam[], summaries: Record<string, ExamSummary>): ActivityEvent[] {
  const events: ActivityEvent[] = [];
  for (const e of exams) {
    const s = summaries[e.id];
    const ts = e.updated_at;
    if (e.status === "READY" || e.status === "GENERATED" || e.status === "COMPLETED") {
      events.push({
        id: `${e.id}-status`,
        when: ts,
        kind: e.status === "READY" ? "ready" : "exam",
        title: `Marked ${STATUS_LABEL[e.status].toLowerCase()}`,
        detail: `${e.course_code} · ${e.exam_name}`,
      });
    }
    if (s?.assigned_count && s.assigned_count > 0) {
      events.push({
        id: `${e.id}-seating`,
        when: ts,
        kind: "seating",
        title: `${plural(s.assigned_count, "seat")} assigned`,
        detail: `${e.course_code} · ${e.exam_name}`,
      });
    } else if (s?.roster_count && s.roster_count > 0) {
      events.push({
        id: `${e.id}-roster`,
        when: ts,
        kind: "roster",
        title: `${plural(s.roster_count, "student")} rostered`,
        detail: `${e.course_code} · ${e.exam_name}`,
      });
    }
  }
  return events
    .sort((a, b) => Date.parse(b.when) - Date.parse(a.when))
    .slice(0, 7);
}

const ACTIVITY_ICON: Record<ActivityEvent["kind"], { icon: React.ReactNode; tone: string }> = {
  roster: { icon: <Users className="h-3.5 w-3.5" />, tone: "bg-accent/10 text-accent" },
  seating: { icon: <DoorOpen className="h-3.5 w-3.5" />, tone: "bg-violet/10 text-violet" },
  ready: { icon: <CheckCircle2 className="h-3.5 w-3.5" />, tone: "bg-success/10 text-success" },
  exam: { icon: <FileText className="h-3.5 w-3.5" />, tone: "bg-surface-hover text-ink-2" },
};

function ActivityFeed({
  exams,
  summaries,
}: {
  exams: Exam[];
  summaries: Record<string, ExamSummary>;
}) {
  const now = useNow(60_000);
  const events = useMemo(
    () => buildActivity(exams, summaries),
    [exams, summaries]
  );
  return (
    <Card className="h-full">
      <div className="border-b border-line px-5 py-3.5">
        <h3 className="text-sm font-semibold text-ink">Recent activity</h3>
        <p className="mt-0.5 text-xs text-ink-3">Latest changes across exams</p>
      </div>
      {events.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-ink-3">No recent activity.</p>
      ) : (
        <ol className="relative px-5 py-4">
          <span className="absolute bottom-6 left-[34px] top-6 w-px bg-line" aria-hidden="true" />
          {events.map((ev) => (
            <li key={ev.id} className="relative flex items-start gap-3 py-2">
              <span className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ring-4 ring-surface ${ACTIVITY_ICON[ev.kind].tone}`}>
                {ACTIVITY_ICON[ev.kind].icon}
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="text-sm font-medium text-ink">{ev.title}</p>
                <p className="truncate text-xs text-ink-3">{ev.detail}</p>
              </div>
              <span className="tnum shrink-0 pt-1 text-[11px] text-ink-3">
                {formatRelative(ev.when, new Date(now))}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

// ── Main workspace ─────────────────────────────────────────────────────────

function DashboardWorkspace() {
  const { selectedCourseId } = useCourseContext();
  const { data, error, loading, reload } = useDashboardData(
    selectedCourseId
  );

  if (loading) {
    return (
      <PageContainer className="animate-fade-in space-y-6">
        <WorkspaceHeader exams={[]} onImported={reload} />
        <DashboardSkeleton />
      </PageContainer>
    );
  }
  if (error) {
    return (
      <PageContainer className="animate-fade-in space-y-6">
        <WorkspaceHeader exams={[]} onImported={reload} />
        <DataError message={error} onRetry={reload} />
      </PageContainer>
    );
  }
  if (!data) return null;

  const { exams, summaries } = data;

  if (exams.length === 0) {
    return (
      <PageContainer className="animate-fade-in space-y-6">
        <WorkspaceHeader exams={exams} onImported={reload} />
        <Card>
          <EmptyState
            icon={<FileText className="h-5 w-5 text-ink-3" />}
            title="No exams yet"
            description="Schedule your first exam to start tracking rosters, seating and packages."
            action={
              <Link href="/app/exams/new">
                <Button>
                  <Plus /> Create exam
                </Button>
              </Link>
            }
          />
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="animate-fade-in space-y-6">
      <WorkspaceHeader exams={exams} onImported={reload} />

      <KpiCards exams={exams} summaries={summaries} />

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <NeedsAttention exams={exams} summaries={summaries} />
        </div>
        <div className="xl:col-span-2">
          <StatusPipeline exams={exams} />
        </div>
      </div>

      <UpcomingExams exams={exams} summaries={summaries} />

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <WeeklyLoad exams={exams} />
        </div>
        <div className="xl:col-span-2">
          <ActivityFeed exams={exams} summaries={summaries} />
        </div>
      </div>
    </PageContainer>
  );
}

// ── Skeleton loaders ───────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="surface-card h-[124px] px-5 py-4">
            <Skeleton className="h-3 w-24 rounded" />
            <Skeleton className="mt-3 h-7 w-12 rounded" />
            <Skeleton className="mt-5 h-1.5 w-full rounded" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <Skeleton className="h-72 w-full rounded-xl xl:col-span-3" />
        <Skeleton className="h-72 w-full rounded-xl xl:col-span-2" />
      </div>
      <Skeleton className="h-80 w-full rounded-xl" />
    </div>
  );
}

function DashboardSkeletonPage() {
  return (
    <PageContainer className="animate-fade-in">
      <Skeleton className="mb-6 h-8 w-64 rounded" />
      <DashboardSkeleton />
    </PageContainer>
  );
}

export default function DashboardPage() {
  return (
    <PageTransition>
      <Suspense fallback={<DashboardSkeletonPage />}>
        <DashboardWorkspace />
      </Suspense>
    </PageTransition>
  );
}
