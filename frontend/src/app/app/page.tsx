"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth/context";
import { getExams } from "@/lib/api/exams";

const STATUS_GROUPS = [
  { label: "Draft", status: "DRAFT", color: "text-zinc-600 dark:text-zinc-400" },
  { label: "Ready", status: "READY", color: "text-green-600 dark:text-green-400" },
  { label: "Generated", status: "GENERATED", color: "text-purple-600 dark:text-purple-400" },
  { label: "Completed", status: "COMPLETED", color: "text-yellow-600 dark:text-yellow-400" },
  { label: "Archived", status: "ARCHIVED", color: "text-zinc-500 dark:text-zinc-500" },
];

export default function AppPage() {
  const { user } = useAuth();
  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getExams({}, 1, 100)
      .then((data) => setExams(data.exams))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (!user) return null;

  const counts = STATUS_GROUPS.map(g => ({
    ...g,
    count: exams.filter(e => e.status === g.status).length,
  }));

  const upcomingExams = exams
    .filter(e => new Date(e.exam_date) >= new Date() && e.status !== "ARCHIVED")
    .sort((a, b) => new Date(a.exam_date).getTime() - new Date(b.exam_date).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-black dark:text-white">Dashboard</h1>
        <span className="text-xs text-zinc-400">ExamFlow v1.0.0-pilot</span>
      </div>

      {/* User Info */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-lg font-medium text-black dark:text-white">Welcome, {user.display_name}</h2>
        <p className="mt-1 text-sm text-zinc-500">{user.role} · {user.email || "No email"}</p>
      </div>

      {/* Exam Stats */}
      <div className="grid grid-cols-5 gap-4">
        {counts.map(g => (
          <div key={g.status} className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <p className={`text-2xl font-bold ${g.color}`}>{g.count}</p>
            <p className="text-sm text-zinc-500">{g.label}</p>
          </div>
        ))}
      </div>

      {/* Upcoming Exams */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-black dark:text-white">Upcoming Exams</h2>
          <Link href="/app/exams" className="text-sm text-zinc-500 hover:text-black dark:text-zinc-500 dark:hover:text-white">
            View all →
          </Link>
        </div>
        {loading ? (
          <p className="mt-3 text-sm text-zinc-500">Loading...</p>
        ) : upcomingExams.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">No upcoming exams.</p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-b dark:border-zinc-700">
                <th className="py-2 text-left text-xs font-medium text-zinc-500">Course</th>
                <th className="py-2 text-left text-xs font-medium text-zinc-500">Exam</th>
                <th className="py-2 text-left text-xs font-medium text-zinc-500">Date</th>
                <th className="py-2 text-left text-xs font-medium text-zinc-500">Status</th>
              </tr>
            </thead>
            <tbody>
              {upcomingExams.map((exam) => (
                <tr key={exam.id} className="border-b dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-900">
                  <td className="py-2">
                    <Link href={`/app/exams/${exam.id}`} className="font-medium text-black dark:text-white hover:underline">
                      {exam.course_code}
                    </Link>
                  </td>
                  <td className="py-2 text-zinc-600 dark:text-zinc-400">{exam.exam_name}</td>
                  <td className="py-2 text-zinc-600 dark:text-zinc-400">{exam.exam_date}</td>
                  <td className="py-2">
                    <span className="inline-block rounded px-1.5 py-0.5 text-xs font-medium bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                      {exam.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Quick Actions */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-lg font-medium text-black dark:text-white">Quick Actions</h2>
        <div className="mt-3 flex gap-3">
          <Link href="/app/exams/new" className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-black">
            Create Exam
          </Link>
          <Link href="/app/rooms" className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300">
            Manage Rooms
          </Link>
          <Link href="/app/courses" className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300">
            Manage Courses
          </Link>
        </div>
      </div>
    </div>
  );
}
