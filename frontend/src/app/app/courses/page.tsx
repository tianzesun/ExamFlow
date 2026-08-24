"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getCourses } from "@/lib/api/courses";
import { Course } from "@/lib/types";

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCourses()
      .then((res) => {
        setCourses(res.courses);
        setTotal(res.total);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-zinc-600 dark:text-zinc-400">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-black dark:text-white">Courses</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-500">{total} courses</p>
        </div>
        <Link
          href="/app/courses/new"
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          Create Course
        </Link>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {courses.length === 0 ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-zinc-500 dark:text-zinc-500">No courses yet.</p>
          <Link href="/app/courses/new" className="mt-2 text-sm text-black hover:underline dark:text-white">
            Create your first course
          </Link>
        </div>
      ) : (
        <div className="rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800">
                <th className="px-4 py-3 text-left text-sm font-medium text-zinc-500 dark:text-zinc-500">Code</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-zinc-500 dark:text-zinc-500">Name</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-zinc-500 dark:text-zinc-500">Department</th>
              </tr>
            </thead>
            <tbody>
              {courses.map((course) => (
                <tr key={course.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/50">
                  <td className="px-4 py-3 text-sm font-medium text-black dark:text-white">{course.course_code}</td>
                  <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">{course.course_name}</td>
                  <td className="px-4 py-3 text-sm text-zinc-500 dark:text-zinc-500">{course.department || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
