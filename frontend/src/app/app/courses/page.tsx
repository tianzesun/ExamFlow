"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Plus,
  BookOpen,
  Search,
  Building2,
  FileText,
  ChevronDown,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { getCourses } from "@/lib/api/courses";
import { getExams } from "@/lib/api/exams";
import type { ReactNode } from "react";
import type { Course, Exam } from "@/lib/types";
import {
  Card,
  Button,
  Table,
  TableHead,
  TableBody,
  Th,
  Td,
  EmptyState,
  Badge,
  StatCard,
  Skeleton,
  SkeletonRow,
  STATUS_BADGES,
} from "@/components";

interface CourseStats {
  examCount: number;
  statusCounts: Record<string, number>;
}

const codeInitials = (code: string) =>
  code
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const departmentColor = (dept: string | null) => {
  const seed = (dept ?? "").length + (dept?.[0]?.charCodeAt(0) ?? 0);
  const colors: readonly ("info" | "violet" | "warning" | "success")[] = [
    "info",
    "violet",
    "warning",
    "success",
  ];
  return colors[seed % colors.length];
};

function highlight(text: string, q: string): ReactNode {
  if (!q) return text;
  const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  const parts = text.split(re);
  return parts
    .filter(Boolean)
    .map((p, i) =>
      re.test(p) ? (
        <mark key={i} className="rounded bg-accent/15 px-0.5 text-accent">
          {p}
        </mark>
      ) : (
        p
      )
    );
}

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
};

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("ALL");
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    Promise.all([getCourses(1, 100), getExams({}, 1, 200)])
      .then(([cs, es]) => {
        setCourses(cs.courses ?? []);
        setTotal(cs.total ?? 0);
        setExams(es.exams ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const perCourse = useMemo(() => {
    const map: Record<string, CourseStats> = {};
    for (const e of exams) {
      const cur = map[e.course_id] ?? {
        examCount: 0,
        statusCounts: {},
      };
      cur.examCount += 1;
      cur.statusCounts[e.status] = (cur.statusCounts[e.status] ?? 0) + 1;
      map[e.course_id] = cur;
    }
    return map;
  }, [exams]);

  const departments = useMemo(() => {
    const set = new Set<string>();
    courses.forEach((c) => {
      if (c.department) set.add(c.department);
    });
    return Array.from(set).sort();
  }, [courses]);

  const filteredCourses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return courses.filter((course) => {
      const matchesSearch =
        q.length === 0 ||
        course.course_code.toLowerCase().includes(q) ||
        course.course_name.toLowerCase().includes(q);
      const matchesDept =
        departmentFilter === "ALL" ||
        (course.department ?? "") === departmentFilter;
      return matchesSearch && matchesDept;
    });
  }, [courses, searchQuery, departmentFilter]);

  // Group filtered courses by department (null → "Other").
  const groups = useMemo(() => {
    const grouped = new Map<string, Course[]>();
    for (const c of filteredCourses) {
      const key = c.department ?? "Other";
      const arr = grouped.get(key) ?? [];
      arr.push(c);
      grouped.set(key, arr);
    }
    return Array.from(grouped.entries()).sort(([a], [b]) =>
      a.localeCompare(b)
    );
  }, [filteredCourses]);

  const withCodeCount = courses.filter((c) => c.course_code).length;

  const toggle = (key: string) =>
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));

  const hasFilters =
    searchQuery.length > 0 || departmentFilter !== "ALL";

  const resetFilters = () => {
    setSearchQuery("");
    setDepartmentFilter("ALL");
  };

  return (
    <div className="animate-fade-in space-y-6">
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-ink">
              Courses
            </h1>
            {!loading && courses.length > 0 && (
              <span className="tnum rounded-full border border-line bg-surface-2 px-2 py-0.5 text-xs font-medium text-ink-2">
                {total}
              </span>
            )}
          </div>
          <p className="tnum mt-1 text-sm text-ink-2">
            {total} course{total !== 1 ? "s" : ""} in the system
          </p>
        </div>
        <Link href="/app/courses/new">
          <Button>
            <Plus className="h-4 w-4" /> Create Course
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-22 w-full" />
            ))}
          </div>
          <Skeleton className="h-10 w-full" />
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonRow key={i} lines={4} />
          ))}
        </div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              icon={BookOpen}
              label="Total Courses"
              value={courses.length}
              color="accent"
            />
            <StatCard icon={FileText} label="With Code" value={withCodeCount} />
            <StatCard
              icon={Building2}
              label="Departments"
              value={departments.length}
              color="violet"
            />
            <StatCard
              icon={Building2}
              label="Dept. Assigned"
              value={`${courses.filter((c) => c.department).length}/${courses.length}`}
              color="warning"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
              <input
                type="text"
                placeholder="Search courses..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-md border border-line bg-surface px-3 py-1.5 pl-8 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30 dark:[&>option]:bg-surface"
            >
              <option value="ALL">All Departments</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            {hasFilters && (
              <button
                onClick={resetFilters}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-accent transition-colors hover:text-accent-strong"
              >
                Clear
              </button>
            )}
            <span className="tnum ml-auto text-xs text-ink-3">
              {filteredCourses.length} of {courses.length}
            </span>
          </div>

          {filteredCourses.length === 0 ? (
            <Card className="p-10">
              <EmptyState
                icon={<Search className="h-5 w-5 text-ink-3" />}
                title="No courses match your filters"
              />
            </Card>
          ) : (
            <Card>
              {groups.map(([dept, deptCourses]) => {
                const isOpen = openGroups[dept] ?? true;
                const deptKey = `group-${dept}`;
                return (
                  <div key={deptKey} className="border-b border-line last:border-0">
                    <button
                      type="button"
                      onClick={() => toggle(dept)}
                      className="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent sm:px-6"
                      aria-expanded={isOpen}
                    >
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggle(dept);
                          }}
                          className="rounded p-0.5 text-ink-3 hover:text-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                          aria-label={isOpen ? "Collapse" : "Expand"}
                        >
                          {isOpen ? (
                            <ChevronDown className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <span className="text-sm font-medium text-ink">
                          {dept}
                        </span>
                        <Badge variant={departmentColor(dept === "Other" ? null : dept)}>
                          {deptCourses.length}
                        </Badge>
                      </div>
                      <span className="tnum text-xs text-ink-3">
                        {deptCourses.length} course
                        {deptCourses.length !== 1 ? "s" : ""}
                      </span>
                    </button>

                    {isOpen && (
                      <div className="overflow-hidden">
                        <Table>
                          <TableHead>
                            <Th>Code</Th>
                            <Th>Name</Th>
                            <Th>Exams</Th>
                            <Th>Status</Th>
                            <Th className="text-right">Details</Th>
                          </TableHead>
                          <TableBody>
                            {deptCourses.map((course) => {
                              const stats = perCourse[course.id];
                              const examCount = stats?.examCount ?? 0;
                              const statusCounts = stats?.statusCounts ?? {};
                              return (
                                <tr
                                  key={course.id}
                                  className="group transition-colors hover:bg-surface-hover"
                                >
                                  <Td>
                                    <div className="flex items-center gap-3">
                                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-line bg-surface-2 font-mono text-[10px] font-bold uppercase tracking-wide text-accent">
                                        {codeInitials(course.course_code)}
                                      </span>
                                      <Link
                                        href={`/app/courses/${course.id}`}
                                        className="font-medium text-ink transition-colors group-hover:text-accent"
                                      >
                                        {highlight(course.course_code, searchQuery)}
                                      </Link>
                                    </div>
                                  </Td>
                                  <Td>
                                    {highlight(course.course_name, searchQuery)}
                                  </Td>
                                  <Td className="tnum text-ink-2">
                                    {examCount}
                                  </Td>
                                  <Td>
                                    <div className="flex flex-wrap items-center gap-1">
                                      {examCount === 0 ? (
                                        <span className="text-xs text-ink-3">
                                          No exams
                                        </span>
                                      ) : (
                                        Object.entries(statusCounts)
                                          .filter(([, n]) => n > 0)
                                          .sort(
                                            ([a], [b]) =>
                                              STATUS_ORDER.indexOf(a) -
                                              STATUS_ORDER.indexOf(b)
                                          )
                                          .map(([s, n]) => (
                                            <Badge
                                              key={s}
                                              variant={STATUS_BADGES[s] ?? "default"}
                                              className="text-[10px]"
                                            >
                                              {STATUS_LABEL[s] ?? s}: {n}
                                            </Badge>
                                          ))
                                      )}
                                    </div>
                                  </Td>
                                  <Td className="text-right">
                                    <Link
                                      href={`/app/exams?course_id=${course.id}`}
                                      className="inline-flex items-center text-xs font-medium text-accent hover:text-accent-strong"
                                      aria-label={`View exams for ${course.course_code}`}
                                    >
                                      <ExternalLink className="h-3.5 w-3.5" />
                                    </Link>
                                  </Td>
                                </tr>
                              );
                            })}
                        </TableBody>
                      </Table>
                    </div>)}
                  </div>
                );
              })}
            </Card>
          )}
          </>
        )}
        </div>
      );
    }
