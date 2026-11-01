"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AlertCircle } from "lucide-react";
import { updateExam } from "@/lib/api/exams";
import { getReadiness } from "@/lib/api/readiness";
import { ApiError, errorReference } from "@/lib/api/client";
import type { Exam } from "@/lib/types";
import { endTime, formatTime, plural } from "@/lib/format";
import { Button, Input, Select } from "@/components";

const TERMS = ["Fall", "Winter", "Spring", "Summer"];

/** Edit an exam's name, term and schedule. Only the fields that changed are sent. */
export function ExamDetailsForm({ exam, papers, onSaved, onCancel }: {
  exam: Exam;
  /** Papers generated so far; they print the exam's name, so renaming makes them out of date. */
  papers: number;
  onSaved: (exam: Exam) => void;
  onCancel: () => void;
}) {
  const original = {
    exam_name: exam.exam_name,
    term: exam.term,
    academic_year: exam.academic_year,
    exam_date: exam.exam_date,
    start_time: exam.start_time.slice(0, 5),
    duration_minutes: exam.duration_minutes,
  };
  const [form, setForm] = useState(original);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const changes = Object.fromEntries(
    Object.entries({ ...form, exam_name: form.exam_name.trim() })
      .filter(([k, v]) => v !== original[k as keyof typeof original]),
  ) as Partial<typeof form>;
  const scheduleChanged = ["exam_date", "start_time", "duration_minutes"].some((k) => k in changes);
  const ends = endTime(form.start_time, form.duration_minutes);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (Object.keys(changes).length === 0) return onCancel();
    setSaving(true);
    setError("");
    try {
      const updated = await updateExam(exam.id, changes);
      onSaved(updated);
      toast.success("Exam details saved");
      if ("exam_name" in changes && papers > 0) {
        toast.info(`${plural(papers, "paper")} still show the old name. Generate them again on Exam papers before printing.`);
      }
      if (scheduleChanged) {
        // Moving the exam can put it at the same time as another exam that uses the same seats.
        const clash = (await getReadiness(exam.id).catch(() => null))?.checks.find((c) => c.name === "seat_clashes");
        if (clash) toast.warning(clash.message, { duration: 12000 });
      }
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 400
          ? err.message
          : `The changes couldn't be saved. Check the details and try again.${errorReference(err)}`,
      );
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
      <Input
        label="Exam name"
        value={form.exam_name}
        onChange={(e) => setForm({ ...form, exam_name: e.target.value })}
        maxLength={255}
        required
        autoFocus
      />
      <div className="grid grid-cols-2 gap-3">
        <Select
          label="Term"
          options={TERMS.includes(form.term) ? TERMS.map((v) => ({ value: v, label: v }))
            : [form.term, ...TERMS].map((v) => ({ value: v, label: v }))}
          value={form.term}
          onChange={(e) => setForm({ ...form, term: e.target.value })}
        />
        <Input
          label="Academic year"
          type="number"
          min={2020}
          max={2100}
          className="tnum"
          value={form.academic_year}
          onChange={(e) => setForm({ ...form, academic_year: parseInt(e.target.value) || 0 })}
          required
        />
      </div>
      <Input
        label="Date"
        type="date"
        value={form.exam_date}
        onChange={(e) => setForm({ ...form, exam_date: e.target.value })}
        required
      />
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Start time"
          type="time"
          value={form.start_time}
          onChange={(e) => setForm({ ...form, start_time: e.target.value })}
          required
        />
        <Input
          label="Duration (minutes)"
          type="number"
          min={1}
          max={600}
          className="tnum"
          value={form.duration_minutes}
          onChange={(e) => setForm({ ...form, duration_minutes: parseInt(e.target.value) || 0 })}
          hint={ends ? `Ends at ${formatTime(ends)}` : undefined}
          required
        />
      </div>

      {scheduleChanged && (
        <p className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs text-ink-2">
          Seats stay as they are. If another exam uses the same rooms at the new time, you&rsquo;ll be told which
          students to move.
        </p>
      )}
      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-danger/25 bg-danger/10 px-3 py-2 text-sm text-danger">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="secondary" size="sm" type="button" onClick={onCancel}>Cancel</Button>
        <Button size="sm" type="submit" loading={saving} disabled={Object.keys(changes).length === 0}>
          Save changes
        </Button>
      </div>
    </form>
  );
}
