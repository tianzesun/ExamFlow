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
  GripVertical,
  ArrowRightLeft,
  Check,
  FileText,
  ChevronRight,
  X,
} from "lucide-react";
import { getExams, updateExam, type ExamFilters } from "@/lib/api/exams";
import { getCourses } from "@/lib/api/courses";
import type { Exam, Course } from "@/lib/types";
import { formatDate, formatDateShort, formatTime, formatNumber, plural } from "@/lib/format";
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
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuGroup,
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

const COLUMN_META: Record<ColumnStatus, { label: string; dot: string }> = {
  DRAFT: { label: "Draft", dot: "bg-ink-3" },
  CONFIGURED: { label: "Configured", dot: "bg-accent" },
  READY: { label: "Ready", dot: "bg-warning" },
  GENERATED: { label: "Generated", dot: "bg-violet" },
  COMPLETED: { label: "Completed", dot: "bg-success" },
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
  const [view, setView] = useState<"board" | "table">("board");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<ColumnStatus | null>(null);

  useEffect(() => {
    getCourses(1, 100)
      .then((d) => setCourses(d.courses))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const filters: ExamFilters = {};
    if (courseFilter) filters.course_id = courseFilter;
    Promise.all([getExams(filters, 1, 100), getCourses(1, 100)])
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

  const moveExam = async (id: string, status: ColumnStatus) => {
    // Optimistic update; revert on failure.
    const prev = exams;
    if (prev.find((e) => e.id === id)?.status === status) return;
    setExams((cur) => cur.map((e) => (e.id === id ? { ...e, status } : e)));
    setDraggingId(null);
    try {
      await updateExam(id, { status });
    } catch {
      setExams(prev);
    }
  };

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
                <KanbanColumn
                  key={status}
                  status={status}
                  exams={grouped[status]}
                  draggingId={draggingId}
                  isOver={dragOver === status}
                  onDragEnterColumn={() => setDragOver(status)}
                  onDropColumn={() => {
                    if (draggingId) moveExam(draggingId, status);
                    setDraggingId(null);
                    setDragOver(null);
                  }}
                  onDragLeaveColumn={() => setDragOver((cur) => (cur === status ? null : cur))}
                  onCardDragStart={(id) => setDraggingId(id)}
                  onCardDragEnd={() => {
                    setDraggingId(null);
                    setDragOver(null);
                  }}
                  onStatusChange={moveExam}
                />
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
          <ExamsTable exams={filtered} onStatusChange={moveExam} />
        )}
      </PageContainer>
    </PageTransition>
  );
}

/* ── Board / Table segmented toggle ── */
function ViewToggle({ view, onChange }: { view: "board" | "table"; onChange: (v: "board" | "table") => void }) {
  const opts = [
    { value: "board" as const, label: "Board", Icon: LayoutGrid },
    { value: "table" as const, label: "Table", Icon: List },
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

/* ── "Move to…" status menu (keyboard-accessible alternative to drag) ── */
function MoveToMenu({
  exam,
  onStatusChange,
  align = "end",
}: {
  exam: Exam;
  onStatusChange: (id: string, status: ColumnStatus) => void;
  align?: "start" | "end";
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Change status of ${exam.exam_name}`}
        className="inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-[11px] font-medium text-ink-3 transition-colors hover:bg-surface-hover hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 data-[popup-open]:bg-surface-hover data-[popup-open]:text-ink"
      >
        <ArrowRightLeft className="h-3 w-3" />
        Move
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-40">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Move to</DropdownMenuLabel>
          {BOARD_COLUMNS.map((s) => (
            <DropdownMenuItem key={s} onClick={() => onStatusChange(exam.id, s)}>
              <span className={cn("h-1.5 w-1.5 rounded-full", COLUMN_META[s].dot)} />
              <span className="flex-1">{COLUMN_META[s].label}</span>
              {exam.status === s && <Check className="h-3.5 w-3.5 text-ink-3" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ── Kanban column ── */
function KanbanColumn({
  status,
  exams,
  draggingId,
  isOver,
  onDragEnterColumn,
  onDropColumn,
  onDragLeaveColumn,
  onCardDragStart,
  onCardDragEnd,
  onStatusChange,
}: {
  status: ColumnStatus;
  exams: Exam[];
  draggingId: string | null;
  isOver: boolean;
  onDragEnterColumn: () => void;
  onDropColumn: () => void;
  onDragLeaveColumn: () => void;
  onCardDragStart: (id: string) => void;
  onCardDragEnd: () => void;
  onStatusChange: (id: string, status: ColumnStatus) => void;
}) {
  const meta = COLUMN_META[status];
  return (
    <section
      aria-label={`${meta.label} exams`}
      onDragOver={(e) => {
        e.preventDefault();
        onDragEnterColumn();
      }}
      onDrop={onDropColumn}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) onDragLeaveColumn();
      }}
      className={cn(
        "flex min-w-0 flex-col rounded-xl border bg-surface-2 transition-colors",
        isOver ? "border-accent bg-accent/5" : "border-line"
      )}
    >
      <header className="flex items-center justify-between px-3 pb-2 pt-3">
        <div className="flex items-center gap-2">
          <span className={cn("h-2 w-2 rounded-full", meta.dot)} />
          <h2 className="text-[13px] font-semibold text-ink">{meta.label}</h2>
        </div>
        <span className="tnum min-w-5 rounded-md bg-surface px-1.5 py-0.5 text-center text-[11px] font-medium text-ink-2 ring-1 ring-inset ring-line">
          {exams.length}
        </span>
      </header>
      <div className="flex max-h-[calc(100dvh-15rem)] min-h-28 flex-col gap-2 overflow-y-auto p-2 pt-1">
        {exams.length === 0 ? (
          <div
            className={cn(
              "flex items-center justify-center rounded-lg border border-dashed px-2 py-6 text-xs text-ink-3",
              isOver ? "border-accent text-accent" : "border-line-strong"
            )}
          >
            Drop exams here
          </div>
        ) : (
          exams.map((exam) => (
            <KanbanCard
              key={exam.id}
              exam={exam}
              isDragging={draggingId === exam.id}
              onDragStart={() => onCardDragStart(exam.id)}
              onDragEnd={onCardDragEnd}
              onStatusChange={onStatusChange}
            />
          ))
        )}
      </div>
    </section>
  );
}

/* ── Kanban card (draggable + menu-based status change) ── */
function KanbanCard({
  exam,
  isDragging,
  onDragStart,
  onDragEnd,
  onStatusChange,
}: {
  exam: Exam;
  isDragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onStatusChange: (id: string, status: ColumnStatus) => void;
}) {
  const time = formatTime(exam.start_time);
  return (
    <article
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", exam.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={cn(
        "group relative cursor-grab rounded-lg border border-line bg-surface p-3 text-left shadow-[var(--shadow-sm)] transition-all duration-150 active:cursor-grabbing",
        isDragging ? "opacity-50 ring-2 ring-accent/30" : "hover:border-line-strong hover:shadow-[var(--shadow-md)]"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="truncate font-mono text-[11px] font-medium text-ink-3">{exam.course_code}</p>
        <GripVertical
          aria-hidden
          className="-mr-1 h-3.5 w-3.5 shrink-0 text-ink-3 opacity-0 transition-opacity group-hover:opacity-100"
        />
      </div>
      <Link
        href={`/app/exams/${exam.id}`}
        className="mt-1 line-clamp-2 block text-sm font-medium leading-snug text-ink hover:text-accent focus-visible:outline-none focus-visible:underline"
      >
        {examTitle(exam)}
      </Link>
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
      <div className="mt-3 flex items-center justify-between border-t border-line pt-2">
        <span className="tnum truncate text-[11px] text-ink-3">
          {exam.term} {exam.academic_year}
          {exam.duration_minutes ? ` · ${durationLabel(exam.duration_minutes)}` : ""}
        </span>
        <MoveToMenu exam={exam} onStatusChange={onStatusChange} />
      </div>
    </article>
  );
}

/* ── Table view ── */
function ExamsTable({
  exams,
  onStatusChange,
}: {
  exams: Exam[];
  onStatusChange: (id: string, status: ColumnStatus) => void;
}) {
  return (
    <div className="surface-card overflow-hidden">
      <Table>
        <TableHead>
          <Th>Course</Th>
          <Th>Exam</Th>
          <Th>Term</Th>
          <Th>Date</Th>
          <Th>Status</Th>
          <Th className="w-0">
            <span className="sr-only">Actions</span>
          </Th>
        </TableHead>
        <TableBody>
          {exams.map((exam) => {
            const time = formatTime(exam.start_time);
            return (
              <tr key={exam.id} className="group">
                <Td className="whitespace-nowrap">
                  <span className="font-mono text-xs text-ink-2">{exam.course_code}</span>
                </Td>
                <Td>
                  <Link href={`/app/exams/${exam.id}`} className="font-medium text-ink hover:text-accent">
                    {examTitle(exam)}
                  </Link>
                </Td>
                <Td className="whitespace-nowrap text-ink-2">
                  {exam.term} {exam.academic_year}
                </Td>
                <Td className="tnum whitespace-nowrap text-ink-2">
                  {formatDate(exam.exam_date)}
                  {time && <span className="text-ink-3"> · {time}</span>}
                </Td>
                <Td>
                  <Badge variant={STATUS_BADGES[exam.status] ?? "default"}>{statusLabel(exam.status)}</Badge>
                </Td>
                <Td className="whitespace-nowrap text-right">
                  <div className="flex items-center justify-end gap-1">
                    <MoveToMenu exam={exam} onStatusChange={onStatusChange} />
                    <Link
                      href={`/app/exams/${exam.id}`}
                      aria-label={`Open ${exam.exam_name}`}
                      className="inline-flex h-6 w-6 items-center justify-center rounded-md text-ink-3 hover:bg-surface-hover hover:text-ink"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </div>
                </Td>
              </tr>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
