"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FileUp } from "lucide-react";
import { importCourseAccess, type CourseAccessImport } from "@/lib/api/courses";
import { ApiError, errorReference } from "@/lib/api/client";
import { Button } from "@/components/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { plural } from "@/lib/format";

/** Add instructors and TAs to many courses from a CSV: preview first, then confirm. */
export function CourseAccessImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        {/* Remounted each time it opens, so a previous file and preview are gone. */}
        {open && <ImportForm onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function ImportForm({ onClose }: { onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<CourseAccessImport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const check = async (f: File) => {
    setFile(f);
    setPreview(null);
    setError(null);
    setBusy(true);
    try {
      setPreview(await importCourseAccess(f, false));
    } catch (err) {
      setError(err instanceof ApiError && err.status === 400 ? err.message : `The file couldn't be read.${errorReference(err)}`);
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const done = await importCourseAccess(file, true);
      toast.success(`Added ${plural(done.added, "person", "people")} to their courses`);
      onClose();
    } catch (err) {
      setError(`Nothing was added. Try again.${errorReference(err)}`);
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle>Add people to courses</DialogTitle>
        <DialogDescription>
          A CSV with a <span className="font-mono">course_code</span> column and an <span className="font-mono">email</span>{" "}
          column, one row per person per course. Use the address each person signs in with. You&apos;ll see what
          changes before anything is saved.
        </DialogDescription>
      </DialogHeader>

      <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-line-strong px-4 py-3 text-sm text-ink-2 hover:bg-surface-hover">
        <FileUp className="h-4 w-4 shrink-0 text-ink-3" />
        <span className="min-w-0 flex-1 truncate">{file ? file.name : "Choose a CSV file"}</span>
        <input
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={(e) => e.target.files?.[0] && check(e.target.files[0])}
        />
      </label>

      {error && <p role="alert" className="rounded-lg border border-danger/20 bg-danger/5 p-3 text-sm text-danger">{error}</p>}

      {preview && (
        <div className="space-y-2 text-sm">
          <p className="text-ink">
            <span className="font-semibold">{plural(preview.added, "person", "people")}</span> to add
            {preview.already > 0 && <span className="text-ink-3"> · {preview.already} already have access</span>}
          </p>
          {preview.rows.length > 0 && (
            <ul className="max-h-32 overflow-y-auto rounded-lg border border-line text-xs">
              {preview.rows.map((r) => (
                <li key={`${r.course_code}-${r.email}`} className="flex justify-between gap-3 border-b border-line px-3 py-1.5 last:border-0">
                  <span className="font-mono text-ink">{r.course_code}</span>
                  <span className="truncate text-ink-2">{r.email}</span>
                </li>
              ))}
              {preview.added > preview.rows.length && (
                <li className="px-3 py-1.5 text-ink-3">and {preview.added - preview.rows.length} more</li>
              )}
            </ul>
          )}
          {preview.errors.length > 0 && (
            <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs text-ink-2">
              <p className="font-medium text-warning">{plural(preview.errors.length, "row")} will be skipped</p>
              <ul className="mt-1 max-h-24 list-disc overflow-y-auto pl-4">
                {preview.errors.slice(0, 20).map((e) => <li key={e}>{e}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={confirm} disabled={!preview || preview.added === 0} loading={busy}>
          {preview && preview.added > 0 ? `Add ${plural(preview.added, "person", "people")}` : "Add people"}
        </Button>
      </DialogFooter>
    </div>
  );
}
