"use client";

import { useState } from "react";
import { toast } from "sonner";
import { updateStudentDetails } from "@/lib/api/roster";
import { errorMessage } from "@/lib/api/client";
import type { ExamStudent } from "@/lib/types";
import { Button } from "@/components/button";
import { Input } from "@/components/input";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

/** Correct a student's name or UTORid. The record is shared, so every exam they're in changes. */
export function StudentDetailsDialog({
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
        {student && <DetailsForm key={student.id} examId={examId} student={student} onClose={onClose} onSaved={onSaved} />}
      </DialogContent>
    </Dialog>
  );
}

function DetailsForm({
  examId, student, onClose, onSaved,
}: { examId: string; student: ExamStudent; onClose: () => void; onSaved: (s: ExamStudent) => void }) {
  const [name, setName] = useState(student.full_name);
  const [utorid, setUtorid] = useState(student.utorid ?? "");
  const [saving, setSaving] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Enter the student's name.");
      return;
    }
    setSaving(true);
    try {
      const updated = await updateStudentDetails(examId, student.student_id, {
        full_name: name.trim(),
        utorid: utorid.trim() || null,
      });
      onSaved(updated);
      toast.success(
        student.seat_code
          ? "Saved. If this student's paper was already made, update the papers before printing."
          : "Saved.",
      );
      onClose();
    } catch (err) {
      toast.error(errorMessage(err, "The details couldn't be saved. Try again in a moment."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="space-y-4">
      <DialogHeader>
        <DialogTitle>Student details</DialogTitle>
        <DialogDescription>
          Student number <span className="font-mono">{student.student_number}</span>. A correction applies to every
          exam this student is in, and papers showing the old details need making again.
        </DialogDescription>
      </DialogHeader>
      <Input label="Name" value={name} maxLength={255} onChange={(e) => setName(e.target.value)}
        hint="As it should appear on the paper." />
      <Input label="UTORid" value={utorid} maxLength={50} className="font-mono"
        onChange={(e) => setUtorid(e.target.value)} hint="Leave empty if unknown." />
      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        <Button type="submit" loading={saving}>Save</Button>
      </DialogFooter>
    </form>
  );
}
