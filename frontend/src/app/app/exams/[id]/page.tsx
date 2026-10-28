"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getExam, updateExam } from "@/lib/api/exams";
import { getAssignmentSummary, AssignmentSummary } from "@/lib/api/assignments";
import {
  uploadTemplate, listTemplates, getTemplateDownloadUrl,
  activateTemplate, archiveTemplate, ExamTemplate,
} from "@/lib/api/templates";
import { Exam } from "@/lib/types";
import { useAuth } from "@/lib/auth/context";
import { Card, CardHeader } from "@/components/card";
import { Badge } from "@/components/badge";
import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { Table, TableHead, TableBody, Th, Td } from "@/components/table";
import { PageLoader } from "@/components/spinner";
import { EmptyState } from "@/components/empty-state";
import { StatCard } from "@/components/dashboard/StatCard";
import { formatDate, formatDateLong, formatDateTime, formatNumber, formatTime, plural } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  AlertCircle, Archive, Armchair, Check, CheckCircle2, DoorOpen, Download,
  FileText, LayoutGrid, Undo2, Upload, Users, UserX,
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

const STEP_HINTS: Record<string, string> = {
  DRAFT: "Roster and schedule",
  CONFIGURED: "Rooms and template",
  READY: "Seating confirmed",
  GENERATED: "Documents created",
  COMPLETED: "Exam administered",
};

const formatMb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

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
  const templateInputRef = useRef<HTMLInputElement>(null);
  const examId = params.id as string;

  const [exam, setExam] = useState<Exam | null>(null);
  const [summary, setSummary] = useState<AssignmentSummary | null>(null);
  const [templates, setTemplates] = useState<ExamTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [crowdmarkId, setCrowdmarkId] = useState("");
  const [crowdmarkUrl, setCrowdmarkUrl] = useState("");

  const canEdit = user?.role === "ADMIN" || user?.role === "STAFF";

  const fetchData = useCallback(() => {
    let cancelled = false;
    Promise.resolve()
      .then(() => {
        if (!cancelled) setLoading(true);
      })
      .then(async () => {
        if (cancelled) return null;
        const [e, s, t] = await Promise.all([
          getExam(examId),
          getAssignmentSummary(examId).catch(() => null),
          listTemplates(examId).catch(() => []),
        ]);
        if (cancelled) return null;
        return { exam: e, summary: s, templates: t } as const;
      })
      .then((next) => {
        if (!cancelled && next) {
          setExam(next.exam);
          setSummary(next.summary);
          setTemplates(next.templates);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
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
      window.dispatchEvent(new CustomEvent("examflow:exam-updated", { detail: updated }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setUpdating(false);
    }
  };

  const handleTemplateUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      await uploadTemplate(examId, file, crowdmarkId || undefined, crowdmarkUrl || undefined);
      setCrowdmarkId("");
      setCrowdmarkUrl("");
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (templateInputRef.current) templateInputRef.current.value = "";
    }
  };

  const handleActivate = async (templateId: string) => {
    try {
      await activateTemplate(examId, templateId);
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Activation failed");
    }
  };

  const handleArchive = async (templateId: string) => {
    if (!confirm("Archive this template?")) return;
    try {
      await archiveTemplate(examId, templateId);
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Archive failed");
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
  const activeTemplate = templates.find(t => t.is_active);
  const currentStep = WORKFLOW.indexOf(exam.status as (typeof WORKFLOW)[number]);
  const forward = transitions.filter((s) => s !== "ARCHIVED" && WORKFLOW.indexOf(s as (typeof WORKFLOW)[number]) > currentStep);
  const backward = transitions.filter((s) => s !== "ARCHIVED" && WORKFLOW.indexOf(s as (typeof WORKFLOW)[number]) < currentStep);
  const canArchive = transitions.includes("ARCHIVED");
  const seatedPct = summary && summary.registered_students > 0 ? summary.assigned_students / summary.registered_students : 0;

  return (
    <div className="space-y-6">
      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Workflow */}
      <Card>
        <div className="flex flex-col gap-3 border-b border-line px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-ink">Workflow</h2>
            <p className="text-xs text-ink-3">
              {exam.status === "ARCHIVED"
                ? "This exam is archived and read-only."
                : "Advance the exam once each stage is complete."}
            </p>
          </div>
          {canEdit && transitions.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
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
                <Button key={s} size="sm" onClick={() => handleStatusChange(s)} loading={updating}>
                  Mark as {STEP_LABELS[s].toLowerCase()}
                </Button>
              ))}
            </div>
          )}
        </div>
        <ol className="grid grid-cols-5 gap-2 px-5 py-5">
          {WORKFLOW.map((step, i) => {
            const done = exam.status === "ARCHIVED" || i < currentStep;
            const current = i === currentStep;
            return (
              <li key={step} className="relative flex min-w-0 flex-col items-start gap-2">
                {i < WORKFLOW.length - 1 && (
                  <span
                    aria-hidden
                    className={cn(
                      "absolute left-7 right-0 top-3 h-px -mr-2",
                      done ? "bg-accent" : "bg-line-strong",
                    )}
                  />
                )}
                <span
                  className={cn(
                    "relative z-10 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold tnum",
                    done && "bg-accent text-surface",
                    current && "bg-surface text-accent ring-2 ring-accent",
                    !done && !current && "bg-surface text-ink-3 ring-1 ring-line-strong",
                  )}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </span>
                <div className={cn("w-full min-w-0", !current && "hidden sm:block")}>
                  <p className={cn("truncate text-sm font-medium", current ? "text-ink" : done ? "text-ink-2" : "text-ink-3")}>
                    {STEP_LABELS[step]}
                  </p>
                  <p className="hidden truncate text-xs text-ink-3 md:block">{STEP_HINTS[step]}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Users} label="Registered" value={summary?.registered_students ?? 0} color="accent" hint="students on roster" />
        <StatCard
          icon={CheckCircle2}
          label="Seated"
          value={summary?.assigned_students ?? 0}
          color="success"
          hint={`${Math.round(seatedPct * 100)}% of roster`}
          progress={seatedPct}
        />
        <StatCard
          icon={Armchair}
          label="Seats available"
          value={summary?.available_seats ?? 0}
          color="violet"
          hint={summary ? `across ${plural(summary.rooms_used, "room")}` : undefined}
        />
        <StatCard
          icon={UserX}
          label="Unassigned"
          value={summary?.unassigned_students ?? 0}
          color={summary && summary.unassigned_students > 0 ? "warning" : "neutral"}
          hint={summary ? `${plural(summary.unused_seats, "seat")} unused` : undefined}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
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
      </div>

      {/* Exam template */}
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-ink">Exam template</h2>
          <p className="text-xs text-ink-3">Crowdmark PDF used to generate personalized exams</p>
        </CardHeader>
        <div className="space-y-5 px-5 py-4">
          {activeTemplate ? (
            <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface-2 p-3.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success">
                  <FileText className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="flex items-center gap-2 truncate text-sm font-medium text-ink">
                    {activeTemplate.original_filename}
                    <Badge variant="success">Active</Badge>
                  </p>
                  <p className="tnum mt-0.5 text-xs text-ink-3">
                    Version {activeTemplate.version} · {formatMb(activeTemplate.file_size)}
                    {activeTemplate.crowdmark_exam_id && <> · Crowdmark ID <span className="font-mono">{activeTemplate.crowdmark_exam_id}</span></>}
                    {activeTemplate.created_at && <> · Uploaded {formatDate(activeTemplate.created_at)}</>}
                  </p>
                </div>
              </div>
              <a href={getTemplateDownloadUrl(examId, activeTemplate.id)} target="_blank" rel="noopener noreferrer">
                <Button variant="secondary" size="sm">
                  <Download className="h-3.5 w-3.5" /> Download
                </Button>
              </a>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-lg border border-dashed border-line-strong px-4 py-3.5 text-sm text-ink-2">
              <FileText className="h-4 w-4 shrink-0 text-ink-3" />
              No active template yet. Upload the Crowdmark PDF to enable document generation.
            </div>
          )}

          {canEdit && (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">
                {activeTemplate ? "Upload a new version" : "Upload template"}
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input type="text" placeholder="Crowdmark exam ID (optional)" value={crowdmarkId}
                  onChange={(e) => setCrowdmarkId(e.target.value)} aria-label="Crowdmark exam ID" />
                <Input type="text" placeholder="Crowdmark URL (optional)" value={crowdmarkUrl}
                  onChange={(e) => setCrowdmarkUrl(e.target.value)} aria-label="Crowdmark URL" />
              </div>
              <div className="flex items-center justify-end gap-3">
                <span className="text-xs text-ink-3">PDF only</span>
                <input ref={templateInputRef} type="file" accept=".pdf" onChange={handleTemplateUpload} className="sr-only" tabIndex={-1} aria-hidden />
                <Button size="sm" onClick={() => templateInputRef.current?.click()} loading={uploading}>
                  <Upload className="h-3.5 w-3.5" /> {uploading ? "Uploading…" : "Choose PDF"}
                </Button>
              </div>
            </div>
          )}
        </div>

        {templates.length > 1 && (
          <div className="border-t border-line">
            <div className="px-5 pb-2 pt-4">
              <h3 className="text-sm font-semibold text-ink">Version history</h3>
            </div>
            <Table>
              <TableHead>
                <Th>Version</Th>
                <Th>File</Th>
                <Th>Size</Th>
                <Th>Status</Th>
                <Th>Uploaded</Th>
                {canEdit && <Th className="text-right">Actions</Th>}
              </TableHead>
              <TableBody>
                {templates.map((t) => (
                  <tr key={t.id}>
                    <Td className="font-mono text-xs">v{t.version}</Td>
                    <Td className="max-w-[320px] truncate">{t.original_filename}</Td>
                    <Td className="tnum text-ink-2">{formatMb(t.file_size)}</Td>
                    <Td>
                      <Badge variant={t.is_active ? "success" : "default"}>
                        {t.is_active ? "Active" : "Archived"}
                      </Badge>
                    </Td>
                    <Td className="text-ink-2">{formatDate(t.created_at, "")}</Td>
                    {canEdit && (
                      <Td className="text-right">
                        <div className="flex justify-end gap-1">
                          <a href={getTemplateDownloadUrl(examId, t.id)} target="_blank" rel="noopener noreferrer">
                            <Button variant="ghost" size="sm">Download</Button>
                          </a>
                          {!t.is_active && (
                            <Button variant="ghost" size="sm" className="text-accent hover:text-accent-strong" onClick={() => handleActivate(t.id)}>
                              Activate
                            </Button>
                          )}
                          {t.is_active && templates.filter(tt => tt.is_active).length > 1 && (
                            <Button variant="ghost" size="sm" className="text-danger hover:text-danger" onClick={() => handleArchive(t.id)}>
                              Archive
                            </Button>
                          )}
                        </div>
                      </Td>
                    )}
                  </tr>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
