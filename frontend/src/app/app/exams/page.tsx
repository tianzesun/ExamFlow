"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Calendar,
  Search,
  LayoutGrid,
  List,
  GripVertical,
} from "lucide-react";
import { getExams, updateExam, type ExamFilters } from "@/lib/api/exams";
import { getCourses } from "@/lib/api/courses";
import type { Exam, Course } from "@/lib/types";
import {
  Card,
  Badge,
  Button,
  Select,
  SkeletonRow,
  STATUS_BADGES,
  EmptyState,
} from "@/components";

const BOARD_COLUMNS = [
  "DRAFT",
  "CONFIGURED",
  "READY",
  "GENERATED",
  "COMPLETED",
] as const;
type ColumnStatus = (typeof BOARD_COLUMNS)[number];

const COLUMN_META: Record<ColumnStatus, { label: string; accent: string }> = {
  DRAFT: { label: "Draft", accent: "var(--ink-3)" },
  CONFIGURED: { label: "Configured", accent: "var(--accent)" },
  READY: { label: "Ready", accent: "var(--warning)" },
  GENERATED: { label: "Generated", accent: "var(--violet)" },
  COMPLETED: { label: "Completed", accent: "var(--success)" },
};

function examDateLabel(exam: Exam): string {
  return new Date(`${exam.exam_date}T${exam.start_time || "00:00"}`).toLocaleDateString(
    undefined,
    { month: "short", day: "numeric", year: "numeric" }
  );
}

export default function ExamsPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [courseFilter, setCourseFilter] = useState("");
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
    Promise.all([getExams(filters, 1, 200), getCourses(1, 100)])
      .then(([examRes]) => {
        setExams(examRes.exams ?? []);
        setTotal(examRes.total ?? 0);
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Failed to load exams")
      )
      .finally(() => setLoading(false));
  }, [courseFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return exams.filter(
      (e) =>
        q.length === 0 ||
        e.exam_name.toLowerCase().includes(q) ||
        e.course_code.toLowerCase().includes(q)
    );
  }, [exams, search]);

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
    return map;
  }, [filtered]);

  const moveExam = async (id: string, status: ColumnStatus) => {
    // Optimistic update; revert on failure.
    const prev = exams;
    setExams((cur) =>
      cur.map((e) => (e.id === id ? { ...e, status } : e))
    );
    setDraggingId(null);
    try {
      await updateExam(id, { status });
    } catch {
      setExams(prev);
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Exams</h1>
          <p className="tnum mt-1 text-sm text-ink-2">
            {total} exam{total !== 1 ? "s" : ""} in the system
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-md border border-line bg-surface p-0.5">
            <button
              type="button"
              onClick={() => setView("board")}
              aria-pressed={view === "board"}
              className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-sm transition-colors ${
                view === "board"
                  ? "bg-surface-hover text-ink"
                  : "text-ink-3 hover:text-ink"
              }`}
            >
              <LayoutGrid className="h-4 w-4" /> Board
            </button>
            <button
              type="button"
              onClick={() => setView("table")}
              aria-pressed={view === "table"}
              className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-sm transition-colors ${
                view === "table"
                  ? "bg-surface-hover text-ink"
                  : "text-ink-3 hover:text-ink"
              }`}
            >
              <List className="h-4 w-4" /> Table
            </button>
          </div>
          <Link href="/app/exams/new">
            <Button>
              <Plus className="h-4 w-4" /> Create Exam
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
          <input
            type="text"
            placeholder="Search exams..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-line bg-surface px-3 py-1.5 pl-8 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        </div>
        <Select
          options={courses.map((c) => ({
            value: c.id,
            label: `${c.course_code} — ${c.course_name}`,
          }))}
          placeholder="All courses"
          value={courseFilter}
          onChange={(e) => setCourseFilter(e.target.value)}
          className="w-48"
        />
      </div>

      {/* Body */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonRow key={i} lines={3} />
          ))}
        </div>
      ) : error ? (
        <Card className="p-10">
          <EmptyState
            title="Couldn't load exams"
            description={error}
          />
        </Card>
      ) : exams.length === 0 ? (
        <Card className="p-10">
          <EmptyState
            title="No exams yet"
            description="Create your first exam to get started"
            action={
              <Link href="/app/exams/new">
                <Button>
                  <Plus className="h-4 w-4" /> Create Exam
                </Button>
              </Link>
            }
          />
        </Card>
      ) : view === "board" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {BOARD_COLUMNS.map((status) => (
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
              onDragEndColumn={() => {
                setDraggingId(null);
                setDragOver(null);
              }}
              onCardDragStart={(id) => setDraggingId(id)}
              onCardDragEnd={() => {
                setDraggingId(null);
                setDragOver(null);
              }}
              onStatusChange={moveExam}
            />
          ))}
        </div>
      ) : (
        <ExamsTable exams={filtered} onStatusChange={moveExam} />
      )}
    </div>
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
  onDragEndColumn,
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
  onDragEndColumn: () => void;
  onCardDragStart: (id: string) => void;
  onCardDragEnd: () => void;
  onStatusChange: (id: string, status: ColumnStatus) => void;
}) {
  const meta = COLUMN_META[status];
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        onDragEnterColumn();
      }}
      onDrop={onDropColumn}
      onDragLeave={onDragEndColumn}
      className={`flex flex-col rounded-lg border bg-surface-2 transition-colors ${
        isOver ? "border-accent" : "border-line"
      }`}
    >
      <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: meta.accent }}
          />
          <span className="text-sm font-medium text-ink">{meta.label}</span>
        </div>
        <span className="tnum rounded-full bg-surface px-1.5 py-0.5 text-xs font-medium text-ink-3">
          {exams.length}
        </span>
      </div>
      <div className="flex min-h-24 flex-col gap-2 p-2">
        {exams.length === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-ink-3">
            Drop exams here
          </p>
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
    </div>
  );
}

/* ── Kanban card (draggable + keyboard-accessible status change) ── */
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
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", exam.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={`group surface-card relative cursor-grab rounded-md p-3 transition-all duration-200 ${
        isDragging
          ? "translate-y-[-4px] scale-[1.02] opacity-60 shadow-lg ring-2 ring-accent/30"
          : "hover:shadow-sm"
      }`}
    >
      <div className="flex items-start gap-2">
        <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">
            {exam.exam_name}
          </p>
          <p className="mt-0.5 truncate text-xs text-ink-2">
            {exam.course_code}
          </p>
          <div className="mt-1.5 flex items-center gap-1 text-xs text-ink-3">
            <Calendar className="h-3 w-3" />
            {examDateLabel(exam)}
          </div>
        </div>
      </div>

      {/* Keyboard-accessible alternative to drag */}
      <div className="mt-2 flex items-center gap-1.5">
        <Badge variant={STATUS_BADGES[exam.status]}>{exam.status}</Badge>
        <label className="sr-only" htmlFor={`status-${exam.id}`}>
          Change status of {exam.exam_name}
        </label>
        <Select
          id={`status-${exam.id}`}
          value={exam.status}
          onChange={(e) => onStatusChange(exam.id, e.target.value as ColumnStatus)}
          options={BOARD_COLUMNS.map((s) => ({
            value: s,
            label: COLUMN_META[s].label,
          }))}
          className="h-7 w-full text-xs"
        />
      </div>

      <Link
        href={`/app/exams/${exam.id}`}
        className="mt-1 inline-flex items-center text-xs font-medium text-accent hover:text-accent-strong"
      >
        Open
      </Link>
    </div>
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
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line">
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-ink-3">
                Course
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-ink-3">
                Exam
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-ink-3">
                Term
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-ink-3">
                Date
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-ink-3">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {exams.map((exam) => (
              <tr key={exam.id} className="transition-colors hover:bg-surface-hover">
                <td className="px-4 py-3">
                  <Link
                    href={`/app/exams/${exam.id}`}
                    className="font-medium text-ink hover:text-accent"
                  >
                    {exam.course_code}
                  </Link>
                </td>
                <td className="px-4 py-3 text-ink-2">{exam.exam_name}</td>
                <td className="px-4 py-3 text-ink-2">
                  {exam.term} {exam.academic_year}
                </td>
                <td className="px-4 py-3 text-ink-2">{examDateLabel(exam)}</td>
                <td className="px-4 py-3">
                  <Select
                    value={exam.status}
                    onChange={(e) =>
                      onStatusChange(exam.id, e.target.value as ColumnStatus)
                    }
                    options={BOARD_COLUMNS.map((s) => ({
                      value: s,
                      label: COLUMN_META[s].label,
                    }))}
                    className="h-7 text-xs"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
