"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  BookOpen,
  Search,
  Building2,
  CalendarCheck,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  X,
} from "lucide-react";
import { getCourses } from "@/lib/api/courses";
import { getAllExams } from "@/lib/api/exams";
import { syncTTBCourses } from "@/lib/api/ttb";
import { errorReference } from "@/lib/api/client";
import type { ReactNode } from "react";
import type { Course, Exam } from "@/lib/types";
import { formatNumber, plural } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
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
  PageHeader,
  PageContainer,
} from "@/components";

interface CourseStats {
  examCount: number;
  statusCounts: Record<string, number>;
}

const NO_DEPARTMENT = "No department";

function highlight(text: string, q: string): ReactNode {
  const needle = q.trim();
  if (!needle) return text;
  const re = new RegExp(`(${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  return text
    .split(re)
    .filter(Boolean)
    .map((p, i) =>
      p.toLowerCase() === needle.toLowerCase() ? (
        <mark key={i} className="rounded-sm bg-accent/15 px-0.5 text-inherit">
          {p}
        </mark>
      ) : (
        <Fragment key={i}>{p}</Fragment>
      )
    );
}

const STATUS_ORDER: readonly string[] = ["DRAFT", "CONFIGURED", "READY", "GENERATED", "COMPLETED"];
const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  CONFIGURED: "Configured",
  READY: "Ready",
  GENERATED: "Generated",
  COMPLETED: "Completed",
};

export default function CoursesPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("ALL");
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ ok: boolean; message: string } | null>(null);

  const loadData = () => {
    getCourses(1, 100)
      .then((cs) => {
        setCourses(cs.courses ?? []);
        setTotal(cs.total ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    getAllExams()
      .then((es) => setExams(es.exams ?? []))
      .catch(() => {});
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const result = await syncTTBCourses("20269");
      setSyncResult({ ok: true, message: `Synced ${plural(result.synced, "course")} from the Timetable Builder.` });
      loadData();
    } catch (err) {
      setSyncResult({ ok: false, message: `Sync from the Timetable Builder failed. Please try again in a few minutes.${errorReference(err)}` });
    } finally {
      setSyncing(false);
    }
  };

  const perCourse = useMemo(() => {
    const map: Record<string, CourseStats> = {};
    for (const e of exams) {
      const cur = map[e.course_id] ?? { examCount: 0, statusCounts: {} };
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
        (departmentFilter === NO_DEPARTMENT ? !course.department : (course.department ?? "") === departmentFilter);
      return matchesSearch && matchesDept;
    });
  }, [courses, searchQuery, departmentFilter]);

  // Group filtered courses by department; courses without one go last.
  const groups = useMemo(() => {
    const grouped = new Map<string, Course[]>();
    for (const c of filteredCourses) {
      const key = c.department ?? NO_DEPARTMENT;
      const arr = grouped.get(key) ?? [];
      arr.push(c);
      grouped.set(key, arr);
    }
    for (const arr of grouped.values()) arr.sort((a, b) => a.course_code.localeCompare(b.course_code));
    return Array.from(grouped.entries()).sort(([a], [b]) =>
      a === NO_DEPARTMENT ? 1 : b === NO_DEPARTMENT ? -1 : a.localeCompare(b)
    );
  }, [filteredCourses]);

  const coursesWithExams = courses.filter((c) => (perCourse[c.id]?.examCount ?? 0) > 0).length;
  const unassigned = courses.filter((c) => !c.department).length;

  const toggle = (key: string) => setOpenGroups((prev) => ({ ...prev, [key]: !(prev[key] ?? true) }));

  const hasFilters = searchQuery.length > 0 || departmentFilter !== "ALL";
  const resetFilters = () => {
    setSearchQuery("");
    setDepartmentFilter("ALL");
  };

  return (
    <PageContainer className="animate-fade-in space-y-6">
      <PageHeader
        title="Courses"
        meta={!loading && total > 0 ? <Badge className="tnum">{formatNumber(total)}</Badge> : undefined}
        description="Courses available for exam scheduling, grouped by department."
        actions={
          <>
            <Button variant="secondary" onClick={handleSync} disabled={syncing}>
              <RefreshCw className={cn(syncing && "animate-spin")} />
              {syncing ? "Syncing…" : "Sync from TTB"}
            </Button>
            <Link href="/app/courses/new">
              <Button>
                <Plus /> Create course
              </Button>
            </Link>
          </>
        }
      />

      {syncResult && (
        <div
          role="status"
          className={cn(
            "flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-sm",
            syncResult.ok ? "border-success/25 bg-success/10 text-success" : "border-danger/25 bg-danger/10 text-danger"
          )}
        >
          {syncResult.ok ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <p className="flex-1">{syncResult.message}</p>
          <button
            type="button"
            onClick={() => setSyncResult(null)}
            aria-label="Dismiss"
            className="rounded p-0.5 opacity-70 hover:opacity-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
          <Skeleton className="h-9 w-full" />
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonRow key={i} lines={4} />
          ))}
        </div>
      ) : courses.length === 0 ? (
        <div className="surface-card">
          <EmptyState
            icon={<BookOpen className="h-5 w-5 text-ink-3" />}
            title="No courses yet"
            description="Sync courses from the Timetable Builder or add one manually."
            action={
              <Link href="/app/courses/new">
                <Button>
                  <Plus /> Create course
                </Button>
              </Link>
            }
          />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard icon={BookOpen} label="Courses" value={courses.length} color="accent" hint={`${plural(departments.length, "department")}`} />
            <StatCard
              icon={CalendarCheck}
              label="With exams"
              value={coursesWithExams}
              color="success"
              hint={`of ${plural(courses.length, "course")}`}
              progress={courses.length ? coursesWithExams / courses.length : 0}
            />
            <StatCard
              icon={Building2}
              label="Missing department"
              value={unassigned}
              color={unassigned > 0 ? "warning" : "neutral"}
              hint={unassigned > 0 ? "Assign one so courses group correctly" : "All courses assigned"}
            />
          </div>

          {/* Toolbar */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
              <input
                type="search"
                aria-label="Search courses"
                placeholder="Search by code or name"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 w-full rounded-lg border border-line-strong bg-surface pl-8 pr-3 text-sm text-ink shadow-[var(--shadow-sm)] placeholder:text-ink-3 focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15"
              />
            </div>
            <select
              aria-label="Filter by department"
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="h-9 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink shadow-[var(--shadow-sm)] focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15 sm:w-56 [&>option]:bg-surface"
            >
              <option value="ALL">All departments</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
              {unassigned > 0 && <option value={NO_DEPARTMENT}>{NO_DEPARTMENT}</option>}
            </select>
            {hasFilters && (
              <Button variant="ghost" size="sm" className="self-start sm:self-auto" onClick={resetFilters}>
                <X /> Clear
              </Button>
            )}
            <span className="tnum text-xs text-ink-3 sm:ml-auto">
              {hasFilters
                ? `${formatNumber(filteredCourses.length)} of ${formatNumber(courses.length)}`
                : plural(courses.length, "course")}
            </span>
          </div>

          {filteredCourses.length === 0 ? (
            <div className="surface-card">
              <EmptyState
                icon={<Search className="h-5 w-5 text-ink-3" />}
                title="No courses match your filters"
                description="Try a different code, name or department."
                action={
                  <Button variant="secondary" onClick={resetFilters}>
                    Clear filters
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="surface-card overflow-hidden">
              <Table>
                <TableHead>
                  <Th className="w-40">Code</Th>
                  <Th>Name</Th>
                  <Th className="w-20 text-right">Exams</Th>
                  <Th className="w-64">Status</Th>
                  <Th className="w-10">
                    <span className="sr-only">Open</span>
                  </Th>
                </TableHead>
                {groups.map(([dept, deptCourses]) => {
                  const isOpen = openGroups[dept] ?? true;
                  return (
                    <TableBody key={dept}>
                      <tr className="bg-surface-2 hover:!bg-surface-2">
                        <td colSpan={5} className="p-0">
                          <button
                            type="button"
                            onClick={() => toggle(dept)}
                            aria-expanded={isOpen}
                            className="flex w-full items-center gap-2 px-4 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/30"
                          >
                            {isOpen ? (
                              <ChevronDown className="h-3.5 w-3.5 text-ink-3" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5 text-ink-3" />
                            )}
                            <span
                              className={cn(
                                "text-xs font-semibold",
                                dept === NO_DEPARTMENT ? "text-ink-3" : "text-ink"
                              )}
                            >
                              {dept}
                            </span>
                            <span className="tnum text-xs text-ink-3">{formatNumber(deptCourses.length)}</span>
                          </button>
                        </td>
                      </tr>
                      {isOpen &&
                        deptCourses.map((course) => {
                          const stats = perCourse[course.id];
                          const examCount = stats?.examCount ?? 0;
                          const statusCounts = stats?.statusCounts ?? {};
                          const href = `/app/courses/${course.id}`;
                          return (
                            <tr
                              key={course.id}
                              onClick={(e) => {
                                if ((e.target as HTMLElement).closest("a,button")) return;
                                router.push(href);
                              }}
                              className="group cursor-pointer"
                            >
                              <Td className="whitespace-nowrap">
                                <Link
                                  href={href}
                                  className="font-mono text-xs font-medium text-ink group-hover:text-accent focus-visible:outline-none focus-visible:underline"
                                >
                                  {highlight(course.course_code, searchQuery)}
                                </Link>
                              </Td>
                              <Td className="text-ink-2">{highlight(course.course_name, searchQuery)}</Td>
                              <Td className="tnum text-right">
                                {examCount > 0 ? (
                                  <Link
                                    href={`/app/exams?course_id=${course.id}`}
                                    className="text-ink hover:text-accent hover:underline"
                                    aria-label={`View ${plural(examCount, "exam")} for ${course.course_code}`}
                                  >
                                    {formatNumber(examCount)}
                                  </Link>
                                ) : (
                                  <span className="text-ink-3">0</span>
                                )}
                              </Td>
                              <Td>
                                {examCount === 0 ? (
                                  <span className="text-xs text-ink-3">No exams</span>
                                ) : (
                                  <div className="flex flex-wrap items-center gap-1">
                                    {Object.entries(statusCounts)
                                      .filter(([, n]) => n > 0)
                                      .sort(([a], [b]) => STATUS_ORDER.indexOf(a) - STATUS_ORDER.indexOf(b))
                                      .map(([s, n]) => (
                                        <Badge key={s} variant={STATUS_BADGES[s] ?? "default"}>
                                          {STATUS_LABEL[s] ?? s}
                                          {n > 1 && <span className="tnum opacity-70">{n}</span>}
                                        </Badge>
                                      ))}
                                  </div>
                                )}
                              </Td>
                              <Td className="pr-3 text-right">
                                <ChevronRight className="ml-auto h-4 w-4 text-ink-3 transition-transform group-hover:translate-x-0.5 group-hover:text-ink" />
                              </Td>
                            </tr>
                          );
                        })}
                    </TableBody>
                  );
                })}
              </Table>
            </div>
          )}
        </>
      )}
    </PageContainer>
  );
}
