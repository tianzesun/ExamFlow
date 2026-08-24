"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getExam } from "@/lib/api/exams";
import {
  getRoster,
  previewRosterImport,
  confirmRosterImport,
  removeFromRoster,
} from "@/lib/api/roster";
import { Exam, ExamStudent } from "@/lib/types";
import { useAuth } from "@/lib/auth/context";

export default function RosterPage() {
  const params = useParams();
  const { user } = useAuth();
  const examId = params.id as string;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [exam, setExam] = useState<Exam | null>(null);
  const [students, setStudents] = useState<ExamStudent[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Import state
  const [importFile, setImportFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<null | {
    total_rows: number;
    valid_rows: number;
    duplicate_in_file: number;
    already_in_roster: number;
    new_students: number;
    errors: string[];
    preview: { student_number: string; full_name: string }[];
  }>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<null | { imported: number; skipped: number }>(null);

  const canEdit = user?.role === "ADMIN" || user?.role === "STAFF";

  const fetchRoster = useCallback(() => {
    let cancelled = false;
    getRoster(examId, page)
      .then((res) => {
        if (!cancelled) {
          setStudents(res.students);
          setTotal(res.total);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [examId, page]);

  useEffect(() => {
    getExam(examId).then(setExam).catch(() => {});
    const cancel = fetchRoster();
    return cancel;
  }, [examId, page, fetchRoster]);

  const handlePreview = async () => {
    if (!importFile) return;
    setError(null);
    try {
      const result = await previewRosterImport(examId, importFile);
      setPreview(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed");
    }
  };

  const handleConfirmImport = async () => {
    if (!importFile) return;
    setImporting(true);
    setError(null);
    try {
      const result = await confirmRosterImport(examId, importFile);
      setImportResult(result);
      setPreview(null);
      setImportFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setPage(1);
      getRoster(examId, 1)
        .then((res) => { setStudents(res.students); setTotal(res.total); })
        .catch(() => {})
        .finally(() => setLoading(false));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const handleRemove = async (studentId: string) => {
    if (!confirm("Remove this student from the roster?")) return;
    try {
      await removeFromRoster(examId, studentId);
      getRoster(examId, page)
        .then((res) => { setStudents(res.students); setTotal(res.total); })
        .catch(() => {})
        .finally(() => setLoading(false));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Remove failed");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/app/exams/${examId}`} className="text-sm text-zinc-500 hover:text-black dark:text-zinc-500 dark:hover:text-white">
          ← Back to Exam
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-black dark:text-white">Roster</h1>
        {exam && (
          <p className="text-sm text-zinc-500 dark:text-zinc-500">
            {exam.course_code} — {exam.exam_name} ({total} students)
          </p>
        )}
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {importResult && (
        <div className="rounded-md bg-green-50 p-4 text-sm text-green-800 dark:bg-green-900/20 dark:text-green-400">
          Imported {importResult.imported} students, skipped {importResult.skipped}.
        </div>
      )}

      {/* CSV Import */}
      {canEdit && (
        <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-lg font-medium text-black dark:text-white">Import Roster (CSV)</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-500">
            Format: student_number,first_name,last_name (or student_number,name)
          </p>
          <div className="mt-4 flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={(e) => {
                setImportFile(e.target.files?.[0] || null);
                setPreview(null);
                setImportResult(null);
              }}
              className="text-sm text-zinc-600 dark:text-zinc-400"
            />
            {importFile && !preview && (
              <button
                onClick={handlePreview}
                className="rounded-md bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
              >
                Preview
              </button>
            )}
          </div>

          {preview && (
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>Total rows: {preview.total_rows}</div>
                <div>New students: {preview.new_students}</div>
                <div>Already in roster: {preview.already_in_roster}</div>
                <div>Duplicates in file: {preview.duplicate_in_file}</div>
              </div>

              {preview.errors.length > 0 && (
                <div className="rounded bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
                  {preview.errors.map((e, i) => <div key={i}>{e}</div>)}
                </div>
              )}

              {preview.preview.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Preview (first 10):</p>
                  <table className="mt-2 w-full text-sm">
                    <thead>
                      <tr className="border-b dark:border-zinc-700">
                        <th className="py-1 text-left">Student #</th>
                        <th className="py-1 text-left">Name</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.preview.map((s) => (
                        <tr key={s.student_number} className="border-b dark:border-zinc-800">
                          <td className="py-1">{s.student_number}</td>
                          <td className="py-1">{s.full_name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleConfirmImport}
                  disabled={importing || preview.new_students === 0}
                  className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black"
                >
                  {importing ? "Importing..." : `Import ${preview.new_students} Students`}
                </button>
                <button
                  onClick={() => { setPreview(null); setImportFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                  className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Roster Table */}
      {loading ? (
        <div className="text-zinc-600 dark:text-zinc-400">Loading...</div>
      ) : students.length === 0 ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-zinc-500 dark:text-zinc-500">No students in roster.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800">
                <th className="px-4 py-3 text-left text-sm font-medium text-zinc-500">Student #</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-zinc-500">Name</th>
                {canEdit && <th className="px-4 py-3 text-right text-sm font-medium text-zinc-500">Action</th>}
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/50">
                  <td className="px-4 py-3 text-sm font-medium text-black dark:text-white">{s.student_number}</td>
                  <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">{s.full_name}</td>
                  {canEdit && (
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleRemove(s.student_id)}
                        className="text-xs text-red-600 hover:text-red-800 dark:text-red-400"
                      >
                        Remove
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          {Math.ceil(total / 50) > 1 && (
            <div className="flex items-center justify-center gap-2 border-t border-zinc-200 py-3 dark:border-zinc-800">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="rounded border border-zinc-300 px-3 py-1 text-sm disabled:opacity-50 dark:border-zinc-700"
              >
                Previous
              </button>
              <span className="text-sm text-zinc-600 dark:text-zinc-400">Page {page}</span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={students.length < 50}
                className="rounded border border-zinc-300 px-3 py-1 text-sm disabled:opacity-50 dark:border-zinc-700"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
