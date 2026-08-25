"use client";

import { useState } from "react";
import { BookOpen, Search, Plus } from "lucide-react";
import Link from "next/link";

interface Course {
  id: string;
  course_code: string;
  course_name: string;
  exam_count?: number;
}

interface CourseSidebarProps {
  courses: Course[];
  selectedCourseId: string | null;
  onSelectCourse: (courseId: string | null) => void;
  loading?: boolean;
}

export function CourseSidebar({
  courses,
  selectedCourseId,
  onSelectCourse,
  loading,
}: CourseSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredCourses = courses.filter(
    (course) =>
      course.course_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      course.course_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-full w-72 flex-col overflow-hidden border-r border-line bg-surface">
      {/* Header */}
      <div className="border-b border-line px-4 py-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Courses</h2>
          <Link
            href="/app/courses/new"
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-ink-2 transition-colors hover:bg-surface-hover hover:text-ink"
          >
            <Plus className="h-3.5 w-3.5" />
            New
          </Link>
        </div>

        {/* Search */}
        <div className="relative mt-3">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
          <input
            type="text"
            placeholder="Search courses..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-md border border-line bg-surface-2 py-1.5 pl-8 pr-3 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30"
          />
        </div>
      </div>

      {/* Course List */}
      <div className="flex-1 overflow-y-auto py-1">
        {loading ? (
          <div className="space-y-2 p-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-16" />
            ))}
          </div>
        ) : (
          <div className="space-y-px px-2">
            {/* All Courses option */}
            <button
              onClick={() => onSelectCourse(null)}
              className={`relative flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors ${
                selectedCourseId === null
                  ? "bg-surface-hover text-ink"
                  : "text-ink-2 hover:bg-surface-hover hover:text-ink"
              }`}
            >
              {selectedCourseId === null && (
                <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-accent" />
              )}
              <div className={`flex h-8 w-8 items-center justify-center rounded-md border border-line bg-surface-2 text-ink-3`}>
                <BookOpen className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">All Courses</p>
                <p className="text-xs text-ink-2">
                  {courses.length} course{courses.length !== 1 ? "s" : ""}
                </p>
              </div>
            </button>

            {/* Course items */}
            {filteredCourses.map((course) => (
              <button
                key={course.id}
                onClick={() => onSelectCourse(course.id)}
                className={`relative flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors ${
                  selectedCourseId === course.id
                    ? "bg-surface-hover text-ink"
                    : "text-ink-2 hover:bg-surface-hover hover:text-ink"
                }`}
              >
                {selectedCourseId === course.id && (
                  <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-accent" />
                )}
                <div className={`flex h-8 w-8 items-center justify-center rounded-md font-mono text-xs font-semibold ${
                  selectedCourseId === course.id
                    ? "bg-surface-2 ring-1 ring-line text-ink"
                    : "bg-surface-2 text-ink-2"
                }`}>
                  {course.course_code.slice(0, 3)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{course.course_code}</p>
                  <p className="truncate text-xs text-ink-2">{course.course_name}</p>
                </div>
                {course.exam_count !== undefined && course.exam_count > 0 && (
                  <span className="tnum rounded-md bg-surface-2 px-1.5 py-0.5 text-xs text-ink-2">
                    {course.exam_count}
                  </span>
                )}
              </button>
            ))}

            {filteredCourses.length === 0 && !loading && (
              <div className="py-8 text-center">
                <p className="text-sm text-ink-2">
                  {searchQuery ? "No courses match your search" : "No courses yet"}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}