"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Plus,
  Calendar,
  Clock,
  Search,
  LayoutGrid,
  List,
  FileText,
  ChevronRight,
  X,
} from "lucide-react";
import { getAllExams, type ExamFilters } from "@/lib/api/exams";
import { getCourses } from "@/lib/api/courses";
import type { Exam, Course } from "@/lib/types";
import { formatDateLong, formatDateShort, formatRelative, formatTime, formatNumber, plural } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  Badge,
  Button,
  SkeletonRow,
  STATUS_BADGES,
  EmptyState,
  PageHeader,
  PageContainer,
  Table,
  TableHead,
  TableBody,
  Th,
  Td,
} from "@/components";
import { PageTransition } from "@/components/page-transition";

const BOARD_COLUMNS = [
  "DRAFT",
  "CONFIGURED",
  "READY",
  "GENERATED",
  "COMPLETED",
] as const;
type ColumnStatus = (typeof BOARD_COLUMNS)[number];

const COLUMN_META: Record<ColumnStatus, { label: string; dot: string; hint: string }> = {
  DRAFT: { label: "Draft", dot: "bg-ink-3", hint: "Being set up" },
  CONFIGURED: { label: "Configured", dot: "bg-accent", hint: "Roster and rooms in place" },
  READY: { label: "Ready", dot: "bg-warning", hint: "Seating confirmed" },
  GENERATED: { label: "Generated", dot: "bg-violet", hint: "Papers produced" },
  COMPLETED: { label: "Completed", dot: "bg-success", hint: "Exam written" },
};

function statusLabel(status: string): string {
  return COLUMN_META[status as ColumnStatus]?.label ?? status;
}

/** Exam names are often seeded as "CODE — Course name"; drop the redundant code prefix. */
function examTitle(exam: Exam): string {
  const prefix = `${exam.course_code} — `;
  return exam.exam_name.startsWith(prefix) ? exam.exam_name.slice(prefix.length) : exam.exam_name;
}

function durationLabel(mins: number): string {
  if (!mins) return "";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

function isColumnStatus(v: string | null): v is ColumnStatus {
  return v !== null && (BOARD_COLUMNS as readonly string[]).includes(v);
}

export default function ExamsPage() {
  // useSearchParams needs a Suspense boundary so the route can still prerender.
  return (
    <Suspense
      fallback={
        <PageContainer className="space-y-6">
          <PageHeader title="Exams" description="Loading exams…" />
        </PageContainer>
      }
    >
      <ExamsPageContent />
    </Suspense>
  );
}

function ExamsPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const statusParam = searchParams.get("status");
  const statusFilter: ColumnStatus | "" = isColumnStatus(statusParam) ? statusParam : "";
  const setStatusFilter = (next: ColumnStatus | "") => {
    const params = new URLSearchParams(searchParams.toString());
    if (next) params.set("status", next);
    else params.delete("status");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const [exams, setExams] = useState<Exam[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [courseFilter, setCourseFilter] = useState(() => searchParams.get("course_id") ?? "");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"board" | "table">("table");

  useEffect(() => {
    getCourses(1, 100)
      .then((d) => setCourses(d.courses))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const filters: ExamFilters = {};
    if (courseFilter) filters.course_id = courseFilter;
    Promise.all([getAllExams(filters), getCourses(1, 100)])
      .then(([examRes]) => {
        setExams(examRes.exams ?? []);
        setTotal(examRes.total ?? 0);
        setError(null);
      })
      .catch(() => setError("We couldn't load exams right now. Please try again."))
      .finally(() => setLoading(false));
  }, [courseFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return exams.filter(
      (e) =>
        (!statusFilter || e.status === statusFilter) &&
        (q.length === 0 ||
        e.exam_name.toLowerCase().includes(q) ||
        e.course_code.toLowerCase().includes(q) ||
        (e.course_name ?? "").toLowerCase().includes(q))
    );
  }, [exams, search, statusFilter]);

  const visibleColumns = statusFilter ? [statusFilter] : BOARD_COLUMNS;

  const grouped = useMemo(() => {
    const map: Record<ColumnStatus, Exam[]> = {
      DRAFT: [],
      CONFIGURED: [],
      READY: [],
      GENERATED: [],
      COMPLETED: [],
    };
    for (const e of filtered) {
      if (e.status in map) map[e.status as ColumnStatus].push(e);
    }
    for (const k of BOARD_COLUMNS) {
      map[k].sort((a, b) => `${a.exam_date}${a.start_time}`.localeCompare(`${b.exam_date}${b.start_time}`));
    }
    return map;
  }, [filtered]);

  const createAction = (
    <Link href="/app/exams/new">
      <Button>
        <Plus /> Create exam
      </Button>
    </Link>
  );

  return (
    <PageTransition>
      <PageContainer className="space-y-6">
        <PageHeader
          title="Exams"
          description={loading ? "Loading exams…" : `${plural(total, "exam")} across all courses`}
          actions={createAction}
        />

        {/* Toolbar */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
            <input
              type="search"
              aria-label="Search exams"
              placeholder="Search by name or course code"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-full rounded-lg border border-line-strong bg-surface pl-8 pr-3 text-sm text-ink shadow-[var(--shadow-sm)] placeholder:text-ink-3 focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
          <select
            aria-label="Filter by course"
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
            className="h-9 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink shadow-[var(--shadow-sm)] focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15 min-w-0 sm:w-56 [&>option]:bg-surface"
          >
            <option value="">All courses</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.course_code} — {c.course_name}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ColumnStatus | "")}
            className="h-9 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink shadow-[var(--shadow-sm)] focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15 min-w-0 sm:w-40 [&>option]:bg-surface"
          >
            <option value="">All statuses</option>
            {BOARD_COLUMNS.map((s) => (
              <option key={s} value={s}>
                {COLUMN_META[s].label}
              </option>
            ))}
          </select>
          </div>
          {(search || courseFilter || statusFilter) && (
            <Button
              variant="ghost"
              size="sm"
              className="self-start sm:self-auto"
              onClick={() => {
                setSearch("");
                setCourseFilter("");
                setStatusFilter("");
              }}
            >
              <X /> Clear
            </Button>
          )}
          <div className="flex items-center gap-3 sm:ml-auto">
            {!loading && (search || courseFilter || statusFilter) && (
              <span className="tnum text-xs text-ink-3">
                {formatNumber(filtered.length)} of {formatNumber(exams.length)}
              </span>
            )}
            <ViewToggle view={view} onChange={setView} />
          </div>
        </div>

        {/* Body */}
        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonRow key={i} lines={3} />
            ))}
          </div>
        ) : error ? (
          <div className="surface-card">
            <EmptyState
              icon={<FileText className="h-5 w-5 text-ink-3" />}
              title="Couldn't load exams"
              description={error}
            />
          </div>
        ) : exams.length === 0 ? (
          <div className="surface-card">
            <EmptyState
              icon={<FileText className="h-5 w-5 text-ink-3" />}
              title="No exams yet"
              description="Create your first exam to start configuring rooms and seating."
              action={createAction}
            />
          </div>
        ) : view === "board" ? (
          <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
            <div
              className={cn(
                "grid grid-flow-col items-start gap-3",
                statusFilter ? "auto-cols-[minmax(260px,360px)]" : "auto-cols-[minmax(200px,1fr)]"
              )}
            >
              {visibleColumns.map((status) => (
                <KanbanColumn key={status} status={status} exams={grouped[status]} />
              ))}
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="surface-card">
            <EmptyState
              icon={<Search className="h-5 w-5 text-ink-3" />}
              title="No exams match your search"
              description="Try a different name or course code."
            />
          </div>
        ) : (
          <ExamsTable exams={filtered} />
        )}
      </PageContainer>
    </PageTransition>
  );
}

/* ── Board / Table segmented toggle ── */
function ViewToggle({ view, onChange }: { view: "board" | "table"; onChange: (v: "board" | "table") => void }) {
  const opts = [
    { value: "table" as const, label: "List", Icon: List },
    { value: "board" as const, label: "By status", Icon: LayoutGrid },
  ];
  return (
    <div role="group" aria-label="View" className="inline-flex h-9 items-center rounded-lg border border-line bg-surface-2 p-0.5">
      {opts.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          aria-pressed={view === value}
          onClick={() => onChange(value)}
          className={cn(
            "inline-flex h-full items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors",
            view === value
              ? "bg-surface text-ink shadow-[var(--shadow-sm)] ring-1 ring-line"
              : "text-ink-3 hover:text-ink"
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </button>
      ))}
    </div>
  );
}

/* ── Status column (read-only: statuses follow each exam's progress) ── */
function KanbanColumn({ status, exams }: { status: ColumnStatus; exams: Exam[] }) {
  const meta = COLUMN_META[status];
  return (
    <section aria-label={`${meta.label} exams`} className="flex min-w-0 flex-col rounded-xl border border-line bg-surface-2">
      <header className="flex items-start justify-between px-3 pb-2 pt-3">
        <div className="flex items-center gap-2">
          <span className={cn("mt-1 h-2 w-2 shrink-0 self-start rounded-full", meta.dot)} />
          <div>
            <h2 className="text-[13px] font-semibold leading-tight text-ink">{meta.label}</h2>
            <p className="text-[11px] leading-tight text-ink-3">{meta.hint}</p>
          </div>
        </div>
        <span className="tnum min-w-5 rounded-md bg-surface px-1.5 py-0.5 text-center text-[11px] font-medium text-ink-2 ring-1 ring-inset ring-line">
          {exams.length}
        </span>
      </header>
      <div className="flex max-h-[calc(100dvh-15rem)] min-h-28 flex-col gap-2 overflow-y-auto p-2 pt-1">
        {exams.length === 0 ? (
          <div className="flex items-center justify-center rounded-lg border border-dashed border-line-strong px-2 py-6 text-xs text-ink-3">
            No exams
          </div>
        ) : (
          exams.map((exam) => <KanbanCard key={exam.id} exam={exam} />)
        )}
      </div>
    </section>
  );
}

function KanbanCard({ exam }: { exam: Exam }) {
  const time = formatTime(exam.start_time);
  return (
    <Link
      href={`/app/exams/${exam.id}`}
      className="group block rounded-lg border border-line bg-surface p-3 text-left shadow-[var(--shadow-sm)] transition-all duration-150 hover:border-line-strong hover:shadow-[var(--shadow-md)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
    >
      <p className="truncate font-mono text-[11px] font-medium text-ink-3">{exam.course_code}</p>
      <p className="mt-1 line-clamp-2 text-sm font-medium leading-snug text-ink group-hover:text-accent">
        {examTitle(exam)}
      </p>
      <div className="tnum mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-2">
        <span className="inline-flex items-center gap-1">
          <Calendar className="h-3 w-3 text-ink-3" />
          {formatDateShort(exam.exam_date)}
        </span>
        {time && (
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3 text-ink-3" />
            {time}
          </span>
        )}
      </div>
      <p className="tnum mt-3 truncate border-t border-line pt-2 text-[11px] text-ink-3">
        {exam.term} {exam.academic_year}
        {exam.duration_minutes ? ` · ${durationLabel(exam.duration_minutes)}` : ""}
      </p>
    </Link>
  );
}

/* ── List view: upcoming exams first, soonest at the top ── */
function ExamsTable({ exams }: { exams: Exam[] }) {
  const today = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD in local time
  const key = (e: Exam) => `${e.exam_date}${e.start_time ?? ""}`;
  const upcoming = exams.filter((e) => e.exam_date >= today).sort((a, b) => key(a).localeCompare(key(b)));
  const past = exams.filter((e) => e.exam_date < today).sort((a, b) => key(b).localeCompare(key(a)));
  const sections = [
    { title: "Upcoming", rows: upcoming },
    { title: "Past", rows: past },
  ].filter((sec) => sec.rows.length > 0);

  return (
    <div className="surface-card overflow-hidden">
      <Table>
        <TableHead>
          <Th>Date</Th>
          <Th>Course</Th>
          <Th>Exam</Th>
          <Th>Status</Th>
          <Th className="w-0">
            <span className="sr-only">Actions</span>
          </Th>
        </TableHead>
        {sections.map((sec) => (
          <TableBody key={sec.title}>
            <tr>
              <td colSpan={5} className="border-y border-line bg-surface-2 px-5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-3">
                {sec.title} · {formatNumber(sec.rows.length)}
              </td>
            </tr>
            {sec.rows.map((exam) => {
              const time = formatTime(exam.start_time);
              return (
                <tr key={exam.id} className="group">
                  <Td className="tnum whitespace-nowrap">
                    <span className="block font-medium text-ink">{formatDateLong(exam.exam_date)}</span>
                    <span className="block text-xs text-ink-3">
                      {time}
                      {time && " · "}
                      {formatRelative(exam.exam_date)}
                    </span>
                  </Td>
                  <Td className="whitespace-nowrap">
                    <span className="font-mono text-xs text-ink-2">{exam.course_code}</span>
                    <span className="block text-xs text-ink-3">{exam.term} {exam.academic_year}</span>
                  </Td>
                  <Td>
                    <Link href={`/app/exams/${exam.id}`} className="font-medium text-ink hover:text-accent">
                      {examTitle(exam)}
                    </Link>
                  </Td>
                  <Td>
                    <Badge variant={STATUS_BADGES[exam.status] ?? "default"}>{statusLabel(exam.status)}</Badge>
                  </Td>
                  <Td className="whitespace-nowrap text-right">
                    <Link href={`/app/exams/${exam.id}`}>
                      <Button variant="secondary" size="sm">
                        Open <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </Td>
                </tr>
              );
            })}
          </TableBody>
        ))}
      </Table>
    </div>
  );
}
