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
import { Card, CardContent } from "@/components/card";
import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { Table, TableHead, TableBody, Th, Td } from "@/components/table";
import { PageLoader } from "@/components/spinner";
import { EmptyState } from "@/components/empty-state";
import { Users, Upload, AlertCircle, CheckCircle, XCircle, ArrowLeft } from "lucide-react";

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
        <h1 className="text-2xl font-bold text-black dark:text-white flex items-center gap-2">
          <Users className="h-6 w-6 text-zinc-400" />
          Roster
        </h1>
        {exam && (
          <p className="text-sm text-zinc-500 dark:text-zinc-500">
            {exam.course_code} — {exam.exam_name} ({total} students)
          </p>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md bg-red-50 p-4 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-400">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {importResult && (
        <div className="flex items-center gap-2 rounded-md bg-green-50 p-4 text-sm text-green-800 dark:bg-green-900/20 dark:text-green-400">
          <CheckCircle className="h-4 w-4" />
          Imported {importResult.imported} students, skipped {importResult.skipped}.
        </div>
      )}

      {/* CSV Import */}
      {canEdit && (
        <Card>
          <CardContent>
            <h2 className="text-lg font-medium text-black dark:text-white flex items-center gap-2">
              <Upload className="h-5 w-5 text-zinc-400" />
              Import Roster (CSV)
            </h2>
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
                <Button variant="secondary" size="sm" onClick={handlePreview}>
                  Preview
                </Button>
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
                  <div className="flex items-start gap-2 rounded bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      {preview.errors.map((e, i) => <div key={i}>{e}</div>)}
                    </div>
                  </div>
                )}

                {preview.preview.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Preview (first 10):</p>
                    <Table className="mt-2">
                      <TableHead>
                        <Th>Student #</Th>
                        <Th>Name</Th>
                      </TableHead>
                      <TableBody>
                        {preview.preview.map((s) => (
                          <tr key={s.student_number}>
                            <Td>{s.student_number}</Td>
                            <Td>{s.full_name}</Td>
                          </tr>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                <div className="flex gap-3">
                  <Button
                    variant="primary"
                    onClick={handleConfirmImport}
                    disabled={importing || preview.new_students === 0}
                    loading={importing}
                  >
                    Import {preview.new_students} Students
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => { setPreview(null); setImportFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Roster Table */}
      {loading ? (
        <PageLoader />
      ) : students.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Users className="h-6 w-6 text-zinc-400" />}
            title="No students in roster"
            description="Import a CSV file to add students to this exam."
          />
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHead>
              <Th>Student #</Th>
              <Th>Name</Th>
              {canEdit && <Th className="text-right">Action</Th>}
            </TableHead>
            <TableBody>
              {students.map((s) => (
                <tr key={s.id}>
                  <Td className="font-medium text-black dark:text-white">{s.student_number}</Td>
                  <Td>{s.full_name}</Td>
                  {canEdit && (
                    <Td className="text-right">
                      <button
                        onClick={() => handleRemove(s.student_id)}
                        className="text-xs text-red-600 hover:text-red-800 dark:text-red-400"
                      >
                        Remove
                      </button>
                    </Td>
                  )}
                </tr>
              ))}
            </TableBody>
          </Table>

          {Math.ceil(total / 50) > 1 && (
            <div className="flex items-center justify-center gap-2 border-t border-zinc-200 py-3 dark:border-zinc-800">
              <Button variant="ghost" size="sm" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}>
                Previous
              </Button>
              <span className="text-sm text-zinc-600 dark:text-zinc-400">Page {page}</span>
              <Button variant="ghost" size="sm" onClick={() => setPage(page + 1)} disabled={students.length < 50}>
                Next
              </Button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
