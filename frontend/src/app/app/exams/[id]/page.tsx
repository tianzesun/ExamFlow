"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getExam, updateExam } from "@/lib/api/exams";
import { getAssignmentSummary, AssignmentSummary } from "@/lib/api/assignments";
import { errorReference } from "@/lib/api/client";
import { Exam } from "@/lib/types";
import { useAuth } from "@/lib/auth/context";
import { Card, CardHeader } from "@/components/card";
import { Badge, STATUS_BADGES } from "@/components/badge";
import { Button } from "@/components/button";
import { PageLoader } from "@/components/spinner";
import { EmptyState } from "@/components/empty-state";
import { notifyExamChanged, useExamWorkspace, nextStep } from "@/components/exam/workspace";
import { formatDate, formatDateLong, formatDateTime, formatNumber, formatTime, plural } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  AlertCircle, Archive, ArrowRight, Check, ChevronRight, DoorOpen, LayoutGrid, Undo2,
} from "lucide-react";

const WORKFLOW = ["DRAFT", "CONFIGURED", "READY", "GENERATED", "COMPLETED"] as const;

const STEP_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  CONFIGURED: "Configured",
  READY: "Ready",
  GENERATED: "Generated",
  COMPLETED: "Completed",
  ARCHIVED: "Archived",
};

const STATUS_HELP: Record<string, string> = {
  DRAFT: "Draft: still being set up.",
  CONFIGURED: "Configured: roster and rooms are in place.",
  READY: "Ready: seating has been checked and confirmed.",
  GENERATED: "Generated: exam papers have been produced.",
  COMPLETED: "Completed: the exam has been written.",
};

const VALID_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["CONFIGURED", "ARCHIVED"],
  CONFIGURED: ["READY", "DRAFT", "ARCHIVED"],
  READY: ["GENERATED", "CONFIGURED", "ARCHIVED"],
  GENERATED: ["COMPLETED", "READY", "ARCHIVED"],
  COMPLETED: ["ARCHIVED"],
  ARCHIVED: [],
};

export default function ExamDetailPage() {
  const params = useParams();
  const { user } = useAuth();
  const { steps, progress } = useExamWorkspace();
  const examId = params.id as string;

  const [exam, setExam] = useState<Exam | null>(null);
  const [summary, setSummary] = useState<AssignmentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  const canEdit = user?.role === "ADMIN" || user?.role === "STAFF";

  const fetchData = useCallback(() => {
    let cancelled = false;
    Promise.resolve()
      .then(() => {
        if (!cancelled) setLoading(true);
      })
      .then(async () => {
        if (cancelled) return null;
        const [e, s] = await Promise.all([
          getExam(examId),
          getAssignmentSummary(examId).catch(() => null),
        ]);
        if (cancelled) return null;
        return { exam: e, summary: s } as const;
      })
      .then((next) => {
        if (!cancelled && next) {
          setExam(next.exam);
          setSummary(next.summary);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(`This exam could not be loaded.${errorReference(err)}`);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [examId]);

  useEffect(() => {
    const cleanup = fetchData();
    return cleanup;
  }, [fetchData]);

  const handleStatusChange = async (newStatus: string) => {
    if (!exam) return;
    setUpdating(true);
    try {
      const updated = await updateExam(exam.id, { status: newStatus });
      setExam(updated);
      notifyExamChanged(updated);
    } catch (err) {
      setError(`The status could not be changed. Try again in a moment.${errorReference(err)}`);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) return <PageLoader />;
  if (!exam) {
    return (
      <Card>
        <EmptyState
          icon={<AlertCircle className="h-5 w-5 text-ink-3" />}
          title="Exam not found"
          description={error ? "This exam could not be loaded. Try again in a moment." : "It may have been removed."}
          action={<Link href="/app/exams"><Button variant="secondary">Back to exams</Button></Link>}
        />
      </Card>
    );
  }

  const transitions = VALID_TRANSITIONS[exam.status] || [];
  const currentStep = WORKFLOW.indexOf(exam.status as (typeof WORKFLOW)[number]);
  const forward = transitions.filter((s) => s !== "ARCHIVED" && WORKFLOW.indexOf(s as (typeof WORKFLOW)[number]) > currentStep);
  const backward = transitions.filter((s) => s !== "ARCHIVED" && WORKFLOW.indexOf(s as (typeof WORKFLOW)[number]) < currentStep);
  const canArchive = transitions.includes("ARCHIVED");
  const next = progress ? nextStep(steps) : undefined;
  const doneCount = steps.filter((st) => st.state === "done").length;
  const hasRooms = !!summary && summary.room_details.length > 0;

  return (
    <div className="space-y-6">
      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* What to do next */}
      {next ? (
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-4 bg-accent-subtle/60 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-base font-semibold text-white tnum">
                {next.number}
              </span>
              <div>
                <p className="eyebrow text-accent">Next step · {next.number} of {steps.length}</p>
                <h2 className="mt-0.5 text-lg font-semibold tracking-tight text-ink">{next.action}</h2>
                <p className="mt-0.5 text-sm text-ink-2">{next.description}</p>
              </div>
            </div>
            <Link href={`/app/exams/${exam.id}/${next.segment}`} className="shrink-0">
              <Button size="lg">
                {next.action} <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </Card>
      ) : steps.length > 0 && progress ? (
        <Card>
          <div className="flex items-center gap-4 px-5 py-5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success text-white">
              <Check className="h-5 w-5" strokeWidth={3} />
            </span>
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-ink">Everything is done</h2>
              <p className="text-sm text-ink-2">All four steps are complete for this exam.</p>
            </div>
          </div>
        </Card>
      ) : null}

      {/* Checklist */}
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-ink">Setup checklist</h2>
          <p className="text-xs text-ink-3">
            {progress ? `${doneCount} of ${steps.length} steps complete` : "Checking progress…"}
          </p>
        </CardHeader>
        <ol className="divide-y divide-line">
          {steps.map((step) => (
            <li key={step.key}>
              <Link
                href={`/app/exams/${exam.id}/${step.segment}`}
                className="group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-surface-hover"
              >
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tnum",
                    step.state === "done" && "bg-success text-white",
                    step.state === "current" && "bg-accent text-white",
                    step.state === "attention" && "bg-warning/15 text-warning ring-1 ring-warning/40",
                    step.state === "todo" && "text-ink-3 ring-1 ring-line-strong",
                  )}
                >
                  {step.state === "done" ? <Check className="h-4 w-4" strokeWidth={3} /> : step.number}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
                    {step.label}
                    {step.state === "done" && <Badge variant="success">Done</Badge>}
                    {step.state === "current" && <Badge variant="info">Up next</Badge>}
                    {step.state === "attention" && <Badge variant="warning">Needs attention</Badge>}
                  </p>
                  <p className="mt-0.5 text-sm text-ink-2">{progress ? step.description : "\u00a0"}</p>
                </div>
                <span className="hidden shrink-0 text-sm font-medium text-ink-3 group-hover:text-accent sm:inline-flex sm:items-center sm:gap-1">
                  {step.state === "done" ? "Review" : "Open"} <ChevronRight className="h-4 w-4" />
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </Card>

      <div className={cn("grid grid-cols-1 gap-6", hasRooms && "lg:grid-cols-3")}>
        {/* Details */}
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-ink">Exam details</h2>
            <p className="text-xs text-ink-3">Schedule and record information</p>
          </CardHeader>
          <dl className="divide-y divide-line px-5 text-sm">
            {[
              ["Course", <><span className="font-mono text-xs text-ink-2">{exam.course_code}</span> <span>{exam.course_name}</span></>],
              ["Term", `${exam.term} ${exam.academic_year}`],
              ["Date", formatDateLong(exam.exam_date)],
              ["Start time", formatTime(exam.start_time, "—")],
              ["Duration", `${exam.duration_minutes} min`],
              ["Created", formatDate(exam.created_at)],
              ["Last updated", formatDateTime(exam.updated_at)],
            ].map(([label, value]) => (
              <div key={label as string} className="flex items-baseline justify-between gap-4 py-2.5">
                <dt className="shrink-0 text-ink-3">{label}</dt>
                <dd className="min-w-0 text-right font-medium text-ink">{value}</dd>
              </div>
            ))}
          </dl>
        </Card>

        {/* Seating */}
        {hasRooms && (
        <Card className="flex flex-col lg:col-span-2">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-ink">Seating</h2>
              <p className="text-xs text-ink-3">Room utilization for this exam</p>
            </div>
            <div className="flex items-center gap-2">
              <Link href={`/app/exams/${exam.id}/seating`}>
                <Button variant="ghost" size="sm">
                  {summary && summary.assigned_students > 0 ? "Seating details" : "Configure seating"}
                </Button>
              </Link>
              {summary && summary.assigned_students > 0 && (
                <Link href={`/app/exams/${exam.id}/seat-map`}>
                  <Button variant="secondary" size="sm">
                    <LayoutGrid className="h-3.5 w-3.5" /> Open seat map
                  </Button>
                </Link>
              )}
            </div>
          </CardHeader>
          {summary && summary.room_details.length > 0 ? (
            <ul className="divide-y divide-line">
              {summary.room_details.map((rd) => {
                const pct = rd.total_seats > 0 ? rd.used_seats / rd.total_seats : 0;
                return (
                  <li key={rd.room_id} className="flex items-center gap-4 px-5 py-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-hover text-ink-3">
                      <DoorOpen className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="truncate text-sm font-medium text-ink">
                          {rd.building} <span className="font-mono text-xs text-ink-2">{rd.room_number}</span>
                        </p>
                        <p className="tnum shrink-0 text-xs text-ink-3">
                          <span className="font-medium text-ink">{formatNumber(rd.used_seats)}</span> / {formatNumber(rd.total_seats)} seats
                        </p>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-hover">
                        <div
                          className={cn("h-full rounded-full", pct >= 0.95 ? "bg-warning" : "bg-accent")}
                          style={{ width: `${Math.round(pct * 100)}%` }}
                        />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState
              icon={<DoorOpen className="h-5 w-5 text-ink-3" />}
              title="No rooms assigned yet"
              description="Add rooms and generate seating to see utilization here."
              action={
                <Link href={`/app/exams/${exam.id}/seating`}>
                  <Button size="sm">Set up seating</Button>
                </Link>
              }
            />
          )}
          {summary && summary.room_details.length > 0 && (
            <div className="mt-auto flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-line bg-surface-2 px-5 py-3 text-xs text-ink-2">
              <span className="tnum">
                <span className="font-medium text-ink">{formatNumber(summary.assigned_students)}</span> of {plural(summary.registered_students, "student")} seated
              </span>
              <span className="tnum">{plural(summary.unused_seats, "seat")} free</span>
              {summary.unassigned_students > 0 && (
                <span className="tnum inline-flex items-center gap-1 text-warning">
                  <AlertCircle className="h-3.5 w-3.5" /> {plural(summary.unassigned_students, "student")} still need a seat
                </span>
              )}
            </div>
          )}
        </Card>
        )}
      </div>

      {/* Status label */}
      <Card>
        <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
              Exam status
              <Badge variant={STATUS_BADGES[exam.status] || "default"}>{STEP_LABELS[exam.status] || exam.status}</Badge>
            </h2>
            <p className="mt-0.5 text-xs text-ink-3">
              {exam.status === "ARCHIVED"
                ? "This exam is archived and read-only."
                : `${STATUS_HELP[exam.status] ?? ""} The status is a sign-off label for your team; the checklist above tracks the actual work.`}
            </p>
          </div>
          {canEdit && transitions.length > 0 && (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {canArchive && (
                <Button variant="ghost" size="sm" onClick={() => handleStatusChange("ARCHIVED")} disabled={updating}>
                  <Archive className="h-3.5 w-3.5" /> Archive
                </Button>
              )}
              {backward.map((s) => (
                <Button key={s} variant="secondary" size="sm" onClick={() => handleStatusChange(s)} disabled={updating}>
                  <Undo2 className="h-3.5 w-3.5" /> Back to {STEP_LABELS[s].toLowerCase()}
                </Button>
              ))}
              {forward.map((s) => (
                <Button key={s} variant="secondary" size="sm" onClick={() => handleStatusChange(s)} loading={updating}>
                  Mark as {STEP_LABELS[s].toLowerCase()}
                </Button>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
