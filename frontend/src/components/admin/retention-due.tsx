"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { errorMessage } from "@/lib/api/client";
import { getRetentionPlan, runRetention, type RetentionCounts, type SystemSettings } from "@/lib/api/admin";
import { plural } from "@/lib/format";
import { Button } from "@/components";

function describe(c: RetentionCounts): string {
  const parts = [
    c.papers && plural(c.papers, "student paper"),
    c.exam_papers && plural(c.exam_papers, "uploaded exam paper"),
    c.roster_entries && plural(c.roster_entries, "roster entry", "roster entries"),
  ].filter(Boolean);
  return `${parts.join(", ")} from ${plural(c.exams, "exam")}`;
}

/** What the saved periods delete now, so an administrator sees the effect before the daily run. */
export function RetentionDue({ saved }: { saved: SystemSettings["retention"] }) {
  const [due, setDue] = useState<RetentionCounts | null>(null);
  const [running, setRunning] = useState(false);
  const key = JSON.stringify(saved);

  useEffect(() => {
    let cancelled = false;
    getRetentionPlan()
      .then((plan) => { if (!cancelled) setDue(plan); })
      .catch(() => { if (!cancelled) setDue(null); });
    return () => { cancelled = true; };
  }, [key]);

  if (!due) return null;
  const nothing = due.papers + due.exam_papers + due.roster_entries === 0;

  const run = async () => {
    if (!confirm(`Delete ${describe(due)} now? This can't be undone.`)) return;
    setRunning(true);
    try {
      const done = await runRetention();
      toast.success(done.exams ? `Deleted ${describe(done)}.` : "Nothing was due for deletion.");
      setDue(await getRetentionPlan());
    } catch (err) {
      toast.error(errorMessage(err, "The data couldn't be deleted. Try again in a moment."));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-line bg-surface-2 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="text-ink-2">
        {nothing
          ? "With the saved periods, nothing is due for deletion now."
          : `Due for deletion now, with the saved periods: ${describe(due)}.`}
      </p>
      {!nothing && (
        <Button variant="secondary" className="shrink-0 text-danger" onClick={run} loading={running} disabled={running}>
          <Trash2 className="h-4 w-4" /> Delete now
        </Button>
      )}
    </div>
  );
}
