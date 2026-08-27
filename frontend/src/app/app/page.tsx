"use client";

import { Suspense, useEffect, useMemo, useCallback, useState } from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  Plus,
  FileText,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  Users,
  DoorOpen,
} from "lucide-react";
import { useCourseContext } from "@/lib/course-context";
import { getExams } from "@/lib/api/exams";
import { getExamSummary } from "@/lib/api/readiness";
import { getCourses } from "@/lib/api/courses";
import type { ExamSummary } from "@/lib/api/readiness";
import type { Exam } from "@/lib/types";
import { useNow } from "@/hooks/useNow";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  STATUS_BADGES,
  Skeleton,
  AreaChart,
  Funnel,
  StatCard,
  type StatCardProps,
} from "@/components";
import { RosterUploadDialog } from "@/components/dashboard/RosterUploadDialog";
import { CourseSwitcher } from "@/components/dashboard/CourseSwitcher";

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

// ── Helpers ────────────────────────────────────────────────────────────────

function examDateTime(exam: Exam): Date {
  return new Date(`${exam.exam_date}T${exam.start_time || "00:00"}`);
}

function fmtDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtTime(t?: string): string {
  if (!t) return "";
  return new Date(`1970-01-01T${t}`).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Humanized relative time between a target and `now` (pure when given now). */
function timeUntil(target: Date, now: number): string {
  const ms = target.getTime() - now;
  if (ms < 0) return "Past";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor(ms / 60000) % 60;
  const s = Math.floor(ms / 1000) % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/** Exams grouped into trailing-7-day buckets for the trend/sparklines. */
function weeklyBuckets(exams: Exam[]): number[] {
  const buckets = new Array(7).fill(0);
  const dayAgo = new Date();
  dayAgo.setDate(dayAgo.getDate() - 6);
  dayAgo.setHours(0, 0, 0, 0);
  for (const e of exams) {
    const d = examDateTime(e);
    const idx = Math.floor(
      (d.getTime() - dayAgo.getTime()) / 86400000
    );
    if (idx >= 0 && idx < 7) buckets[idx] += 1;
  }
  return buckets;
}

/** Exams grouped by month label for the area chart. */
function monthlySeries(exams: Exam[]) {
  const map = new Map<string, number>();
  for (const e of exams) {
    const d = new Date(e.exam_date);
    if (Number.isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => {
      const [y, m] = key.split("-");
      const label = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString(
        undefined,
        { month: "short", year: "2-digit" }
      );
      return { label, value };
    });
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
          getExams({}, 1, 100),
          getCourses(1, 100),
        ]);
        const allExams = examRes.exams;
        const visible = courseId
          ? allExams.filter((e) => e.course_id === courseId)
          : allExams;
        // Fan-out per-exam readiness summaries (N requests); a course-level
        // aggregate endpoint would collapse this to one.
        const results = await Promise.allSettled(
          visible.map((e) =>
            getExamSummary(e.id).then(
              (s): [string, ExamSummary] => [e.id, s],
              () => [e.id, null] as [string, null]
            )
          )
        );
        return {
          exams: visible,
          courses: courseRes.courses.map((c) => ({
            id: c.id,
            course_code: c.course_code,
            course_name: c.course_name,
          })),
          summaries: Object.fromEntries(
            results
              .filter(
                (r): r is PromiseFulfilledResult<[string, ExamSummary]> =>
                  r.status === "fulfilled" && !!r.value[1]
              )
              .map((r) => r.value)
          ),
        } as DashboardData;
      })
      .then((next) => {
        if (!cancelled && next) setData(next);
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to load dashboard");
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

function DataError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex h-full min-h-[280px] items-center justify-center">
      <div className="text-center">
        <AlertCircle className="mx-auto h-6 w-6 text-danger" />
        <p className="mt-2 text-sm text-ink-2">Failed to load dashboard data</p>
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
  const { selectedCourseId } = useCourseContext();
  const [rosterOpen, setRosterOpen] = useState(false);
  return (
    <>
      <      header className="border-b border-line bg-surface/80 px-4 py-4 shadow-sm sm:px-6">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-line bg-surface text-violet">
              <LayoutDashboard className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight text-ink">
                Dashboard
              </h1>
              <p className="text-sm text-ink-3">
                {selectedCourseId
                  ? "Course workspace overview"
                  : "All courses overview"}
              </p>
            </div>
            {exams.length > 0 && (
              <span className="hidden items-center gap-1 text-xs text-ink-3 sm:inline-flex">
                <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                Live
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="hidden sm:block">
              <CourseSwitcher />
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setRosterOpen(true)}
              disabled={!selectedCourseId}
            >
              Import roster
            </Button>
            <Link href="/app/exams/new">
              <Button size="sm">
                <Plus className="h-4 w-4" /> Create exam
              </Button>
            </Link>
          </div>
        </div>
      </header>

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
  const scheduled = exams.length;
  const withRoster = examCount((e) => (summaries[e.id]?.roster_count ?? 0) > 0);
  const ready = examCount((e) => e.status === "GENERATED" || e.status === "COMPLETED");
  const unassigned = exams.reduce(
    (acc, e) => acc + (summaries[e.id]?.unassigned_count ?? 0),
    0
  );
  const spark = useMemo(() => weeklyBuckets(exams), [exams]);

  function examCount(pred: (e: Exam) => boolean) {
    return exams.filter(pred).length;
  }

  const cards: StatCardProps[] = [
    {
      icon: FileText,
      label: "Scheduled exams",
      value: scheduled,
      change: "+this cycle",
      sparkline: spark,
      color: "accent" as const,
    },
    {
      icon: CheckCircle,
      label: "Roster imported",
      value: withRoster,
      change: `${Math.round((withRoster / Math.max(1, scheduled)) * 100)}%`,
      color: "success" as const,
    },
    {
      icon: Users,
      label: "Exams ready",
      value: ready,
      color: "violet" as const,
    },
    {
      icon: DoorOpen,
      label: "Unassigned seats",
      value: unassigned,
      change: unassigned > 0 ? "needs action" : "all assigned",
      color: unassigned > 0 ? "warning" : "success",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => (
        <StatCard key={c.label} {...c} />
      ))}
    </div>
  );
}

// ── Exams Over Time ────────────────────────────────────────────────────────

function ExamsOverTime({ exams }: { exams: Exam[] }) {
  const series = useMemo(() => monthlySeries(exams), [exams]);
  return (
    <Card>
      <div className="border-b border-line px-6 py-4">
        <h3 className="text-sm font-semibold text-ink">Exams Over Time</h3>
        <p className="mt-0.5 text-xs text-ink-3">
          {exams.length} scheduled exam{exams.length !== 1 ? "s" : ""} by month
        </p>
      </div>
      <div className="px-6 py-5">
        {series.length > 0 ? (
          <AreaChart data={series} height={200} />
        ) : (
          <EmptyState icon={<FileText />} title="No exams" description="Exams scheduled will appear here." />
        )}
      </div>
    </Card>
  );
}

// ── Status funnel ──────────────────────────────────────────────────────────

function StatusFunnel({ exams }: { exams: Exam[] }) {
  const buckets = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of STATUS_ORDER) counts.set(e, 0);
    for (const e of exams) {
      if (!e.status) continue;
      counts.set(e.status, (counts.get(e.status) ?? 0) + 1);
    }
    return STATUS_ORDER.filter((s) => (counts.get(s) ?? 0) > 0).map((s) => ({
      label: STATUS_LABEL[s] ?? s,
      value: counts.get(s) ?? 0,
    }));
  }, [exams]);

  return (
    <Card>
      <div className="border-b border-line px-6 py-4">
        <h3 className="text-sm font-semibold text-ink">Exam status pipeline</h3>
        <p className="mt-0.5 text-xs text-ink-3">
          Where each exam sits right now
        </p>
      </div>
      <div className="px-6 py-5">
        {buckets.length > 0 ? (
          <Funnel data={buckets} color="var(--accent)" />
        ) : (
          <EmptyState icon={<FileText />} title="No exams" />
        )}
      </div>
    </Card>
  );
}

// ── Upcoming exams ─────────────────────────────────────────────────────────

function UpcomingExams({ exams }: { exams: Exam[] }) {
  const now = useNow();
  const upcoming = useMemo(
    () =>
      exams
        .filter((e) => examDateTime(e).getTime() >= now)
        .sort((a, b) => examDateTime(a).getTime() - examDateTime(b).getTime())
        .slice(0, 5),
    [exams, now]
  );

  return (
    <Card>
      <div className="border-b border-line px-6 py-4">
        <h3 className="text-sm font-semibold text-ink">Upcoming exams</h3>
        <p className="mt-0.5 text-xs text-ink-3">
          {upcoming.length} exam{upcoming.length !== 1 ? "s" : ""} scheduled
        </p>
      </div>
      <div className="divide-y divide-line">
        {upcoming.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-ink-2">
            No upcoming exams.
          </p>
        ) : (
          upcoming.map((e) => {
            const when = examDateTime(e);
            return (
              <Link
                key={e.id}
                href={`/app/exams/${e.id}`}
                className="flex items-center justify-between gap-4 px-6 py-3 transition-colors hover:bg-surface-hover"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">
                    {e.course_code} — {e.exam_name}
                  </p>
                  <div className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-3">
                    <Calendar className="h-3.5 w-3.5" />
                    {fmtDate(e.exam_date)}{" "}
                    <span aria-hidden="true">•</span>{" "}
                    <Clock className="h-3.5 w-3.5" />
                    {fmtTime(e.start_time)}
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <Badge
                    variant={STATUS_BADGES[e.status]}
                    className="text-[10px]"
                  >
                    {STATUS_LABEL[e.status] ?? e.status}
                  </Badge>
                  <Countdown target={when} />
                </div>
              </Link>
            );
          })
        )}
      </div>
    </Card>
  );
}

/** Countdown badge that ticks every second via useNow. */
function Countdown({ target }: { target: Date }) {
  const now = useNow();
  const remaining = timeUntil(target, now);
  const urgent = target.getTime() - now < 3600000;
  return (
    <span
      className={`tnum inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-medium ${
        urgent
          ? "bg-danger/10 text-danger"
          : "bg-surface-hover text-ink-2"
      }`}
    >
      <Clock className="h-3 w-3" />
      {remaining}
    </span>
  );
}

// ── Activity feed ──────────────────────────────────────────────────────────

interface ActivityEvent {
  id: string;
  when: string;
  whenLabel: string;
  kind: "roster" | "seating" | "ready" | "exam";
  title: string;
  detail: string;
}

function buildActivity(exams: Exam[], summaries: Record<string, ExamSummary>): ActivityEvent[] {
  const events: ActivityEvent[] = [];
  for (const e of exams) {
    const s = summaries[e.id];
    const ts = e.updated_at;
    const whenLabel = fmtDate(ts);
    if (e.status === "READY" || e.status === "GENERATED") {
      events.push({
        id: `${e.id}-seating`,
        when: ts,
        whenLabel,
        kind: "exam",
        title: `${e.exam_name} reached ${STATUS_LABEL[e.status]}`,
        detail: e.course_code,
      });
    }
    if (s?.roster_count && s.roster_count > 0) {
      events.push({
        id: `${e.id}-roster`,
        when: ts,
        whenLabel,
        kind: "roster",
        title: `${s.roster_count} students rostered`,
        detail: `${e.course_code} · ${e.exam_name}`,
      });
    }
  }
  return events
    .sort((a, b) => Date.parse(b.when) - Date.parse(a.when))
    .slice(0, 8);
}

const ACTIVITY_ICON: Record<ActivityEvent["kind"], React.ReactNode> = {
  roster: <Users className="h-3.5 w-3.5 text-accent" />,
  seating: <DoorOpen className="h-3.5 w-3.5 text-violet" />,
  ready: <CheckCircle className="h-3.5 w-3.5 text-success" />,
  exam: <FileText className="h-3.5 w-3.5 text-ink-3" />,
};

function ActivityFeed({
  exams,
  summaries,
}: {
  exams: Exam[];
  summaries: Record<string, ExamSummary>;
}) {
  const events = useMemo(
    () => buildActivity(exams, summaries),
    [exams, summaries]
  );
  return (
    <Card>
      <div className="border-b border-line px-6 py-4">
        <h3 className="text-sm font-semibold text-ink">Recent activity</h3>
        <p className="mt-0.5 text-xs text-ink-3">Latest exam lifecycle events</p>
      </div>
      <div className="divide-y divide-line">
        {events.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-ink-2">
            No recent activity.
          </p>
        ) : (
          events.map((ev) => (
            <li
              key={ev.id}
              className="flex items-start gap-3 px-6 py-3"
            >
              <span className="mt-0.25 shrink-0">{ACTIVITY_ICON[ev.kind]}</span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">{ev.title}</p>
                <p className="text-xs text-ink-3">{ev.detail}</p>
              </div>
              <span className="tnum shrink-0 text-xs text-ink-3">
                {ev.whenLabel}
              </span>
            </li>
          ))
        )}
      </div>
    </Card>
  );
}

// ── Skeleton loaders ───────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="surface-card h-28 px-5 py-4">
            <Skeleton className="h-3 w-20 rounded" />
            <Skeleton className="mt-2 h-6 w-10 rounded" />
          </div>
        ))}
      </div>
      <Skeleton className="h-64 w-full" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
      <Skeleton className="h-72 w-full" />
    </div>
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
      <>
        <WorkspaceHeader exams={[]} onImported={reload} />
        <DashboardSkeleton />
      </>
    );
  }
  if (error) {
    return (
      <>
        <WorkspaceHeader exams={[]} onImported={reload} />
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <DataError onRetry={reload} />
        </div>
      </>
    );
  }
  if (!data) return null;

  const { exams, summaries } = data;

  if (exams.length === 0) {
    return (
      <>
        <WorkspaceHeader exams={exams} onImported={reload} />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl p-4 sm:p-6">
            <EmptyState
              icon={<FileText className="h-8 w-8 text-ink-3" />}
              title="No exams yet"
              description="Schedule your first exam to start building readiness dashboards."
              action={
                <Link href="/app/exams/new">
                  <Button>
                    <Plus className="h-4 w-4" /> Create exam
                  </Button>
                </Link>
              }
            />
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <WorkspaceHeader exams={exams} onImported={reload} />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
          {/* KPIs */}
          <KpiCards exams={exams} summaries={summaries} />

          {/* Charts row */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ExamsOverTime exams={exams} />
            <StatusFunnel exams={exams} />
          </div>

          {/* Upcoming + activity */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <UpcomingExams exams={exams} />
            </div>
            <ActivityFeed exams={exams} summaries={summaries} />
          </div>
        </div>
      </main>
    </>
  );
}

function DashboardSkeletonPage() {
  return (
    <>
      <header className="border-b border-line bg-surface-2 px-4 py-4 sm:px-6">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4">
          <Skeleton className="h-7 w-32 rounded" />
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-8 w-40 rounded" />
            <Skeleton className="h-8 w-28 rounded" />
          </div>
        </div>
      </header>
      <DashboardSkeleton />
    </>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeletonPage />}>
      <DashboardWorkspace />
    </Suspense>
  );
}
