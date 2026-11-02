"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Check } from "lucide-react";
import { getPapersToPull, markPapersPulled, PaperToPull } from "@/lib/api/generated";
import { errorMessage } from "@/lib/api/client";
import { plural } from "@/lib/format";
import { Button } from "@/components/button";
import { Table, TableHead, TableBody, Th, Td } from "@/components/table";

const REASONS: Record<PaperToPull["reason"], string> = {
  removed: "Student removed from the roster",
  out_of_date: "Out of date; a new paper is needed",
  replaced: "Replaced by a newer paper",
};

/**
 * Printed papers that are no longer the student's paper. Until they come out of the stacks they could be
 * handed out, so staff take each one out and tick it off. count comes from the paper status; the list
 * loads only when there is something to pull.
 */
export function PullList({ examId, count, onChange }: { examId: string; count: number; onChange: () => void }) {
  const [papers, setPapers] = useState<PaperToPull[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (count === 0) return;
    let cancelled = false;
    getPapersToPull(examId)
      .then((r) => { if (!cancelled) setPapers(r.papers); })
      .catch(() => { if (!cancelled) setPapers([]); });
    return () => { cancelled = true; };
  }, [examId, count]);

  if (count === 0 || papers.length === 0) return null;

  const pulled = async (ids: string[], key: string) => {
    setBusy(key);
    try {
      const { pulled } = await markPapersPulled(examId, ids);
      toast.success(`${plural(pulled, "paper")} ticked off`);
      setPapers((list) => list.filter((p) => !ids.includes(p.id)));
      onChange();
    } catch (err) {
      toast.error(errorMessage(err, "The papers couldn't be ticked off. Try again in a moment."));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div role="alert" className="surface-card border-warning/30 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-warning/10 text-warning">
            <AlertTriangle className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-ink">
              Take {plural(papers.length, "printed paper")} out of the stacks
            </h3>
            <p className="mt-0.5 text-sm text-ink-2">
              {papers.length === 1 ? "This copy is" : "These copies are"} no longer the student&apos;s paper and
              could be handed out by mistake. Find each by room and seat, shred it, then tick it off. The next print
              file lists them on its first page too.
            </p>
          </div>
        </div>
        <Button
          className="shrink-0"
          variant="secondary"
          onClick={() => pulled(papers.map((p) => p.id), "all")}
          disabled={busy !== null}
          loading={busy === "all"}
        >
          <Check className="h-4 w-4" /> All taken out
        </Button>
      </div>
      <div className="mt-4">
        <Table>
          <TableHead>
            <Th>Room</Th>
            <Th>Seat</Th>
            <Th>Student</Th>
            <Th>Why</Th>
            <Th className="text-right">Taken out</Th>
          </TableHead>
          <TableBody>
            {papers.map((p) => (
              <tr key={p.id}>
                <Td>{p.room}</Td>
                <Td className="font-mono text-xs">{p.seat_code}</Td>
                <Td>{p.full_name ? `${p.full_name} (${p.student_number})` : "—"}</Td>
                <Td className="text-ink-2">{REASONS[p.reason]}</Td>
                <Td className="text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => pulled([p.id], p.id)}
                    disabled={busy !== null}
                    loading={busy === p.id}
                  >
                    <Check className="h-3.5 w-3.5" /> Done
                  </Button>
                </Td>
              </tr>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
