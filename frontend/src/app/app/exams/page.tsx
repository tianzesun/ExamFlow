"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Calendar, Filter, X } from "lucide-react";
import { getExams, ExamFilters } from "@/lib/api/exams";
import { getCourses } from "@/lib/api/courses";
import { Card, Badge, Button, Select, Table, TableHead, TableBody, Th, Td, PageLoader, EmptyState, STATUS_BADGES } from "@/components";

export default function ExamsPage() {
  const [exams, setExams] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<ExamFilters>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCourses(1, 100).then((d) => setCourses(d.courses)).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    getExams(filters, page, 20)
      .then((d) => { setExams(d.exams); setTotal(d.total); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filters, page]);

  const hasFilters = filters.course_id || filters.term || filters.status;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-black dark:text-white">Exams</h1>
          <p className="text-sm text-zinc-500">{total} exam{total !== 1 ? "s" : ""}</p>
        </div>
        <Link href="/app/exams/new">
          <Button><Plus className="h-4 w-4" /> Create Exam</Button>
        </Link>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <Filter className="h-4 w-4" /> Filters:
          </div>
          <Select
            options={courses.map((c) => ({ value: c.id, label: `${c.course_code} — ${c.course_name}` }))}
            placeholder="All courses"
            value={filters.course_id || ""}
            onChange={(e) => setFilters((f) => ({ ...f, course_id: e.target.value || undefined }))}
            className="w-48"
          />
          <Select
            options={[
              { value: "Fall", label: "Fall" },
              { value: "Winter", label: "Winter" },
              { value: "Spring", label: "Spring" },
              { value: "Summer", label: "Summer" },
            ]}
            placeholder="All terms"
            value={filters.term || ""}
            onChange={(e) => setFilters((f) => ({ ...f, term: e.target.value || undefined }))}
            className="w-36"
          />
          <Select
            options={[
              { value: "DRAFT", label: "Draft" },
              { value: "CONFIGURED", label: "Configured" },
              { value: "READY", label: "Ready" },
              { value: "GENERATED", label: "Generated" },
              { value: "COMPLETED", label: "Completed" },
              { value: "ARCHIVED", label: "Archived" },
            ]}
            placeholder="All statuses"
            value={filters.status || ""}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value || undefined }))}
            className="w-40"
          />
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={() => { setFilters({}); setPage(1); }}>
              <X className="h-3 w-3" /> Clear
            </Button>
          )}
        </div>
      </Card>

      {loading ? (
        <PageLoader />
      ) : exams.length === 0 ? (
        <EmptyState
          title={hasFilters ? "No exams match filters" : "No exams yet"}
          description={hasFilters ? "Try adjusting your filters" : "Create your first exam to get started"}
          action={!hasFilters ? <Link href="/app/exams/new"><Button>Create Exam</Button></Link> : undefined}
        />
      ) : (
        <Card>
          <Table>
            <TableHead>
              <Th>Course</Th>
              <Th>Exam</Th>
              <Th>Term</Th>
              <Th>Date</Th>
              <Th>Status</Th>
            </TableHead>
            <TableBody>
              {exams.map((exam) => (
                <tr key={exam.id} className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                  <Td>
                    <Link href={`/app/exams/${exam.id}`} className="font-medium text-black hover:underline dark:text-white">
                      {exam.course_code}
                    </Link>
                  </Td>
                  <Td className="text-zinc-600 dark:text-zinc-400">{exam.exam_name}</Td>
                  <Td className="text-zinc-600 dark:text-zinc-400">{exam.term} {exam.academic_year}</Td>
                  <Td>
                    <span className="flex items-center gap-1 text-zinc-600 dark:text-zinc-400">
                      <Calendar className="h-3 w-3" /> {exam.exam_date}
                    </span>
                  </Td>
                  <Td><Badge variant={STATUS_BADGES[exam.status]}>{exam.status}</Badge></Td>
                </tr>
              ))}
            </TableBody>
          </Table>
          {total > 20 && (
            <div className="flex items-center justify-between border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">
              <span className="text-sm text-zinc-500">Page {page} of {Math.ceil(total / 20)}</span>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Prev</Button>
                <Button variant="secondary" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page * 20 >= total}>Next</Button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
