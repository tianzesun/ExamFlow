"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getExam, updateExam } from "@/lib/api/exams";
import { Exam } from "@/lib/types";
import { useAuth } from "@/lib/auth/context";

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  CONFIGURED: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  READY: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  GENERATED: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  COMPLETED: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  ARCHIVED: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500",
};

const VALID_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["CONFIGURED", "ARCHIVED"],
  CONFIGURED: ["READY", "DRAFT", "ARCHIVED"],
  READY: ["GENERATED", "CONFIGURED", "ARCHIVED"],
  GENERATED: ["COMPLETED", "READY", "ARCHIVED"],
  COMPLETED: ["ARCHIVED"],
  ARCHIVED: [],
};

export default function ExamDetailPage() {
  const params = useParams();
  const { user } = useAuth();
  const [exam, setExam] = useState<Exam | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  const canEdit = user?.role === "ADMIN" || user?.role === "STAFF";

  useEffect(() => {
    getExam(params.id as string)
      .then(setExam)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [params.id]);

  const handleStatusChange = async (newStatus: string) => {
    if (!exam) return;
    setUpdating(true);
    try {
      const updated = await updateExam(exam.id, { status: newStatus });
      setExam(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return <div className="text-zinc-600 dark:text-zinc-400">Loading...</div>;
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-400">
        {error}
      </div>
    );
  }

  if (!exam) {
    return <div className="text-zinc-600 dark:text-zinc-400">Exam not found.</div>;
  }

  const transitions = VALID_TRANSITIONS[exam.status] || [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-black dark:text-white">{exam.exam_name}</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-500">
            {exam.course_code} — {exam.term} {exam.academic_year}
          </p>
        </div>
        <span className={`inline-block rounded px-2 py-1 text-xs font-medium ${STATUS_COLORS[exam.status] || ""}`}>
          {exam.status}
        </span>
      </div>

      <div className="flex gap-3">
        <Link
          href={`/app/exams/${exam.id}/roster`}
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          Manage Roster
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-lg font-medium text-black dark:text-white">Exam Details</h2>
          <dl className="mt-4 space-y-3">
            <div>
              <dt className="text-sm text-zinc-500 dark:text-zinc-500">Course</dt>
              <dd className="text-sm font-medium text-black dark:text-white">{exam.course_code} — {exam.course_name}</dd>
            </div>
            <div>
              <dt className="text-sm text-zinc-500 dark:text-zinc-500">Date</dt>
              <dd className="text-sm font-medium text-black dark:text-white">{exam.exam_date}</dd>
            </div>
            <div>
              <dt className="text-sm text-zinc-500 dark:text-zinc-500">Time</dt>
              <dd className="text-sm font-medium text-black dark:text-white">{exam.start_time}</dd>
            </div>
            <div>
              <dt className="text-sm text-zinc-500 dark:text-zinc-500">Duration</dt>
              <dd className="text-sm font-medium text-black dark:text-white">{exam.duration_minutes} minutes</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-lg font-medium text-black dark:text-white">Status</h2>
          <dl className="mt-4 space-y-3">
            <div>
              <dt className="text-sm text-zinc-500 dark:text-zinc-500">Created</dt>
              <dd className="text-sm font-medium text-black dark:text-white">
                {new Date(exam.created_at).toLocaleDateString()}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-zinc-500 dark:text-zinc-500">Last Updated</dt>
              <dd className="text-sm font-medium text-black dark:text-white">
                {new Date(exam.updated_at).toLocaleDateString()}
              </dd>
            </div>
          </dl>

          {canEdit && transitions.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Change Status</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {transitions.map((status) => (
                  <button
                    key={status}
                    onClick={() => handleStatusChange(status)}
                    disabled={updating}
                    className="rounded border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
