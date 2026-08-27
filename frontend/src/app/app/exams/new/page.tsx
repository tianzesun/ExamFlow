"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createExam } from "@/lib/api/exams";
import { getCourses } from "@/lib/api/courses";
import type { Course } from "@/lib/types";
import { Card, CardContent, Input, Select, Button } from "@/components";

export default function NewExamPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [form, setForm] = useState({
    course_id: "",
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create exam");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-black dark:text-white">Create Exam</h1>
        <p className="text-sm text-zinc-500">Set up a new examination</p>
      </div>

      <Card>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Select
              label="Course"
              options={courses.map((c) => ({ value: c.id, label: `${c.course_code} — ${c.course_name}` }))}
              placeholder="Select a course"
              value={form.course_id}
              onChange={(e) => setForm({ ...form, course_id: e.target.value })}
              required
            />
            <Input
              label="Exam Name"
              placeholder="e.g. Final Examination"
              value={form.exam_name}
              onChange={(e) => setForm({ ...form, exam_name: e.target.value })}
              required
            />
            <div className="grid grid-cols-2 gap-4">
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
                label="Academic Year"
                type="number"
                value={form.academic_year}
                onChange={(e) => setForm({ ...form, academic_year: parseInt(e.target.value) })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Exam Date"
                type="date"
                value={form.exam_date}
                onChange={(e) => setForm({ ...form, exam_date: e.target.value })}
                required
              />
              <Input
                label="Start Time"
                type="time"
                value={form.start_time}
                onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                required
              />
            </div>
            <Input
              label="Duration (minutes)"
              type="number"
              value={form.duration_minutes}
              onChange={(e) => setForm({ ...form, duration_minutes: parseInt(e.target.value) })}
            />

            {error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button type="submit" loading={loading}>Create Exam</Button>
              <Link href="/app/exams">
                <Button variant="secondary" type="button">Cancel</Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
