"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronsUpDown, Check, BookOpen, Search } from "lucide-react";
import { useCourseContext } from "@/lib/course-context";

export function CourseSwitcher({ className = "" }: { className?: string }) {
  const { courses, selectedCourseId, setSelectedCourseId, loading } =
    useCourseContext();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const current = courses.find((c) => c.id === selectedCourseId);
  const q = query.trim().toLowerCase();
  const visible = q
    ? courses.filter(
        (c) =>
          c.course_code.toLowerCase().includes(q) ||
          (c.course_name ?? "").toLowerCase().includes(q),
      )
    : courses;

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 rounded-lg border border-line bg-surface px-2.5 py-2 text-left text-sm shadow-[var(--shadow-sm)] transition-colors hover:bg-surface-hover"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent-subtle text-accent">
          <BookOpen className="h-3.5 w-3.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-medium uppercase tracking-wider text-ink-3">
            Showing exams for
          </span>
          <span className="block truncate text-[13px] font-medium leading-tight text-ink">
            {current ? current.course_code : "All courses"}
          </span>
        </span>
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-ink-3" />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 z-50 mt-1.5 w-full min-w-72 overflow-hidden rounded-lg border border-line bg-surface shadow-[var(--shadow-lg)] animate-scale-in"
        >
          <div className="flex items-center gap-2 border-b border-line px-3 py-2">
            <Search className="h-3.5 w-3.5 text-ink-3" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a course…"
              className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-3 focus-visible:outline-none"
            />
          </div>
          <ul className="max-h-72 overflow-y-auto py-1">
            <li>
              <button
                type="button"
                onClick={() => {
                  setSelectedCourseId(null);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors ${
                  selectedCourseId === null
                    ? "bg-surface-hover text-ink"
                    : "text-ink-2 hover:bg-surface-hover hover:text-ink"
                }`}
              >
                <BookOpen className="h-4 w-4 shrink-0 text-ink-3" />
                <span className="flex-1 text-left">All courses</span>
                {selectedCourseId === null && (
                  <Check className="h-4 w-4 shrink-0 text-accent" />
                )}
              </button>
            </li>
            {visible.slice(0, 100).map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCourseId(c.id);
                    setOpen(false);
                    setQuery("");
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors ${
                    selectedCourseId === c.id
                      ? "bg-surface-hover text-ink"
                      : "text-ink-2 hover:bg-surface-hover hover:text-ink"
                  }`}
                >
                  <span className="w-20 shrink-0 truncate font-mono text-xs text-ink-3">
                    {c.course_code}
                  </span>
                  <span className="flex-1 truncate text-left">{c.course_name}</span>
                  {selectedCourseId === c.id && (
                    <Check className="h-4 w-4 shrink-0 text-accent" />
                  )}
                </button>
              </li>
            ))}
            {loading && (
              <li className="px-3 py-2 text-xs text-ink-3">Loading courses…</li>
            )}
            {!loading && visible.length === 0 && (
              <li className="px-3 py-2 text-xs text-ink-3">
                {courses.length === 0 ? "No courses yet" : "No matching courses"}
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
