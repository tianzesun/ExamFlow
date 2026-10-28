"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { createExam } from "@/lib/api/exams";
import { getCourses } from "@/lib/api/courses";
import type { Course } from "@/lib/types";
import { Input, Select, Button, PageHeader, PageContainer } from "@/components";

export default function NewExamPage() {
  // useSearchParams (for ?course_id= prefill) needs a Suspense boundary.
  return (
    <Suspense fallback={null}>
      <NewExamForm />
    </Suspense>
  );
}

function NewExamForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [courses, setCourses] = useState<Course[]>([]);
  const [form, setForm] = useState({
    course_id: searchParams.get("course_id") ?? "",
    exam_name: "",
    term: "Fall",
    academic_year: new Date().getFullYear(),
    exam_date: "",
    start_time: "",
    duration_minutes: 120,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getCourses(1, 100).then((d) => setCourses(d.courses)).catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await createExam(form);
      router.push("/app/exams");
    } catch {
      setError("We couldn't create this exam. Check the details and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer className="space-y-6">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <PageHeader title="Create exam" description="Set up an examination. You can add rooms and seating after it's created." />

        <form onSubmit={handleSubmit} className="surface-card">
          <section className="space-y-4 px-5 py-5 sm:px-6">
            <div>
              <h2 className="text-sm font-semibold text-ink">Exam</h2>
              <p className="text-xs text-ink-3">Which course this exam belongs to and what it&rsquo;s called.</p>
            </div>
            <Select
              label="Course"
              options={courses.map((c) => ({ value: c.id, label: `${c.course_code} — ${c.course_name}` }))}
              placeholder={courses.length ? "Select a course" : "Loading courses…"}
              value={form.course_id}
              onChange={(e) => setForm({ ...form, course_id: e.target.value })}
              required
            />
            <Input
              label="Exam name"
              placeholder="e.g. Final Examination"
              value={form.exam_name}
              onChange={(e) => setForm({ ...form, exam_name: e.target.value })}
              required
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Select
                label="Term"
                options={[
                  { value: "Fall", label: "Fall" },
                  { value: "Winter", label: "Winter" },
                  { value: "Spring", label: "Spring" },
                  { value: "Summer", label: "Summer" },
                ]}
                value={form.term}
                onChange={(e) => setForm({ ...form, term: e.target.value })}
              />
              <Input
                label="Academic year"
                type="number"
                className="tnum"
                value={form.academic_year}
                onChange={(e) => setForm({ ...form, academic_year: parseInt(e.target.value) })}
              />
            </div>
          </section>

          <section className="space-y-4 border-t border-line px-5 py-5 sm:px-6">
            <div>
              <h2 className="text-sm font-semibold text-ink">Schedule</h2>
              <p className="text-xs text-ink-3">Date, start time and length of the sitting.</p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Input
                label="Date"
                type="date"
                value={form.exam_date}
                onChange={(e) => setForm({ ...form, exam_date: e.target.value })}
                required
              />
              <Input
                label="Start time"
                type="time"
                value={form.start_time}
                onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                required
              />
              <Input
                label="Duration (minutes)"
                type="number"
                min={1}
                className="tnum"
                value={form.duration_minutes}
                onChange={(e) => setForm({ ...form, duration_minutes: parseInt(e.target.value) })}
              />
            </div>
          </section>

          {error && (
            <div className="px-5 pb-5 sm:px-6">
              <div role="alert" className="flex items-start gap-2 rounded-lg border border-danger/25 bg-danger/10 px-3 py-2 text-sm text-danger">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 rounded-b-[inherit] border-t border-line bg-surface-2 px-5 py-3 sm:px-6">
            <Link href="/app/exams">
              <Button variant="secondary" type="button">Cancel</Button>
            </Link>
            <Button type="submit" loading={loading}>Create exam</Button>
          </div>
        </form>
      </div>
    </PageContainer>
  );
}
