"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Plus,
  BookOpen,
  Search,
  Building2,
  FileText,
  ArrowUpRight,
} from "lucide-react";
import { getCourses } from "@/lib/api/courses";
import {
  Card,
  Button,
  Table,
  TableHead,
  TableBody,
  Th,
  Td,
  PageLoader,
  EmptyState,
  Badge,
  StatCard,
} from "@/components";

/* =============================== Types =============================== */
interface Course {
  id: string;
  course_code: string;
  course_name: string;
  department: string | null;
}

/* ============================= Helpers ============================= */
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
  const colors = ["info", "violet", "warning", "success"] as const;
  return colors[seed % colors.length];
};

/* ============================== Page ============================== */
export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("ALL");

  useEffect(() => {
    getCourses(1, 100)
      .then((d) => {
        setCourses(d.courses ?? []);
        setTotal(d.total ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  /* Distinct departments for filter dropdown */
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

  const hasFilters = searchQuery.length > 0 || departmentFilter !== "ALL";

  const withCodeCount = courses.filter((c) => c.course_code).length;
  const withDeptCount = courses.filter((c) => c.department).length;

  return (
    <div className="animate-fade-in space-y-6">
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-ink">Courses</h1>
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
        <PageLoader />
      ) : courses.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="h-6 w-6 text-ink-3" />}
          title="No courses yet"
          description="Create your first course to get started"
          action={
            <Link href="/app/courses/new">
              <Button>
                <Plus className="h-4 w-4" /> Create Course
              </Button>
            </Link>
          }
        />
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
            <StatCard
              icon={FileText}
              label="With Code"
              value={withCodeCount}
            />
            <StatCard
              icon={Building2}
              label="Departments"
              value={departments.length}
              color="violet"
            />
            <StatCard
              icon={Building2}
              label="Dept. Assigned"
              value={`${withDeptCount}/${courses.length}`}
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
                className="w-full rounded-md border border-line bg-surface px-3 py-1.5 pl-8 text-sm text-ink transition-shadow placeholder:text-ink-3 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
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
                onClick={() => {
                  setSearchQuery("");
                  setDepartmentFilter("ALL");
                }}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-accent transition-colors hover:text-accent-strong"
              >
                Clear
              </button>
            )}
            <span className="tnum ml-auto text-xs text-ink-3">
              {filteredCourses.length} of {courses.length}
            </span>
          </div>

          {/* Courses table */}
          <Card>
            <Table>
              <TableHead>
                <Th>Code</Th>
                <Th>Name</Th>
                <Th>Department</Th>
              </TableHead>
              <TableBody>
                {filteredCourses.length === 0 ? (
                  <tr>
                    <Td colSpan={3} className="py-12 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <Search className="h-5 w-5 text-ink-3" />
                        <p className="text-sm text-ink-2">
                          No courses match your filters
                        </p>
                      </div>
                    </Td>
                  </tr>
                ) : (
                  filteredCourses.map((course) => (
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
                            {course.course_code}
                          </Link>
                        </div>
                      </Td>
                      <Td>
                        <p className="font-medium text-ink">{course.course_name}</p>
                      </Td>
                      <Td>
                        {course.department ? (
                          <Badge variant={departmentColor(course.department)}>
                            {course.department}
                          </Badge>
                        ) : (
                          <span className="text-xs text-ink-3">—</span>
                        )}
                      </Td>
                    </tr>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
}
