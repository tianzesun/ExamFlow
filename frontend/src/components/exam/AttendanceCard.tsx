"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Search, UserX, Undo2, Timer } from "lucide-react";
import { toast } from "sonner";
import { getFullRoster, setAttendance } from "@/lib/api/roster";
import { errorReference } from "@/lib/api/client";
import type { AttendanceStatus, ExamStudent } from "@/lib/types";
import { formatTime } from "@/lib/format";
import { Button } from "@/components/button";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";

const FILTERS: { key: "ALL" | AttendanceStatus; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "EXPECTED", label: "Not checked in" },
  { key: "PRESENT", label: "Present" },
  { key: "ABSENT", label: "Absent" },
];

/** Exam-day check-in: invigilators mark each student present or absent. */
export function AttendanceCard({ examId, canMark }: { examId: string; canMark: boolean }) {
  const [students, setStudents] = useState<ExamStudent[] | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("ALL");
  const [busy, setBusy] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    getFullRoster(examId)
      .then(setStudents)
      .catch((err) => setLoadError(`The roster couldn't be loaded. Reload the page to try again.${errorReference(err)}`));
  }, [examId]);

  const counts = useMemo(() => {
    const c = { EXPECTED: 0, PRESENT: 0, ABSENT: 0 };
    for (const s of students ?? []) c[s.attendance_status ?? "EXPECTED"]++;
    return c;
  }, [students]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (students ?? []).filter(
      (s) =>
        (filter === "ALL" || (s.attendance_status ?? "EXPECTED") === filter) &&
        (!q ||
          s.full_name.toLowerCase().includes(q) ||
          s.student_number.includes(q) ||
          (s.utorid ?? "").toLowerCase().includes(q)),
    );
  }, [students, query, filter]);

  const mark = async (s: ExamStudent, status: AttendanceStatus) => {
    setBusy(s.student_id);
    try {
      const updated = await setAttendance(examId, s.student_id, status);
      setStudents((list) => list?.map((x) => (x.student_id === s.student_id ? { ...x, ...updated } : x)) ?? null);
    } catch (err) {
      toast.error(`Attendance couldn't be saved. Try again.${errorReference(err)}`);
    } finally {
      setBusy(null);
    }
  };

  const total = students?.length ?? 0;
  const pct = total ? Math.round((counts.PRESENT / total) * 100) : 0;

  return (
    <section className="surface-card overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-line px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-ink">Attendance</h3>
          <p className="text-xs text-ink-3">Check students in as they arrive. Search by name, student number or UTORid.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden items-center gap-3 text-xs sm:flex">
            <span className="tnum"><span className="font-semibold text-success">{counts.PRESENT}</span> <span className="text-ink-3">present</span></span>
            <span className="tnum"><span className="font-semibold text-danger">{counts.ABSENT}</span> <span className="text-ink-3">absent</span></span>
            <span className="tnum"><span className="font-semibold text-ink">{counts.EXPECTED}</span> <span className="text-ink-3">to go</span></span>
          </div>
          <div className="relative h-11 w-11" aria-label={`${pct}% checked in`}>
            <svg viewBox="0 0 36 36" className="h-11 w-11 -rotate-90">
              <circle cx="18" cy="18" r="15" fill="none" stroke="var(--surface-hover)" strokeWidth="4" />
              <circle
                cx="18" cy="18" r="15" fill="none" stroke="var(--success)" strokeWidth="4" strokeLinecap="round"
                strokeDasharray={`${(pct / 100) * 94.2} 94.2`} className="transition-[stroke-dasharray] duration-500"
              />
            </svg>
            <span className="tnum absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-ink">{pct}%</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-b border-line px-5 py-3 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-3" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a student…"
            aria-label="Find a student"
            className="h-9 w-full rounded-lg border border-line-strong bg-surface pl-8 pr-3 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15"
          />
        </label>
        <div className="inline-flex rounded-lg border border-line bg-surface-2 p-0.5 text-xs" role="tablist" aria-label="Filter by attendance">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              role="tab"
              aria-selected={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "h-8 rounded-md px-3 font-medium transition-colors",
                filter === f.key ? "bg-surface text-ink shadow-[var(--shadow-sm)]" : "text-ink-3 hover:text-ink",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loadError ? (
        <p className="px-5 py-10 text-center text-sm text-danger">{loadError}</p>
      ) : students === null ? (
        <div className="space-y-2 p-5">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      ) : visible.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-ink-3">
          {total === 0 ? "No students on the roster yet." : "No students match."}
        </p>
      ) : (
        <ul className="max-h-[560px] divide-y divide-line overflow-y-auto">
          {visible.map((s) => {
            const status = s.attendance_status ?? "EXPECTED";
            return (
              <li key={s.id} className="flex items-center gap-3 px-5 py-2.5">
                <span
                  className={cn(
                    "h-2 w-2 shrink-0 rounded-full",
                    status === "PRESENT" ? "bg-success" : status === "ABSENT" ? "bg-danger" : "bg-line-strong",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{s.full_name}</p>
                  <p className="truncate text-xs text-ink-3">
                    <span className="font-mono">{s.student_number}</span>
                    {s.utorid && <> · {s.utorid}</>}
                    {status === "PRESENT" && s.checked_in_at && <> · in at {formatTime(new Date(s.checked_in_at).toTimeString().slice(0, 5))}</>}
                  </p>
                </div>
                {(s.extra_time_minutes ?? 0) > 0 && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-violet-subtle px-2 py-0.5 text-[11px] font-medium text-violet">
                    <Timer className="h-3 w-3" /> +{s.extra_time_minutes} min
                  </span>
                )}
                {canMark && (
                  <div className="flex shrink-0 gap-1">
                    {status === "EXPECTED" ? (
                      <>
                        <Button size="sm" variant="secondary" disabled={busy === s.student_id} onClick={() => mark(s, "PRESENT")}>
                          <Check className="h-3.5 w-3.5 text-success" /> Present
                        </Button>
                        <Button size="sm" variant="ghost" disabled={busy === s.student_id} onClick={() => mark(s, "ABSENT")}>
                          <UserX className="h-3.5 w-3.5" /> Absent
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" variant="ghost" disabled={busy === s.student_id} onClick={() => mark(s, "EXPECTED")}>
                        <Undo2 className="h-3.5 w-3.5" /> Undo
                      </Button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
