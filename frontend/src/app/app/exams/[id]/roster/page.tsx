"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { getExam } from "@/lib/api/exams";
import {
  getRoster,
  previewRosterImport,
  confirmRosterImport,
  removeFromRoster,
} from "@/lib/api/roster";
import { Exam, ExamStudent } from "@/lib/types";
import { useAuth } from "@/lib/auth/context";
import { Card, CardContent, CardHeader } from "@/components/card";
import { Button } from "@/components/button";
import { Table, TableHead, TableBody, Th, Td } from "@/components/table";
import { PageLoader } from "@/components/spinner";
import { EmptyState } from "@/components/empty-state";
import { formatNumber, plural } from "@/lib/format";
import {
  Users, Upload, AlertCircle, CheckCircle, XCircle, UserMinus,
  ChevronLeft, ChevronRight, FileSpreadsheet,
} from "lucide-react";

import { notifyExamChanged } from "@/components/exam/workspace";
import { AccommodationDialog } from "@/components/exam/AccommodationDialog";
import { errorMessage, errorReference } from "@/lib/api/client";
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
  const [editing, setEditing] = useState<ExamStudent | null>(null);

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
        if (!cancelled) setError(errorMessage(err, "The students could not be loaded. Try again in a moment."));
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
      setError(errorMessage(err, "The file couldn't be read. Check it is a CSV and try again."));
    }
  };

  const handleConfirmImport = async () => {
    if (!importFile) return;
    setImporting(true);
    setError(null);
    try {
      const result = await confirmRosterImport(examId, importFile);
      notifyExamChanged();
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
      setError(`The import didn't finish. Check the file and try again.${errorReference(err)}`);
    } finally {
      setImporting(false);
    }
  };

  const handleRemove = async (studentId: string) => {
    if (!confirm("Remove this student from the roster?")) return;
    try {
      await removeFromRoster(examId, studentId);
      notifyExamChanged();
      // Removing the only student on the last page moves back a page.
      if (students.length === 1 && page > 1) {
        setPage(page - 1);
      } else {
        fetchRoster();
      }
    } catch (err) {
      setError(`The student couldn't be removed. Try again.${errorReference(err)}`);
    }
  };

  const pageCount = Math.max(1, Math.ceil(total / 50));
  const firstRow = total === 0 ? 0 : (page - 1) * 50 + 1;
  const lastRow = (page - 1) * 50 + students.length;
  const resetImport = () => {
    setPreview(null);
    setImportFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-ink">Students</h2>
          <p className="text-sm text-ink-2">
            {loading ? "Loading students…" : `${plural(total, "student")} registered${exam ? ` for ${exam.course_code}` : ""}`}
          </p>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              onChange={(e) => {
                setImportFile(e.target.files?.[0] || null);
                setPreview(null);
                setImportResult(null);
              }}
            />
            {(loading || students.length > 0) && (
              <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4" /> Import CSV
              </Button>
            )}
          </div>
        )}
      </div>

      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {importResult && (
        <div role="status" className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
          <CheckCircle className="h-4 w-4 shrink-0" />
          Imported {plural(importResult.imported, "student")}, skipped {formatNumber(importResult.skipped)}.
        </div>
      )}

      {/* CSV import */}
      {canEdit && importFile && (
        <Card>
          <CardHeader className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-ink">Import roster</h3>
              <p className="truncate text-xs text-ink-3">
                <FileSpreadsheet className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />
                {importFile.name}
              </p>
            </div>
            {!preview && (
              <div className="flex shrink-0 gap-2">
                <Button variant="secondary" size="sm" onClick={resetImport}>Cancel</Button>
                <Button size="sm" onClick={handlePreview}>Preview import</Button>
              </div>
            )}
          </CardHeader>

          {!preview && (
            <CardContent className="text-sm text-ink-2">
              Expected columns: <code className="rounded bg-surface-hover px-1.5 py-0.5 font-mono text-xs text-ink">student_number,first_name,last_name</code>{" "}
              or <code className="rounded bg-surface-hover px-1.5 py-0.5 font-mono text-xs text-ink">student_number,name</code>.
              Optional: <code className="rounded bg-surface-hover px-1.5 py-0.5 font-mono text-xs text-ink">utorid</code>,{" "}
              <code className="rounded bg-surface-hover px-1.5 py-0.5 font-mono text-xs text-ink">email</code>
            </CardContent>
          )}

          {preview && (
            <>
              <div className="grid grid-cols-2 divide-line border-b border-line sm:grid-cols-4 sm:divide-x">
                {[
                  { label: "Rows in file", value: preview.total_rows },
                  { label: "New students", value: preview.new_students, tone: "text-success" },
                  { label: "Already on roster", value: preview.already_in_roster },
                  { label: "Duplicates in file", value: preview.duplicate_in_file, tone: preview.duplicate_in_file > 0 ? "text-warning" : undefined },
                ].map((m) => (
                  <div key={m.label} className="px-5 py-3">
                    <p className="text-xs text-ink-3">{m.label}</p>
                    <p className={`tnum mt-0.5 text-xl font-semibold ${m.tone ?? "text-ink"}`}>{formatNumber(m.value)}</p>
                  </div>
                ))}
              </div>

              {preview.errors.length > 0 && (
                <div className="mx-5 mt-4 flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2.5 text-sm text-danger">
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <ul className="space-y-0.5">
                    {preview.errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              )}

              {preview.preview.length > 0 && (
                <div className="mx-5 mt-4 overflow-hidden rounded-lg border border-line">
                  <p className="border-b border-line bg-surface-2 px-4 py-2 text-xs font-medium text-ink-2">
                    Preview · first {plural(preview.preview.length, "row")}
                  </p>
                  <Table>
                    <TableHead>
                      <Th>Student #</Th>
                      <Th>Name</Th>
                    </TableHead>
                    <TableBody>
                      {preview.preview.map((s) => (
                        <tr key={s.student_number}>
                          <Td className="font-mono text-xs">{s.student_number}</Td>
                          <Td>{s.full_name}</Td>
                        </tr>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              <div className="mt-4 flex justify-end gap-2 border-t border-line px-5 py-3">
                <Button variant="secondary" onClick={resetImport}>Cancel</Button>
                <Button
                  onClick={handleConfirmImport}
                  disabled={importing || preview.new_students === 0}
                  loading={importing}
                >
                  Import {plural(preview.new_students, "student")}
                </Button>
              </div>
            </>
          )}
        </Card>
      )}

      {/* Roster table */}
      {loading ? (
        <PageLoader />
      ) : total === 0 ? (
        <Card>
          <EmptyState
            icon={<Users className="h-5 w-5 text-ink-3" />}
            title="No students on this roster"
            description="Import a CSV file to add students to this exam."
            action={
              canEdit ? (
                <Button onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-4 w-4" /> Import CSV
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="surface-card overflow-hidden">
          <Table>
            <TableHead>
              <Th className="w-40">Student #</Th>
              <Th>Name</Th>
              <Th className="hidden md:table-cell">UTORid</Th>
              <Th className="hidden lg:table-cell">Email</Th>
              <Th>Seat</Th>
              <Th>Accommodations</Th>
              {canEdit && <Th className="text-right">Actions</Th>}
            </TableHead>
            <TableBody>
              {students.map((s) => (
                <tr key={s.id}>
                  <Td className="font-mono text-xs text-ink-2">{s.student_number}</Td>
                  <Td className="font-medium">{s.full_name}</Td>
                  <Td className="hidden font-mono text-xs text-ink-2 md:table-cell">{s.utorid || <span className="text-ink-3">—</span>}</Td>
                  <Td className="hidden text-ink-2 lg:table-cell">{s.email || <span className="text-ink-3">—</span>}</Td>
                  <Td className="whitespace-nowrap">
                    {s.seat_code ? (
                      <span className="text-xs text-ink-2">
                        {s.room} <span className="font-mono font-medium text-ink">{s.seat_code}</span>
                      </span>
                    ) : (
                      <span className="text-xs text-ink-3">Not seated</span>
                    )}
                  </Td>
                  <Td>
                    {(s.extra_time_minutes ?? 0) > 0 || s.accommodation_notes ? (
                      <span className="inline-flex items-center gap-1.5">
                        {(s.extra_time_minutes ?? 0) > 0 && (
                          <span className="tnum rounded-full bg-violet-subtle px-2 py-0.5 text-[11px] font-medium text-violet">+{s.extra_time_minutes} min</span>
                        )}
                        {s.accommodation_notes && (
                          <span className="max-w-48 truncate text-xs text-ink-2" title={s.accommodation_notes}>{s.accommodation_notes}</span>
                        )}
                      </span>
                    ) : (
                      <span className="text-xs text-ink-3">None</span>
                    )}
                  </Td>
                  {canEdit && (
                    <Td className="py-1.5">
                      <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setEditing(s)} aria-label={`Edit accommodations for ${s.full_name}`}>
                        Accommodations
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-ink-3 hover:text-danger"
                        onClick={() => handleRemove(s.student_id)}
                        aria-label={`Remove ${s.full_name}`}
                      >
                        <UserMinus className="h-3.5 w-3.5" /> Remove
                      </Button>
                      </div>
                    </Td>
                  )}
                </tr>
              ))}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between border-t border-line bg-surface-2 px-4 py-2.5 text-xs text-ink-3">
            <span className="tnum">
              Showing {formatNumber(firstRow)}–{formatNumber(lastRow)} of {formatNumber(total)}
            </span>
            {pageCount > 1 && (
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}>
                  <ChevronLeft className="h-3.5 w-3.5" /> Previous
                </Button>
                <span className="tnum px-2">Page {page} of {pageCount}</span>
                <Button variant="ghost" size="sm" onClick={() => setPage(page + 1)} disabled={students.length < 50}>
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      <AccommodationDialog
        examId={examId}
        student={editing}
        onClose={() => setEditing(null)}
        onSaved={(u) => setStudents((list) => list.map((x) => (x.student_id === u.student_id ? { ...x, ...u } : x)))}
      />
    </div>
  );
}
