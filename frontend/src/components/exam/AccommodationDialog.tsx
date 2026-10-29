"use client";

import { useState } from "react";
import { toast } from "sonner";
import { setAccommodation } from "@/lib/api/roster";
import { errorReference } from "@/lib/api/client";
import type { ExamStudent } from "@/lib/types";
import { Button } from "@/components/button";
import { Input } from "@/components/input";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

/** Edit a student's accommodations (extra time, notes) for one exam. */
export function AccommodationDialog({
  examId,
  student,
  onClose,
  onSaved,
}: {
  examId: string;
  student: ExamStudent | null;
  onClose: () => void;
  onSaved: (s: ExamStudent) => void;
}) {
  return (
    <Dialog open={student !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {/* Keyed so the form resets for each student. */}
        {student && <AccommodationForm key={student.id} examId={examId} student={student} onClose={onClose} onSaved={onSaved} />}
      </DialogContent>
    </Dialog>
  );
}

function AccommodationForm({
  examId, student, onClose, onSaved,
}: { examId: string; student: ExamStudent; onClose: () => void; onSaved: (s: ExamStudent) => void }) {
  const [minutes, setMinutes] = useState(student.extra_time_minutes ?? 0);
  const [notes, setNotes] = useState(student.accommodation_notes ?? "");
  const [saving, setSaving] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await setAccommodation(examId, student.student_id, {
        extra_time_minutes: minutes,
        accommodation_notes: notes.trim() || null,
      });
      onSaved(updated);
      toast.success(`Accommodations saved for ${student.full_name}`);
      onClose();
    } catch (err) {
      toast.error(`Accommodations couldn't be saved. Try again.${errorReference(err)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="space-y-4">
      <DialogHeader>
        <DialogTitle>Accommodations</DialogTitle>
        <DialogDescription>
          {student.full_name} · <span className="font-mono">{student.student_number}</span>. Applies to this exam only.
        </DialogDescription>
      </DialogHeader>
      <Input
        label="Extra writing time (minutes)"
        type="number"
        min={0}
        max={600}
        className="tnum"
        value={minutes}
        onChange={(e) => setMinutes(Math.max(0, parseInt(e.target.value) || 0))}
      />
      <div className="space-y-1.5">
        <label htmlFor="accommodation-notes" className="block text-sm font-medium text-ink">Notes</label>
        <textarea
          id="accommodation-notes"
          rows={3}
          maxLength={2000}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Seat near the front, use of a computer"
          className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15"
        />
        <p className="text-xs text-ink-3">Visible to exam staff only. Don&rsquo;t record medical details here.</p>
      </div>
      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        <Button type="submit" loading={saving}>Save</Button>
      </DialogFooter>
    </form>
  );
}
