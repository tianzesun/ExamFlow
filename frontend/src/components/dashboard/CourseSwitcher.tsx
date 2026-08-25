"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check, BookOpen } from "lucide-react";
import { useCourseContext } from "@/lib/course-context";

export function CourseSwitcher() {
  const { courses, selectedCourseId, setSelectedCourseId, loading } =
    useCourseContext();
  const [open, setOpen] = useState(false);
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
  const label = current ? current.course_code : "All Courses";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-md border border-line bg-surface px-3 py-1.5 text-sm transition-colors hover:bg-surface-hover"
      >
        <BookOpen className="h-4 w-4 text-ink-3" />
        <span className="max-w-[180px] truncate font-medium text-ink">
          {label}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-ink-3 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 z-50 mt-1.5 w-72 overflow-hidden rounded-md border border-line bg-surface shadow-md animate-scale-in"
        >
          <div className="border-b border-line px-3 py-2">
            <p className="text-[11px] font-medium uppercase tracking-wider text-ink-3">
              Course context
            </p>
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
                <span className="flex-1 text-left">All Courses</span>
                {selectedCourseId === null && (
                  <Check className="h-4 w-4 shrink-0 text-accent" />
                )}
              </button>
            </li>
            {courses.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCourseId(c.id);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors ${
                    selectedCourseId === c.id
                      ? "bg-surface-hover text-ink"
                      : "text-ink-2 hover:bg-surface-hover hover:text-ink"
                  }`}
                >
                  <span className="w-14 shrink-0 font-mono text-xs text-ink-3">
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
            {!loading && courses.length === 0 && (
              <li className="px-3 py-2 text-xs text-ink-3">No courses yet</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
