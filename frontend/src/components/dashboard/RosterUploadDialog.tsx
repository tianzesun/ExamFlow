"use client";

import { useState } from "react";
import { Upload, X, CheckCircle2 } from "lucide-react";
import { confirmRosterImport } from "@/lib/api/roster";
import { Button } from "@/components";

interface ExamOption {
  id: string;
  exam_name: string;
}

interface RosterUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exams: ExamOption[];
  courseId: string | null;
  onImported?: () => void;
}

export function RosterUploadDialog({
  open,
  onOpenChange,
  exams,
  courseId,
  onImported,
}: RosterUploadDialogProps) {
  const [examId, setExamId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(
    null
  );

  if (!open) return null;

  const canSubmit = !!examId && !!file && !uploading;

  const reset = () => {
    setExamId("");
    setFile(null);
    setError(null);
    setResult(null);
    setUploading(false);
  };

  const handleImport = async () => {
    if (!examId || !file) return;
    setUploading(true);
    setError(null);
    setResult(null);
    try {
      const res = await confirmRosterImport(examId, file);
      setResult(res);
      onImported?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-ink/40"
        onClick={() => onOpenChange(false)}
      />
      <div className="relative w-full max-w-md rounded-lg border border-line bg-surface p-5 shadow-lg animate-scale-in">
        <div className="flex items-start justify-between">
          <h2 className="text-sm font-semibold text-ink">Import roster</h2>
          <button
            onClick={() => onOpenChange(false)}
            className="rounded-md p-1 text-ink-3 transition-colors hover:bg-surface-hover hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1 text-xs text-ink-2">
          Rosters are imported per exam. Choose the target exam, then upload a
          CSV with student numbers and names.
        </p>

        {courseId ? (
          result ? (
            <div className="mt-4 flex items-center gap-2 rounded-md bg-success/10 px-3 py-3 text-sm text-success">
              <CheckCircle2 className="h-4 w-4" />
              Imported {result.imported} · skipped {result.skipped}
              <button
                onClick={() => {
                  reset();
                  onOpenChange(false);
                }}
                className="ml-auto font-medium text-ink-2 hover:text-ink"
              >
                Done
              </button>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <div className="space-y-1">
                <label className="block text-sm font-medium text-ink-2">
                  Target exam
                </label>
                <select
                  value={examId}
                  onChange={(e) => setExamId(e.target.value)}
                  className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30"
                >
                  <option value="">Select an exam…</option>
                  {exams.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.exam_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-ink-2">
                  CSV file
                </label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="w-full text-sm text-ink-2 file:mr-3 file:rounded-md file:border-0 file:bg-surface-hover file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-ink-2"
                />
              </div>
              {error && <p className="text-xs text-danger">{error}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="secondary" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button onClick={handleImport} disabled={!canSubmit} loading={uploading}>
                  <Upload className="h-4 w-4" /> Import
                </Button>
              </div>
            </div>
          )
        ) : (
          <p className="mt-4 text-sm text-ink-2">
            Select a course from the top bar to import a roster.
          </p>
        )}
      </div>
    </div>
  );
}
