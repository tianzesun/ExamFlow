"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { deleteCourse, getCourse, updateCourse } from "@/lib/api/courses";
import { errorReference } from "@/lib/api/client";
import { getAllExams } from "@/lib/api/exams";
import { useAuth } from "@/lib/auth/context";
import { CoursePeopleCard } from "@/components/course/CoursePeopleCard";
import {
  Button,
  Input,
  Badge,
  EmptyState,
  PageHeader,
  PageContainer,
  STATUS_BADGES,
} from "@/components";
import { PageLoader } from "@/components/spinner";
import { Pencil, Plus, BookOpen, FileText, ChevronRight, AlertCircle, Trash2 } from "lucide-react";
import type { Course, Exam } from "@/lib/types";
import { formatDate, formatDateTime, formatTime, plural } from "@/lib/format";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  CONFIGURED: "Configured",
  READY: "Ready",
  GENERATED: "Generated",
  COMPLETED: "Completed",
  ARCHIVED: "Archived",
};

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-ink-3">{label}</dt>
      <dd className="mt-1 truncate text-sm text-ink">{children}</dd>
    </div>
  );
}

export default function CourseDetailPage() {
  const params = useParams();
  const courseId = params.id as string;
  const { user } = useAuth();
  // The exam office edits courses and decides who else can see them.
  const isExamOffice = user?.role === "ADMIN" || user?.role === "STAFF";

  const [course, setCourse] = useState<Course | null>(null);
  const [exams, setExams] = useState<Exam[] | null>(null);
  const [examsError, setExamsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ course_code: "", course_name: "", department: "" });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    getCourse(courseId)
      .then((c) => { if (!cancelled) setCourse(c); })
      .catch(() => { if (!cancelled) setError("This course could not be found or you don't have access to it."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    getAllExams({ course_id: courseId })
      .then((r) => { if (!cancelled) setExams(r.exams ?? []); })
      // Not an empty list: that would read as "no exams" and offer to delete the course.
      .catch((err) => {
        if (!cancelled) setExamsError(`This course's exams couldn't be loaded. Try again in a moment.${errorReference(err)}`);
      });
    return () => { cancelled = true; };
  }, [courseId]);

  const startEdit = () => {
    if (course) setForm({ course_code: course.course_code, course_name: course.course_name, department: course.department ?? "" });
    setSaveError(null);
    setEditing(true);
  };

  const cancelEdit = () => {
    setSaveError(null);
    setEditing(false);
  };

  const handleSave = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!course) return;
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await updateCourse(course.id, {
        course_code: form.course_code,
        course_name: form.course_name,
        // null clears it; leaving it out would keep the old department.
        department: form.department.trim() || null,
      });
      setCourse(updated);
      setEditing(false);
    } catch {
      setSaveError("We couldn't save your changes. Check the fields and try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!course) return;
    if (!confirm(`Delete ${course.course_code}? This can't be undone.`)) return;
    try {
      await deleteCourse(course.id);
      toast.success(`${course.course_code} deleted`);
      router.push("/app/courses");
    } catch (err) {
      toast.error(`The course couldn't be deleted. Try again.${errorReference(err)}`);
    }
  };

  if (loading) return <PageLoader />;
  if (error && !course)
    return (
      <PageContainer>
        <div className="surface-card">
          <EmptyState
            icon={<BookOpen className="h-5 w-5 text-ink-3" />}
            title="Course not found"
            description={error}
            action={
              <Link href="/app/courses">
                <Button variant="secondary">Back to courses</Button>
              </Link>
            }
          />
        </div>
      </PageContainer>
    );
  if (!course) return null;

  const newExamHref = `/app/exams/new?course_id=${encodeURIComponent(course.id)}`;

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        eyebrow={<span className="font-mono normal-case tracking-normal">{course.course_code}</span>}
        title={course.course_name}
        meta={course.department ? <Badge>{course.department}</Badge> : <Badge variant="warning">No department</Badge>}
        actions={
          <>
            {isExamOffice && !editing && exams !== null && exams.length === 0 && (
              <Button variant="ghost" className="text-ink-3 hover:text-danger" onClick={handleDelete} title="Only courses without exams can be deleted">
                <Trash2 /> Delete
              </Button>
            )}
            {isExamOffice && !editing && (
              <Button variant="secondary" onClick={startEdit}>
                <Pencil /> Edit
              </Button>
            )}
            {isExamOffice && (
              <Link href={newExamHref}>
                <Button>
                  <Plus /> Create exam
                </Button>
              </Link>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-1">
          {/* Details / edit */}
          <section className="surface-card">
            <div className="border-b border-line px-5 py-3.5">
              <h2 className="text-sm font-semibold text-ink">{editing ? "Edit course" : "Details"}</h2>
              <p className="text-xs text-ink-3">
                {editing ? "Changes apply to all exams for this course." : "Course record and history."}
              </p>
            </div>

            {editing ? (
              <form onSubmit={handleSave}>
                <div className="space-y-4 px-5 py-4">
                  <Input
                    label="Course code"
                    value={form.course_code}
                    onChange={(e) => setForm({ ...form, course_code: e.target.value })}
                    className="font-mono"
                    required
                  />
                  <Input
                    label="Course name"
                    value={form.course_name}
                    onChange={(e) => setForm({ ...form, course_name: e.target.value })}
                    required
                  />
                  <Input
                    label="Department"
                    value={form.department}
                    placeholder="e.g. Computer Science"
                    onChange={(e) => setForm({ ...form, department: e.target.value })}
                  />
                  {saveError && (
                    <div role="alert" className="flex items-start gap-2 rounded-lg border border-danger/25 bg-danger/10 px-3 py-2 text-sm text-danger">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      {saveError}
                    </div>
                  )}
                </div>
                <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
                  <Button type="button" variant="secondary" size="sm" onClick={cancelEdit}>
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" loading={saving}>
                    Save changes
                  </Button>
                </div>
              </form>
            ) : (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-4 px-5 py-4 lg:grid-cols-1">
                <Field label="Course code">
                  <span className="font-mono text-xs">{course.course_code}</span>
                </Field>
                <Field label="Department">{course.department ?? <span className="text-ink-3">Not set</span>}</Field>
                <Field label="Created">
                  <span className="tnum">{formatDateTime(course.created_at)}</span>
                </Field>
                <Field label="Last updated">
                  <span className="tnum">{formatDateTime(course.updated_at)}</span>
                </Field>
                <Field label="Course ID">
                  <span className="font-mono text-xs text-ink-2" title={course.id}>
                    {course.id}
                  </span>
                </Field>
              </dl>
            )}
          </section>

          <CoursePeopleCard courseId={course.id} canManage={isExamOffice} />
        </div>

        {/* Exams for this course */}
        <section className="surface-card overflow-hidden lg:col-span-2">
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
            <div>
              <h2 className="text-sm font-semibold text-ink">Exams</h2>
              <p className="text-xs text-ink-3">
                {exams === null ? "Loading…" : exams.length ? plural(exams.length, "exam") : "Nothing scheduled yet"}
              </p>
            </div>
            {exams && exams.length > 0 && (
              <Link
                href={`/app/exams?course_id=${course.id}`}
                className="text-xs font-medium text-accent hover:text-accent-strong"
              >
                View on board
              </Link>
            )}
          </div>
          {examsError ? (
            <EmptyState
              icon={<FileText className="h-5 w-5 text-ink-3" />}
              title="Exams couldn't be loaded"
              description={examsError}
            />
          ) : exams === null ? (
            <div className="space-y-2 p-5">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded-md bg-surface-2" />
              ))}
            </div>
          ) : exams.length === 0 ? (
            <EmptyState
              icon={<FileText className="h-5 w-5 text-ink-3" />}
              title="No exams for this course"
              description={isExamOffice ? "Create an exam to start assigning rooms and seats." : "The exam office hasn't scheduled one yet."}
              action={
                isExamOffice ? (
                  <Link href={newExamHref}>
                    <Button>
                      <Plus /> Create exam
                    </Button>
                  </Link>
                ) : undefined
              }
            />
          ) : (
            <ul className="divide-y divide-line">
              {exams.map((exam) => {
                const time = formatTime(exam.start_time);
                return (
                  <li key={exam.id}>
                    <Link
                      href={`/app/exams/${exam.id}`}
                      className="group flex items-center gap-4 px-5 py-3 transition-colors hover:bg-surface-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink group-hover:text-accent">{exam.exam_name}</p>
                        <p className="tnum mt-0.5 text-xs text-ink-3">
                          {formatDate(exam.exam_date)}
                          {time && ` · ${time}`} · {exam.term} {exam.academic_year}
                        </p>
                      </div>
                      <Badge variant={STATUS_BADGES[exam.status] ?? "default"}>
                        {STATUS_LABEL[exam.status] ?? exam.status}
                      </Badge>
                      <ChevronRight className="h-4 w-4 shrink-0 text-ink-3 group-hover:text-ink" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </PageContainer>
  );
}
