"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createCourse } from "@/lib/api/courses";
import { Card, CardContent, Input, Button } from "@/components";

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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create course");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-black dark:text-white">Create Course</h1>
        <p className="text-sm text-zinc-500">Add a new course to the system</p>
      </div>

      <Card>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Course Code"
              placeholder="e.g. CSC108"
              value={form.course_code}
              onChange={(e) => setForm({ ...form, course_code: e.target.value })}
              required
            />
            <Input
              label="Course Name"
              placeholder="e.g. Introduction to Computer Science"
              value={form.course_name}
              onChange={(e) => setForm({ ...form, course_name: e.target.value })}
              required
            />
            <Input
              label="Department"
              placeholder="e.g. Computer Science"
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
            />

            {error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button type="submit" loading={loading}>Create Course</Button>
              <Link href="/app/courses">
                <Button variant="secondary" type="button">Cancel</Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
