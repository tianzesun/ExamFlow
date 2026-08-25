"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Plus,
  Upload,
  Users,
  FileText,
  DoorOpen,
  Search,
  Calendar,
  LayoutDashboard,
  ArrowUpRight,
  AlertCircle,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { useCourseContext } from "@/lib/course-context";
import { getExams } from "@/lib/api/exams";
import { getExamSummary } from "@/lib/api/readiness";
import type { ExamSummary } from "@/lib/api/readiness";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  STATUS_BADGES,
  TableBody,
  Th,
  Td,
  StatCard,
} from "@/components";
import { RosterUploadDialog } from "@/components/dashboard/RosterUploadDialog";
import { CourseSwitcher } from "@/components/dashboard/CourseSwitcher";
import {
  type BarDatum,
  TrendBars,
  ChartEmpty,
  } from "@/components/chart";

interface Exam {
  id: string;
  course_id: string;
  course_code: string;
  course_name: string | null;
  exam_name: string;
  term: string;
  academic_year: number;
  exam_date: string;
  start_time: string;
  duration_minutes: number;
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

type AttentionItem = {
  exam: Exam;
  reason: string;
  action: string;
  href: string;
};

const STATUS_ORDER = ["DRAFT", "CONFIGURED", "READY", "GENERATED", "COMPLETED"];
const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  CONFIGURED: "Configured",
  READY: "Ready",
  GENERATED: "Generated",
  COMPLETED: "Completed",
};

function PanelHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        {subtitle && (
          <p className="tnum mt-0.5 text-xs text-ink-3">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}

function examDateValue(exam: Exam): Date {
  return new Date(`${exam.exam_date}T${exam.start_time || "00:00"}`);
}

function fmtDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtTime(t?: string): string {
  if (!t) return "";
  const parts = t.split(":");
  const h = parseInt(parts[0], 10);
  const m = parts[1] ? parseInt(parts[1], 10) : 0;
  const d = new Date();
  d.setHours(h || 0, m, 0, 0);
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function nextActionFor(exam: Exam): { label: string; href: string } {
  switch (exam.status) {
    case "DRAFT":
      return { label: "Continue setup", href: `/app/exams/${exam.id}` };
    case "CONFIGURED":
      return { label: "Review exam", href: `/app/exams/${exam.id}` };
    case "READY":
      return { label: "Generate seating", href: `/app/exams/${exam.id}/seating` };
    default:
      return { label: "View exam", href: `/app/exams/${exam.id}` };
  }
}

function buildMonthlySeries(exams: Exam[]): BarDatum[] {
  const map = new Map<string, number>();
  for (const e of exams) {
    const d = new Date(e.exam_date);
    if (isNaN(d.getTime())) continue;
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
      return { label, value, color: "accent" as const };
    });
}

function WorkspaceSkeleton() {
  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
      <div className="border-b border-line bg-surface px-6 py-5">
        <div className="mx-auto grid w-full max-w-7xl grid-cols-2 gap-x-4 gap-y-3 lg:grid-cols-4">
          <div className="skeleton h-8 w-40" />
          <div className="skeleton h-4 w-24" />
          <div className="skeleton h-4 w-32" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="mx-auto max-w-7xl space-y-5">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="skeleton h-20" />
            <div className="skeleton h-20" />
            <div className="skeleton h-20" />
            <div className="skeleton h-20" />
          </div>
          <div className="skeleton h-44 w-full" />
          <div className="skeleton h-56 w-full" />
        </div>
      </div>
    </div>
  );
}

function Workspace() {
  const { selectedCourseId, courses } = useCourseContext();
  const [exams, setExams] = useState<Exam[]>([]);
  const [summaries, setSummaries] = useState<Record<string, ExamSummary>>({});
  const [loading, setLoading] = useState(true);
  const [rosterOpen, setRosterOpen] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const statusFilter = searchParams.get("status") ?? "ALL";

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams.toString());
    if (!value || value === "ALL") {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    const qs = next.toString();
    router.replace(qs ? `/app?${qs}` : "/app", { scroll: false });
  };

  const loadExams = () => {
    getExams({}, 1, 100)
      .then((data) => setExams(data.exams ?? []))
      .catch(() => setExams([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadExams();
  }, []);

  const filteredExams = useMemo(
    () =>
      selectedCourseId
        ? exams.filter((e) => e.course_id === selectedCourseId)
        : exams,
    [exams, selectedCourseId]
  );

  const activeExams = useMemo(
    () => filteredExams.filter((e) => e.status !== "ARCHIVED"),
    [filteredExams]
  );

  const upcomingExams = useMemo(
    () =>
      filteredExams
        .filter(
          (e) =>
            examDateValue(e) >= new Date() && e.status !== "ARCHIVED"
        )
        .sort((a, b) => examDateValue(a).getTime() - examDateValue(b).getTime())
        .slice(0, 5),
    [filteredExams]
  );

  // Fetch per-exam readiness summaries (roster / rooms / seats).
  useEffect(() => {
    let cancelled = false;
    const ids = activeExams.map((e) => e.id);
    Promise.allSettled(ids.map((id) => getExamSummary(id))).then((results) => {
      if (cancelled) return;
      const map: Record<string, ExamSummary> = {};
      results.forEach((r, i) => {
        if (r.status === "fulfilled") map[ids[i]] = r.value;
      });
      setSummaries(map);
    });
    return () => {
      cancelled = true;
    };
  }, [activeExams]);

  const attentionItems = useMemo<AttentionItem[]>(() => {
    const items: AttentionItem[] = [];
    for (const exam of activeExams) {
      const s = summaries[exam.id];
      if (exam.status === "DRAFT") {
        items.push({
          exam,
          reason: "Exam setup is incomplete",
          action: "Continue setup",
          href: `/app/exams/${exam.id}`,
        });
      } else if (exam.status === "CONFIGURED") {
        items.push({
          exam,
          reason: "Ready for roster, room, or seating review",
          action: "Review exam",
          href: `/app/exams/${exam.id}`,
        });
      } else if (exam.status === "READY") {
        items.push({
          exam,
          reason: "Seating not generated",
          action: "Generate seating",
          href: `/app/exams/${exam.id}/seating`,
        });
      } else if (
        exam.status === "GENERATED" &&
        s &&
        (s.unassigned_count > 0 || s.room_count === 0)
      ) {
        const reason =
          s.room_count === 0
            ? "No rooms assigned"
            : `${s.unassigned_count} student${s.unassigned_count === 1 ? "" : "s"} unassigned`;
        items.push({
          exam,
          reason,
          action: "Review seating",
          href: `/app/exams/${exam.id}/seating`,
        });
      }
    }
    return items;
  }, [activeExams, summaries]);

  const unassignedSeats = useMemo(
    () =>
      activeExams.reduce(
        (acc, e) => acc + (summaries[e.id]?.unassigned_count ?? 0),
        0
      ),
    [activeExams, summaries]
  );

  const readyExams = useMemo(
    () =>
      activeExams.filter(
        (e) => e.status === "GENERATED" || e.status === "COMPLETED"
      ).length,
    [activeExams]
  );

  const selectedCourse = selectedCourseId
    ? courses.find((c) => c.id === selectedCourseId)
    : null;

  const tableRows = useMemo(() => {
    const rows = activeExams.filter((exam) => {
      const matchesSearch =
        exam.course_code.toLowerCase().includes(q.toLowerCase()) ||
        exam.exam_name.toLowerCase().includes(q.toLowerCase());
      const matchesStatus = statusFilter === "ALL" || exam.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
    return rows.sort(
      (a, b) => examDateValue(a).getTime() - examDateValue(b).getTime()
    );
  }, [activeExams, q, statusFilter]);

  if (loading) return <WorkspaceSkeleton />;

  const monthly = buildMonthlySeries(activeExams);

  return (
    <>
      <header className="border-b border-line bg-surface-2 shadow-sm">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-line bg-surface text-violet ring-1 ring-violet/10">
              <LayoutDashboard className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="truncate text-base font-semibold tracking-tight text-ink">
                  {selectedCourse?.course_name ?? "All courses"}
                </h1>
                {selectedCourse?.course_code && (
                  <Badge variant="default" className="truncate text-[11px]">
                    {selectedCourse.course_code}
                  </Badge>
                )}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-ink-3">
                <span>
                  {selectedCourse?.department ?? "All courses"}
                </span>
                <span aria-hidden="true">•</span>
                <span className="tnum">
                  {filteredExams.length}{" "}
                  {filteredExams.length === 1 ? "exam" : "exams"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="hidden sm:block">
              <CourseSwitcher />
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setRosterOpen(true)}
                disabled={!selectedCourseId}
              >
                <Upload className="h-4 w-4" /> Import roster
              </Button>
              <Link href="/app/rooms">
                <Button variant="secondary" size="sm">
                  <DoorOpen className="h-4 w-4" /> Rooms
                </Button>
              </Link>
              <Link
                href={
                  selectedCourseId
                    ? `/app/exams/new?course_id=${selectedCourseId}`
                    : "/app/exams/new"
                }
              >
                <Button size="sm">
                  <Plus className="h-4 w-4" /> Create exam
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              icon={FileText}
              label="Scheduled exams"
              value={filteredExams.length}
              color="accent"
            />
            <StatCard
              icon={AlertCircle}
              label="Needs attention"
              value={attentionItems.length}
              color={attentionItems.length > 0 ? "warning" : "neutral"}
            />
            <StatCard icon={Users} label="Exams ready" value={readyExams} />
            <StatCard
              icon={DoorOpen}
              label="Unassigned seats"
              value={unassignedSeats}
              color={unassignedSeats > 0 ? "warning" : "success"}
            />
          </div>

          {/* Attention queue */}
          <AttentionPanel items={attentionItems} onStatusClick={setParam} />

          {/* Upcoming + Readiness + time trend */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-5">
              <UpcomingExamsPanel
                exams={upcomingExams}
                onStatusClick={setParam}
              />
              <Card>
                <PanelHeader
                  title="Exams Over Time"
                  subtitle={`${activeExams.length} exam${activeExams.length !== 1 ? "s" : ""} by scheduled month`}
                />
                <div className="px-6 py-5">
                  {monthly.length > 0 ? (
                    <TrendBars data={monthly} height={180} />
                  ) : (
                    <ChartEmpty>No scheduled exams</ChartEmpty>
                  )}
                </div>
              </Card>
            </div>
            <CourseReadinessPanel
              exams={activeExams}
              summaries={summaries}
              selectedCourseId={selectedCourseId}
            />
          </div>

          {/* Exams workspace */}
          <ExamsWorkspace
            exams={tableRows}
            summaries={summaries}
            searchValue={q}
            statusFilter={statusFilter}
            onSearch={(v) => setParam("q", v)}
            onStatusChange={(v) => setParam("status", v)}
          />
        </div>
      </main>

      <RosterUploadDialog
        open={rosterOpen}
        onOpenChange={setRosterOpen}
        exams={activeExams.map((e) => ({ id: e.id, exam_name: e.exam_name }))}
        courseId={selectedCourseId}
        onImported={loadExams}
      />
    </>
  );
}

function AttentionPanel({
  items,
  onStatusClick,
}: {
  items: AttentionItem[];
  onStatusClick: (key: string, value: string) => void;
}) {
  if (items.length === 0) return null;

  return (
    <Card className="border-warning/30">
      <PanelHeader
        title="Needs attention"
        subtitle={`${items.length} item${items.length === 1 ? "" : "s"} to complete before exam day`}
        action={
          <button
            onClick={() => onStatusClick("status", "ALL")}
            className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:text-accent-strong"
          >
            Show all <ArrowUpRight className="h-3 w-3" />
          </button>
        }
      />
      <ul className="divide-y divide-line">
        {items.map(({ exam, reason, href, action }) => (
          <li
            key={exam.id}
            className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">
                {exam.course_code} — {exam.exam_name}
              </p>
              <p className="mt-0.5 text-xs text-ink-2">
                {reason} •{" "}
                <span
                  className="cursor-pointer font-medium text-ink-2 hover:text-accent"
                  onClick={() => onStatusClick("status", exam.status)}
                >
                  {STATUS_LABEL[exam.status] ?? exam.status}
                </span>
              </p>
            </div>
            <Link
              href={href}
              className="inline-flex items-center gap-1 text-xs font-medium text-accent whitespace-nowrap hover:text-accent-strong"
            >
              {action}
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function UpcomingExamsPanel({
  exams,
  onStatusClick,
}: {
  exams: Exam[];
  onStatusClick: (key: string, value: string) => void;
}) {
  return (
    <Card>
      <PanelHeader
        title="Upcoming exams"
        subtitle="Next scheduled assessments"
        action={
          <Link
            href="#exams"
            className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:text-accent-strong"
          >
            View all <ArrowUpRight className="h-3 w-3" />
          </Link>
        }
      />
      {exams.length === 0 ? (
        <p className="px-6 py-8 text-center text-sm text-ink-2">
          No upcoming exams.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {exams.map((exam) => (
            <li key={exam.id}>
              <Link
                href={`/app/exams/${exam.id}`}
                className="flex items-center justify-between gap-4 px-6 py-3 transition-colors hover:bg-surface-hover"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">
                    {exam.course_code} — {exam.exam_name}
                  </p>
                  <div className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-2">
                    <Calendar className="h-3.5 w-3.5 text-ink-3" />
                    {fmtDate(exam.exam_date)}{" "}
                    <span className="text-ink-3">•</span>{" "}
                    <Clock className="h-3.5 w-3.5 text-ink-3" />
                    {fmtTime(exam.start_time)}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    onStatusClick("status", exam.status);
                  }}
                  className="shrink-0"
                >
                  <Badge variant={STATUS_BADGES[exam.status]}>
                    {STATUS_LABEL[exam.status] ?? exam.status}
                  </Badge>
                </button>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function CourseReadinessPanel({
  exams,
  summaries,
  selectedCourseId,
}: {
  exams: Exam[];
  summaries: Record<string, ExamSummary>;
  selectedCourseId: string | null;
}) {
  const totalRostered = exams.reduce(
    (acc, e) => acc + (summaries[e.id]?.roster_count ?? 0),
    0
  );
  const withRoster = exams.filter(
    (e) => (summaries[e.id]?.roster_count ?? 0) > 0
  ).length;
  const withRooms = exams.filter(
    (e) => (summaries[e.id]?.room_count ?? 0) > 0
  ).length;
  const withSeating = exams.filter(
    (e) => (summaries[e.id]?.generated_count ?? 0) > 0
  ).length;
  const total = exams.length || 1;

  return (
    <Card>
      <PanelHeader
        title="Course readiness"
        subtitle={
          selectedCourseId
            ? "Setup progress across this course"
            : "Across all courses"
        }
      />
      <ul className="divide-y divide-line">
        <ReadinessRow
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Roster imported"
          detail={`${totalRostered} students · ${withRoster}/${total} exams`}
          done={withRoster > 0}
        />
        <ReadinessRow
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Rooms assigned"
          detail={`${withRooms}/${total} exams have rooms`}
          done={withRooms > 0}
        />
        <ReadinessRow
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Seating generated"
          detail={`${withSeating}/${total} exams`}
          done={withSeating > 0}
        />
      </ul>
    </Card>
  );
}

function ReadinessRow({
  icon,
  label,
  detail,
  done,
}: {
  icon: React.ReactNode;
  label: string;
  detail: string;
  done: boolean;
}) {
  return (
    <li className="flex items-center justify-between px-6 py-3">
      <div className="flex items-center gap-2.5">
        <span className={done ? "text-success" : "text-ink-3"}>
          {icon}
        </span>
        <span className="text-sm text-ink-2">{label}</span>
      </div>
      <span className="tnum text-xs text-ink-3">{detail}</span>
    </li>
  );
}

function ExamsWorkspace({
  exams,
  summaries,
  searchValue,
  statusFilter,
  onSearch,
  onStatusChange,
}: {
  exams: Exam[];
  summaries: Record<string, ExamSummary>;
  searchValue: string;
  statusFilter: string;
  onSearch: (value: string) => void;
  onStatusChange: (value: string) => void;
}) {
  const [sortKey, setSortKey] = useState<"date" | "name">("date");

  const sorted = [...exams].sort((a, b) => {
    if (sortKey === "name")
      return a.exam_name.localeCompare(b.exam_name);
    return examDateValue(a).getTime() - examDateValue(b).getTime();
  });

  const empty = exams.length === 0;

  return (
    <Card>
      <PanelHeader
        title="Exams"
        subtitle={
          searchValue || statusFilter !== "ALL"
            ? "Filtered results"
            : `${exams.length} exam${exams.length === 1 ? "" : "s"}`
        }
        action={
          <Link
            href="/app/exams"
            className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:text-accent-strong"
          >
            Manage exams <ArrowUpRight className="h-3 w-3" />
          </Link>
        }
      />
      <div className="px-6 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
            <input
              type="text"
              placeholder="Search exams..."
              value={searchValue}
              onChange={(e) => onSearch(e.target.value)}
              className="w-full rounded-md border border-line bg-surface py-1.5 pl-8 pr-3 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => onStatusChange(e.target.value)}
            className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30 dark:[&>option]:bg-surface"
          >
            <option value="ALL">All status</option>
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s] ?? s}
              </option>
            ))}
          </select>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as "date" | "name")}
            className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30 dark:[&>option]:bg-surface"
          >
            <option value="date">Sort by date</option>
            <option value="name">Sort by name</option>
          </select>
        </div>

        {empty ? (
          <EmptyState
            icon={<FileText className="h-6 w-6 text-ink-3" />}
            title="No exams here"
            description={
              searchValue || statusFilter !== "ALL"
                ? "Try adjusting your filters"
                : "Create an exam to start setting up a course."
            }
            action={
              <Link href="/app/exams/new">
                <Button>
                  <Plus className="h-4 w-4" /> Create exam
                </Button>
              </Link>
            }
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <Th>Exam</Th>
                      <Th>Date &amp; time</Th>
                      <Th>Students</Th>
                      <Th>Rooms</Th>
                      <Th>Status</Th>
                      <Th className="text-right">Next step</Th>
                    </tr>
                  </thead>
                  <TableBody>
                    {sorted.map((exam) => {
                      const s = summaries[exam.id];
                      const next = nextActionFor(exam);
                      return (
                        <tr
                          key={exam.id}
                          className="border-b border-line last:border-0 hover:bg-surface-hover"
                        >
                          <Td>
                            <Link
                              href={`/app/exams/${exam.id}`}
                              className="font-medium text-ink hover:text-accent"
                            >
                              {exam.exam_name}
                            </Link>
                            <p className="mt-0.5 text-xs text-ink-3">
                              {exam.term} {exam.academic_year}
                            </p>
                          </Td>
                          <Td className="tnum text-ink-2">
                            {fmtDate(exam.exam_date)}
                            <span className="block text-xs text-ink-3">
                              {fmtTime(exam.start_time)}
                            </span>
                          </Td>
                          <Td className="tnum text-ink-2">
                            {s?.roster_count ?? "—"}
                          </Td>
                          <Td className="tnum text-ink-2">
                            {s?.room_count ?? 0}
                          </Td>
                          <Td>
                            <button
                              onClick={() => onStatusChange(exam.status)}
                              className="cursor-pointer"
                            >
                              <Badge variant={STATUS_BADGES[exam.status]}>
                                {STATUS_LABEL[exam.status] ?? exam.status}
                              </Badge>
                            </button>
                          </Td>
                          <Td className="text-right">
                            <Link
                              href={next.href}
                              className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:text-accent-strong"
                            >
                              {next.label}
                              <ArrowUpRight className="h-3.5 w-3.5" />
                            </Link>
                          </Td>
                        </tr>
                      );
                    })}
                  </TableBody>
                </table>
              </div>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden">
              <div className="space-y-3">
                {sorted.map((exam) => {
                  const next = nextActionFor(exam);
                  return (
                    <Link
                      key={exam.id}
                      href={`/app/exams/${exam.id}`}
                      className="block rounded-md border border-line bg-surface p-3 transition-colors hover:bg-surface-hover"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-ink">
                            {exam.exam_name}
                          </p>
                          <p className="text-xs text-ink-3">
                            {exam.course_code} · {exam.term} {exam.academic_year}
                          </p>
                          <p className="mt-0.5 tnum text-xs text-ink-2">
                            {fmtDate(exam.exam_date)} · {fmtTime(exam.start_time)}
                          </p>
                        </div>
                        <Badge
                          variant={STATUS_BADGES[exam.status]}
                          className="shrink-0"
                        >
                          {STATUS_LABEL[exam.status] ?? exam.status}
                        </Badge>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-xs text-ink-2">
                          {next.label}
                        </span>
                        <ArrowUpRight className="h-3.5 w-3.5 text-ink-3" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}

export default function AppPage() {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <Workspace />
    </Suspense>
  );
}
