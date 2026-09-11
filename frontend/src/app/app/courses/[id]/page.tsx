"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getCourse, updateCourse } from "@/lib/api/courses";
import { Card, CardContent, Button, Input } from "@/components";
import { PageLoader } from "@/components/spinner";
import { ChevronLeft, Edit2, Check, X } from "lucide-react";
import type { Course } from "@/lib/types";

export default function CourseDetailPage() {
  const params = useParams();
  const courseId = params.id as string;

  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ course_code: "", course_name: "", department: "" });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getCourse(courseId)
      .then((c) => { if (!cancelled) setCourse(c); })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : String(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [courseId]);

  useEffect(() => {
    if (course) {
      setForm({ course_code: course.course_code, course_name: course.course_name, department: course.department ?? "" });
    }
  }, [course]);

  const handleSave = async () => {
    if (!course) return;
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await updateCourse(course.id, {
        course_code: form.course_code,
        course_name: form.course_name,
        department: form.department || undefined,
      });
      setCourse(updated);
      setEditing(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to update course");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader />;
  if (error && !course) return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-2xl font-bold text-black dark:text-white">Course Not Found</h1>
      <p className="text-sm text-zinc-500">{error}</p>
      <Link href="/app/courses" className="text-sm text-blue-600 hover:underline">Back to Courses</Link>
    </div>
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/app/courses" className="text-zinc-500 hover:text-black dark:hover:text-white">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-black dark:text-white">
              {course?.course_code ?? "Course"}
            </h1>
            <p className="text-sm text-zinc-500">{course?.course_name}</p>
          </div>
        </div>
        {course && (
          editing ? (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                <X className="mr-1 h-4 w-4" />Cancel
              </Button>
              <Button size="sm" onClick={handleSave} loading={saving}>
                <Check className="mr-1 h-4 w-4" />Save
              </Button>
            </div>
          ) : (
            <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
              <Edit2 className="mr-1 h-4 w-4" />Edit
            </Button>
          )
        )}
      </div>

      {saveError && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {saveError}
        </div>
      )}

      {/* Detail Card */}
      <Card>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-zinc-500">ID</span>
              <p className="font-mono text-xs mt-1 truncate max-w-xs">{course?.id}</p>
            </div>
            <div>
              <span className="text-zinc-500">Department</span>
              <p className="font-medium mt-1">{course?.department ?? "—"}</p>
            </div>
            <div>
              <span className="text-zinc-500">Course Code</span>
              <p className="font-medium mt-1 font-mono">{course?.course_code}</p>
            </div>
            <div>
              <span className="text-zinc-500">Course Name</span>
              <p className="font-medium mt-1">{course?.course_name}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-zinc-500">Created</span>
              <p className="mt-1 text-zinc-600 text-xs">{course?.created_at ? new Date(course.created_at).toLocaleString() : "—"}</p>
            </div>
            <div>
              <span className="text-zinc-500">Last Updated</span>
              <p className="mt-1 text-zinc-600 text-xs">{course?.updated_at ? new Date(course.updated_at).toLocaleString() : "—"}</p>
            </div>
          </div>

          {/* Edit form */}
          {editing && course && (
            <div className="space-y-4 pt-2 border-t border-zinc-200 dark:border-zinc-700">
              <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Edit Course</h3>
              <Input
                label="Course Code"
                value={form.course_code}
                onChange={(e) => setForm({ ...form, course_code: e.target.value })}
                required
              />
              <Input
                label="Course Name"
                value={form.course_name}
                onChange={(e) => setForm({ ...form, course_name: e.target.value })}
                required
              />
              <Input
                label="Department"
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3">
        <Link href={`/app/exams/new?course_id=${encodeURIComponent(course?.id ?? "")}`} style={{ textDecoration: "none" }}>
          <Button>Create Exam for {course?.course_code}</Button>
        </Link>
        <Link href="/app/courses" style={{ textDecoration: "none" }}>
          <Button variant="secondary">Back to Courses</Button>
        </Link>
      </div>
    </div>
  );
}