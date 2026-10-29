"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { createCourse } from "@/lib/api/courses";
import { Input, Button, PageHeader, PageContainer } from "@/components";

export default function NewCoursePage() {
  const router = useRouter();
  const [form, setForm] = useState({ course_code: "", course_name: "", department: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await createCourse(form);
      router.push("/app/courses");
    } catch {
      setError("We couldn't create this course. Check that the course code isn't already in use and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer className="space-y-6">
      <PageHeader eyebrow="Courses" title="Create course" description="Add a course that isn't available from the Timetable Builder sync." />

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <form onSubmit={handleSubmit} className="surface-card accent-top animate-rise">
          <section className="space-y-4 px-5 py-5 sm:px-6">
            <div>
              <h2 className="text-sm font-semibold text-ink">Course details</h2>
              <p className="text-xs text-ink-3">Use the official code as it appears in the academic calendar.</p>
            </div>
            <Input
              label="Course code"
              placeholder="e.g. CSC108H5"
              value={form.course_code}
              onChange={(e) => setForm({ ...form, course_code: e.target.value })}
              className="font-mono"
              autoComplete="off"
              required
            />
            <Input
              label="Course name"
              placeholder="e.g. Introduction to Computer Programming"
              value={form.course_name}
              onChange={(e) => setForm({ ...form, course_name: e.target.value })}
              required
            />
          </section>

          <section className="space-y-4 border-t border-line px-5 py-5 sm:px-6">
            <div>
              <h2 className="text-sm font-semibold text-ink">Organization</h2>
              <p className="text-xs text-ink-3">Courses are grouped by department on the course list.</p>
            </div>
            <Input
              label="Department"
              placeholder="e.g. Computer Science"
              hint="Optional"
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
            />
          </section>

          {error && (
            <div className="px-5 pb-5 sm:px-6">
              <div role="alert" className="flex items-start gap-2 rounded-lg border border-danger/25 bg-danger/10 px-3 py-2 text-sm text-danger">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-line bg-surface-2 px-5 py-3 sm:px-6 rounded-b-[inherit]">
            <Link href="/app/courses">
              <Button variant="secondary" type="button">Cancel</Button>
            </Link>
            <Button type="submit" loading={loading}>Create course</Button>
          </div>
        </form>

        <aside className="hero-panel animate-rise px-5 py-5 xl:sticky xl:top-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">Preview</p>
          <p className="mt-3 font-mono text-sm text-white/75">{form.course_code || "COURSE CODE"}</p>
          <p className="mt-1 text-xl font-semibold tracking-tight">{form.course_name || "Course name"}</p>
          <p className="mt-1 text-sm text-white/65">{form.department || "No department"}</p>
          <p className="mt-5 text-xs leading-relaxed text-white/70">
            Most courses arrive automatically from the Timetable Builder sync. Create one here only when it&rsquo;s missing.
          </p>
        </aside>
      </div>
    </PageContainer>
  );
}
