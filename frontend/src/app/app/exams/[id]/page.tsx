"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getExam, updateExam } from "@/lib/api/exams";
import { getAssignments, removeAssignment } from "@/lib/api/assignments";
import { uploadPdf, generatePdf, getPdfDownloadUrl, listDocuments, PdfDocument } from "@/lib/api/pdf";
import { Exam } from "@/lib/types";
import { Assignment } from "@/lib/api/assignments";
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const examId = params.id as string;

  const [exam, setExam] = useState<Exam | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [documents, setDocuments] = useState<PdfDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const canEdit = user?.role === "ADMIN" || user?.role === "STAFF";

  const fetchData = () => {
    Promise.all([
      getExam(examId),
      getAssignments(examId).catch(() => []),
      listDocuments(examId).catch(() => []),
    ]).then(([e, a, d]) => {
      setExam(e);
      setAssignments(a);
      setDocuments(d);
    }).catch((err) => setError(err.message)).finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [examId]);

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

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      await uploadPdf(examId, file);
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      await generatePdf(examId);
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    if (!confirm("Remove this seat assignment?")) return;
    try {
      await removeAssignment(examId, assignmentId);
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Remove failed");
    }
  };

  if (loading) return <div className="text-zinc-600 dark:text-zinc-400">Loading...</div>;
  if (error) return <div className="rounded-md bg-red-50 p-4 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-400">{error}</div>;
  if (!exam) return <div className="text-zinc-600 dark:text-zinc-400">Exam not found.</div>;

  const transitions = VALID_TRANSITIONS[exam.status] || [];
  const hasOriginal = documents.some(d => d.document_type === "ORIGINAL_TEMPLATE");
  const hasGenerated = documents.some(d => d.document_type === "PERSONALIZED_EXAM");

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
        <Link href={`/app/exams/${exam.id}/roster`} className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200">
          Manage Roster
        </Link>
        <Link href={`/app/exams/${exam.id}/seating`} className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300">
          Seating
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-lg font-medium text-black dark:text-white">Exam Details</h2>
          <dl className="mt-4 space-y-3">
            <div><dt className="text-sm text-zinc-500">Course</dt><dd className="text-sm font-medium text-black dark:text-white">{exam.course_code} — {exam.course_name}</dd></div>
            <div><dt className="text-sm text-zinc-500">Date</dt><dd className="text-sm font-medium text-black dark:text-white">{exam.exam_date}</dd></div>
            <div><dt className="text-sm text-zinc-500">Time</dt><dd className="text-sm font-medium text-black dark:text-white">{exam.start_time}</dd></div>
            <div><dt className="text-sm text-zinc-500">Duration</dt><dd className="text-sm font-medium text-black dark:text-white">{exam.duration_minutes} min</dd></div>
          </dl>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-lg font-medium text-black dark:text-white">Status</h2>
          <dl className="mt-4 space-y-3">
            <div><dt className="text-sm text-zinc-500">Created</dt><dd className="text-sm font-medium text-black dark:text-white">{new Date(exam.created_at).toLocaleDateString()}</dd></div>
            <div><dt className="text-sm text-zinc-500">Updated</dt><dd className="text-sm font-medium text-black dark:text-white">{new Date(exam.updated_at).toLocaleDateString()}</dd></div>
          </dl>
          {canEdit && transitions.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Change Status</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {transitions.map((s) => (
                  <button key={s} onClick={() => handleStatusChange(s)} disabled={updating}
                    className="rounded border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* PDF Section */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-lg font-medium text-black dark:text-white">Exam PDF</h2>
        {canEdit && (
          <div className="mt-4 flex items-center gap-3">
            <input ref={fileInputRef} type="file" accept=".pdf" onChange={handleUpload} className="text-sm" />
            {uploading && <span className="text-sm text-zinc-500">Uploading...</span>}
          </div>
        )}
        {hasOriginal && (
          <div className="mt-4 flex items-center gap-3">
            <button onClick={handleGenerate} disabled={generating}
              className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black">
              {generating ? "Generating..." : "Generate Personalized PDF"}
            </button>
            {hasGenerated && (
              <a href={getPdfDownloadUrl(examId)} target="_blank" rel="noopener noreferrer"
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300">
                Download PDF
              </a>
            )}
          </div>
        )}
        {documents.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Documents</h3>
            <ul className="mt-2 space-y-1">
              {documents.map((d) => (
                <li key={d.id} className="text-sm text-zinc-600 dark:text-zinc-400">
                  {d.filename} (v{d.version}) — {(d.file_size / 1024).toFixed(0)} KB
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Assignments Section */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-lg font-medium text-black dark:text-white">Seat Assignments ({assignments.length})</h2>
        {assignments.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">No assignments yet. Go to Seating to assign students.</p>
        ) : (
          <table className="mt-4 w-full">
            <thead>
              <tr className="border-b dark:border-zinc-700">
                <th className="py-2 text-left text-sm font-medium text-zinc-500">Student #</th>
                <th className="py-2 text-left text-sm font-medium text-zinc-500">Name</th>
                <th className="py-2 text-left text-sm font-medium text-zinc-500">Seat</th>
                <th className="py-2 text-left text-sm font-medium text-zinc-500">Method</th>
                {canEdit && <th className="py-2 text-right text-sm font-medium text-zinc-500"></th>}
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => (
                <tr key={a.id} className="border-b dark:border-zinc-800/50">
                  <td className="py-2 text-sm">{a.student_number}</td>
                  <td className="py-2 text-sm">{a.full_name}</td>
                  <td className="py-2 text-sm font-medium">{a.seat_code}</td>
                  <td className="py-2 text-xs text-zinc-500">{a.method}</td>
                  {canEdit && (
                    <td className="py-2 text-right">
                      <button onClick={() => handleRemoveAssignment(a.id)} className="text-xs text-red-600 hover:text-red-800 dark:text-red-400">Remove</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
