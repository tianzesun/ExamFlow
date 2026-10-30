"use client";

import { createContext, useContext } from "react";
import type { Exam } from "@/lib/types";
import type { ExamSummary } from "@/lib/api/readiness";
import { formatNumber, plural } from "@/lib/format";

/** Pages in the exam workspace dispatch this after changing the exam or its data. */
export const EXAM_UPDATED_EVENT = "examflow:exam-updated";

/** Tell the workspace header to refresh. Pass the updated exam when you have it. */
export function notifyExamChanged(exam?: Exam) {
  window.dispatchEvent(new CustomEvent(EXAM_UPDATED_EVENT, { detail: exam }));
}

export type StepState = "done" | "current" | "todo" | "attention";

export interface WorkspaceStep {
  key: "students" | "seats" | "papers" | "day";
  number: number;
  label: string;
  /** URL segment under /app/exams/[id]; seat-map also belongs to "seats". */
  segment: string;
  state: StepState;
  /** Short progress text, e.g. "12 students". */
  status: string;
  /** One sentence telling the user what this step is or what's left. */
  description: string;
  /** Call to action when this step is the next one. */
  action: string;
}

/**
 * Derive step progress from real data, not the exam's status label, so the
 * workspace always reflects what has actually been done.
 */
export function computeSteps(exam: Exam | null, p: ExamSummary | null): WorkspaceStep[] {
  const roster = p?.roster_count ?? 0;
  const assigned = p?.assigned_count ?? 0;
  const unassigned = p?.unassigned_count ?? 0;
  const rooms = p?.room_count ?? 0;
  const generated = p?.generated_count ?? 0;
  const hasTemplate = !!p?.has_template;

  const studentsDone = roster > 0;
  const seatsDone = studentsDone && assigned > 0 && unassigned === 0;
  const papersDone = generated > 0 && generated >= assigned;
  const dayDone = exam?.status === "COMPLETED" || exam?.status === "ARCHIVED";

  const steps: Omit<WorkspaceStep, "state">[] = [
    {
      key: "students",
      number: 1,
      label: "Students",
      segment: "roster",
      status: studentsDone ? plural(roster, "student") : "Not imported",
      description: studentsDone
        ? `${plural(roster, "student")} registered for this exam.`
        : "Import the class list (CSV) so everyone writing the exam is on the roster.",
      action: "Import students",
    },
    {
      key: "seats",
      number: 2,
      label: "Seats",
      segment: "seating",
      status: !rooms
        ? "No rooms"
        : seatsDone
          ? "Everyone seated"
          : `${formatNumber(assigned)} of ${formatNumber(roster)} seated`,
      description: !rooms
        ? "Choose the rooms for this exam, then assign every student a seat."
        : seatsDone
          ? `${plural(assigned, "student")} seated across ${plural(rooms, "room")}.`
          : `${plural(unassigned || Math.max(roster - assigned, 0), "student")} still need a seat.`,
      action: "Assign seats",
    },
    {
      key: "papers",
      number: 3,
      label: "Exam papers",
      segment: "documents",
      // generated counts up-to-date papers only, so after late changes some are left to update.
      status: papersDone
        ? plural(generated, "paper")
        : generated > 0
          ? `${formatNumber(assigned - generated)} to update`
          : hasTemplate
            ? "Ready to generate"
            : "No template",
      description: papersDone
        ? `${plural(generated, "personalized paper")} generated.`
        : generated > 0
          ? `${plural(assigned - generated, "paper")} must be made again after seating or template changes; the rest stay valid.`
          : hasTemplate
            ? "The template is uploaded. Generate a personalized paper for each seated student."
            : "Upload the Crowdmark exam PDF, then generate a personalized paper for each student.",
      action: generated > 0 && !papersDone ? "Update papers" : hasTemplate ? "Generate papers" : "Upload exam paper",
    },
    {
      key: "day",
      number: 4,
      label: "Exam day",
      segment: "administration",
      status: dayDone ? "Done" : "Sign-in sheets",
      description: dayDone
        ? "This exam has been administered."
        : "Print room seating maps and sign-in sheets, and download the exam package.",
      action: "Prepare exam day",
    },
  ];

  const done = [studentsDone, seatsDone, papersDone, dayDone];
  const nextIndex = done.findIndex((d) => !d);
  return steps.map((s, i) => ({
    ...s,
    state: done[i]
      ? "done"
      : i === nextIndex
        ? "current"
        : // Later steps with partial progress (e.g. seats assigned but some missing) need attention.
          i === 1 && rooms > 0 && unassigned > 0
          ? "attention"
          : "todo",
  }));
}

export function nextStep(steps: WorkspaceStep[]): WorkspaceStep | undefined {
  return steps.find((s) => s.state === "current");
}

interface WorkspaceValue {
  exam: Exam | null;
  progress: ExamSummary | null;
  steps: WorkspaceStep[];
}

export const ExamWorkspaceContext = createContext<WorkspaceValue>({ exam: null, progress: null, steps: [] });

export function useExamWorkspace() {
  return useContext(ExamWorkspaceContext);
}
