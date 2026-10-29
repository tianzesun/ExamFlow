"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertCircle, Calendar, Clock, DoorOpen, FileText, Printer, Timer, Users } from "lucide-react";
import { createExam } from "@/lib/api/exams";
import { getCourses } from "@/lib/api/courses";
import { errorReference } from "@/lib/api/client";
import type { Course } from "@/lib/types";
import { formatDateLong, formatTime } from "@/lib/format";
import { Input, Select, Button, PageHeader, PageContainer } from "@/components";

const NEXT_STEPS = [
  { icon: Users, title: "Students", text: "Import the class list from a CSV file." },
  { icon: DoorOpen, title: "Seats", text: "Add rooms and assign every student a seat." },
  { icon: FileText, title: "Exam papers", text: "Upload the paper and generate a copy per student." },
  { icon: Printer, title: "Exam day", text: "Print sign-in sheets and record attendance." },
];

function endTime(start: string, minutes: number): string {
  if (!start || !minutes) return "";
  const [h, m] = start.split(":").map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

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
    notes: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getCourses(1, 100).then((d) => setCourses(d.courses)).catch(() => {});
  }, []);

  const course = courses.find((c) => c.id === form.course_id);
  const ends = endTime(form.start_time, form.duration_minutes);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const exam = await createExam({ ...form, notes: form.notes.trim() || null });
      // Go straight to the new exam so staff can start on step 1.
      router.push(`/app/exams/${exam.id}`);
    } catch (err) {
      setError(`We couldn't create this exam. Check the details and try again.${errorReference(err)}`);
      setLoading(false);
    }
  };

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        eyebrow="Exams"
        title="Create exam"
        description="Set up the sitting. You'll add students, seats and the exam paper next."
      />

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <form onSubmit={handleSubmit} className="surface-card accent-top animate-rise">
          <section className="grid grid-cols-1 gap-x-8 gap-y-4 px-5 py-6 sm:px-7 lg:grid-cols-[220px_minmax(0,1fr)]">
            <div>
              <h2 className="text-sm font-semibold text-ink">Exam</h2>
              <p className="mt-0.5 text-xs text-ink-3">Which course this exam belongs to and what it&rsquo;s called.</p>
            </div>
            <div className="space-y-4">
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
                maxLength={255}
                required
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Select
                  label="Term"
                  options={["Fall", "Winter", "Spring", "Summer"].map((v) => ({ value: v, label: v }))}
                  value={form.term}
                  onChange={(e) => setForm({ ...form, term: e.target.value })}
                />
                <Input
                  label="Academic year"
                  type="number"
                  min={2020}
                  max={2100}
                  className="tnum"
                  value={form.academic_year}
                  onChange={(e) => setForm({ ...form, academic_year: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-x-8 gap-y-4 border-t border-line px-5 py-6 sm:px-7 lg:grid-cols-[220px_minmax(0,1fr)]">
            <div>
              <h2 className="text-sm font-semibold text-ink">Schedule</h2>
              <p className="mt-0.5 text-xs text-ink-3">Date, start time and length of the sitting.</p>
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
                max={600}
                className="tnum"
                value={form.duration_minutes}
                onChange={(e) => setForm({ ...form, duration_minutes: parseInt(e.target.value) || 0 })}
                hint={ends ? `Ends at ${formatTime(ends)}` : undefined}
              />
            </div>
          </section>

          <section className="grid grid-cols-1 gap-x-8 gap-y-4 border-t border-line px-5 py-6 sm:px-7 lg:grid-cols-[220px_minmax(0,1fr)]">
            <div>
              <h2 className="text-sm font-semibold text-ink">Notes</h2>
              <p className="mt-0.5 text-xs text-ink-3">Optional. Shown to staff on the exam&rsquo;s overview.</p>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="exam-notes" className="block text-sm font-medium text-ink">Notes for invigilators</label>
              <textarea
                id="exam-notes"
                rows={4}
                maxLength={5000}
                placeholder="e.g. Non-programmable calculators allowed. Open book."
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink shadow-[var(--shadow-sm)] placeholder:text-ink-3 hover:border-ink-3/50 focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15"
              />
            </div>
          </section>

          {error && (
            <div className="px-5 pb-5 sm:px-7">
              <div role="alert" className="flex items-start gap-2 rounded-lg border border-danger/25 bg-danger/10 px-3 py-2 text-sm text-danger">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 rounded-b-[inherit] border-t border-line bg-surface-2 px-5 py-3.5 sm:px-7">
            <Link href="/app/exams">
              <Button variant="secondary" type="button">Cancel</Button>
            </Link>
            <Button type="submit" loading={loading}>Create exam</Button>
          </div>
        </form>

        <aside className="space-y-4 xl:sticky xl:top-6">
          <div className="hero-panel animate-rise px-5 py-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">Preview</p>
            <p className="mt-3 text-xs font-medium text-white/70">
              {course ? course.course_code : "Course"} · {form.term} {form.academic_year || ""}
            </p>
            <p className="mt-1 truncate text-xl font-semibold tracking-tight">
              {form.exam_name || "Exam name"}
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <span className="hero-chip inline-flex items-center gap-1.5 rounded-full px-2.5 py-1">
                <Calendar className="h-3.5 w-3.5 text-white/60" />
                {form.exam_date ? formatDateLong(form.exam_date) : "Date"}
              </span>
              <span className="hero-chip inline-flex items-center gap-1.5 rounded-full px-2.5 py-1">
                <Clock className="h-3.5 w-3.5 text-white/60" />
                {form.start_time ? `${formatTime(form.start_time)}${ends ? ` – ${formatTime(ends)}` : ""}` : "Time"}
              </span>
              <span className="hero-chip inline-flex items-center gap-1.5 rounded-full px-2.5 py-1">
                <Timer className="h-3.5 w-3.5 text-white/60" />
                {form.duration_minutes || 0} min
              </span>
            </div>
          </div>

          <div className="surface-card px-5 py-5">
            <h2 className="text-sm font-semibold text-ink">What happens next</h2>
            <p className="mt-0.5 text-xs text-ink-3">After you create the exam, the workspace guides you through four steps.</p>
            <ol className="mt-4 space-y-3">
              {NEXT_STEPS.map((s, i) => (
                <li key={s.title} className="flex gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent-subtle text-accent">
                    <s.icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-ink">
                      <span className="tnum text-ink-3">{i + 1}.</span> {s.title}
                    </span>
                    <span className="block text-xs text-ink-3">{s.text}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </div>
    </PageContainer>
  );
}
