"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { getExam } from "@/lib/api/exams";
import { getAssignmentSummary, AssignmentSummary } from "@/lib/api/assignments";
import { ExamTemplate } from "@/lib/api/templates";
import {
  validateGeneration, startGenerationJob, getLatestGenerationJob, listGeneratedExams, getPaperStatus, PaperStatus,
  getGeneratedExamDownloadUrl, getPrintFileUrl, getPreviewUrl, GeneratedExam, GenerationJob,
} from "@/lib/api/generated";
import { Exam } from "@/lib/types";
import { useAuth } from "@/lib/auth/context";
import { Badge } from "@/components/badge";
import { formatDate, formatNumber, plural } from "@/lib/format";
import { Button } from "@/components/button";
import { DownloadButton } from "@/components/download-button";
import { Input } from "@/components/input";
import { Select } from "@/components/select";
import { Table, TableHead, TableBody, Th, Td } from "@/components/table";
import { PageLoader } from "@/components/spinner";
import { EmptyState } from "@/components/empty-state";
import { TemplateCard } from "@/components/exam/TemplateCard";
import { notifyExamChanged } from "@/components/exam/workspace";
import { errorReference, openFile } from "@/lib/api/client";
import {
  FileText, Download, AlertCircle, CheckCircle, AlertTriangle, FileCheck2,
  ChevronLeft, ChevronRight, Eye, Printer, RefreshCw, Search,
} from "lucide-react";

export default function DocumentsPage() {
  const params = useParams();
  const { user } = useAuth();
  const examId = params.id as string;

  const [exam, setExam] = useState<Exam | null>(null);
  const [summary, setSummary] = useState<AssignmentSummary | null>(null);
  const [templates, setTemplates] = useState<ExamTemplate[]>([]);
  const [generated, setGenerated] = useState<GeneratedExam[]>([]);
  const [totalGenerated, setTotalGenerated] = useState(0);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [outdatedOnly, setOutdatedOnly] = useState(false);
  const [paperStatus, setPaperStatus] = useState<PaperStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Generation state
  const [validation, setValidation] = useState<{ valid: boolean; errors: string[] } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [regenerateAll, setRegenerateAll] = useState(false);
  const [genResult, setGenResult] = useState<{ generated: number } | null>(null);
  const [job, setJob] = useState<GenerationJob | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [printRoom, setPrintRoom] = useState("");
  const [printScope, setPrintScope] = useState<"all" | "new">("all");
  const [doubleSided, setDoubleSided] = useState(false);
  // Id of a job started or seen running on this visit; only its outcome is announced.
  const watchedJobId = useRef<string | null>(null);

  const canEdit = user?.role === "ADMIN" || user?.role === "STAFF";

  const fetchData = useCallback(() => {
    let cancelled = false;
    Promise.resolve()
      .then(() => {
        if (!cancelled) setLoading(true);
      })
      .then(async () => {
        if (cancelled) return null;
        const [e, s, g, ps] = await Promise.all([
          getExam(examId),
          getAssignmentSummary(examId).catch(() => null),
          listGeneratedExams(examId, { page, page_size: 50, query: searchQuery || undefined, outdated_only: outdatedOnly }),
          getPaperStatus(examId).catch(() => null),
        ]);
        if (cancelled) return null;
        return { exam: e, summary: s, generated: g, paperStatus: ps } as const;
      })
      .then((next) => {
        if (!cancelled && next) {
          setExam(next.exam);
          setSummary(next.summary);
          setGenerated(next.generated.exams);
          setTotalGenerated(next.generated.total);
          setPaperStatus(next.paperStatus);
          // Once some papers have gone to print, default to printing only the new ones.
          if (next.paperStatus && next.paperStatus.not_printed > 0 && next.paperStatus.not_printed < next.paperStatus.up_to_date) {
            setPrintScope("new");
          }
        }
      })
      .catch((err) => {
        if (!cancelled) setError(`Exam papers could not be loaded. Try again in a moment.${errorReference(err)}`);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [examId, page, searchQuery, outdatedOnly]);

  useEffect(() => {
    const cleanup = fetchData();
    return cleanup;
  }, [fetchData]);

  // Pick up a run that is already in progress, e.g. after a page refresh.
  useEffect(() => {
    getLatestGenerationJob(examId)
      .then(({ job: latest }) => {
        setJob(latest);
        if (latest && (latest.status === "QUEUED" || latest.status === "RUNNING")) watchedJobId.current = latest.id;
      })
      .catch(() => {});
  }, [examId]);

  const jobActive = job?.status === "QUEUED" || job?.status === "RUNNING";

  // Poll while the job runs; the poll that sees it finish reports the outcome once.
  useEffect(() => {
    if (!jobActive) return;
    const timer = setTimeout(() => {
      getLatestGenerationJob(examId)
        .then(({ job: latest }) => {
          setJob(latest);
          if (!latest || latest.id !== watchedJobId.current) return;
          if (latest.status === "SUCCEEDED") {
            watchedJobId.current = null;
            setGenResult({ generated: latest.generated });
            fetchData();
            notifyExamChanged();
          } else if (latest.status === "FAILED") {
            watchedJobId.current = null;
            setError(latest.error ?? "Papers could not be generated. Try again in a moment.");
          }
        })
        .catch(() => {});
    }, 1000);
    return () => clearTimeout(timer);
  }, [job, jobActive, examId, fetchData]);

  const handleValidate = async () => {
    setError(null);
    setGenResult(null);
    try {
      const v = await validateGeneration(examId);
      setValidation(v);
      setRegenerateAll(false);
      if (v.valid) setShowConfirm(true);
    } catch (err) {
      setError(`The pre-generation check could not run. Try again in a moment.${errorReference(err)}`);
    }
  };

  const handleGenerate = async (full: boolean) => {
    setGenerating(true);
    setShowConfirm(false);
    setError(null);
    setGenResult(null);
    try {
      const started = await startGenerationJob(examId, !full);
      watchedJobId.current = started.id;
      setJob(started);
    } catch (err) {
      setError(`Papers could not be generated. Try again in a moment.${errorReference(err)}`);
    } finally {
      setGenerating(false);
    }
  };

  const handlePreview = async () => {
    setPreviewing(true);
    setError(null);
    try {
      await openFile(getPreviewUrl(examId));
    } catch (err) {
      setError(`The preview couldn't be prepared. Try again in a moment.${errorReference(err)}`);
    } finally {
      setPreviewing(false);
    }
  };

  const activeTemplate = templates.find(t => t.is_active);

  if (loading && !exam) return <PageLoader />;

  const assigned = summary?.assigned_students ?? 0;
  const upToDate = paperStatus?.up_to_date ?? 0;
  const toGenerate = paperStatus?.to_generate ?? assigned;
  const outdated = paperStatus?.outdated ?? 0;
  const hasPapers = upToDate + outdated > 0;
  // Papers exist and all match: generating again would only replace them all.
  const nothingToUpdate = hasPapers && toGenerate === 0;
  const fullRun = regenerateAll || nothingToUpdate;
  const willGenerate = fullRun ? assigned : toGenerate;
  const pageCount = Math.max(1, Math.ceil(totalGenerated / 50));
  const readiness = [
    { label: "Active template", ok: !!activeTemplate, detail: activeTemplate ? `${activeTemplate.original_filename} · v${activeTemplate.version}` : "Upload it in part A" },
    { label: "Roster", ok: (summary?.registered_students ?? 0) > 0, detail: plural(summary?.registered_students ?? 0, "student") },
    { label: "Seating", ok: assigned > 0, detail: `${formatNumber(assigned)} of ${formatNumber(summary?.registered_students ?? 0)} seated` },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-ink">Exam papers</h2>
        <p className="text-sm text-ink-2">
          Upload the exam paper (A), generate a copy for every seated student (B), then print them (C).
          Each copy shows the student&apos;s name, student number, room and seat at the top of every page.
        </p>
        <p className="mt-1 text-xs text-ink-3">
          Tip: leave about 3 cm free at the top of the first page. If something is printed there, the page is
          shrunk slightly so the student&apos;s details never cover your content.
        </p>
      </div>

      <TemplateCard examId={examId} canEdit={canEdit} onChange={setTemplates} />

      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {genResult && (
        <div role="status" className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
          <CheckCircle className="h-4 w-4 shrink-0" />
          Generated {plural(genResult.generated, "paper")}
        </div>
      )}

      {job && jobActive && (
        <div role="status" aria-live="polite" className="surface-card p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-ink">
              {job.status === "QUEUED" || job.total === 0 ? "Starting generation…" : "Generating papers…"}
            </p>
            {job.total > 0 && (
              <p className="tnum text-xs text-ink-2">
                {formatNumber(job.done)} of {formatNumber(job.total)}
              </p>
            )}
          </div>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-hover">
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{
                width: `${job.total > 0 ? Math.round((job.done / job.total) * 100) : 2}%`,
                background: "var(--grad-primary)",
              }}
            />
          </div>
          <p className="mt-2 text-xs text-ink-3">You can leave this page; generation keeps running.</p>
        </div>
      )}

      {/* Confirmation */}
      {showConfirm && (
        <div role="alertdialog" className="surface-card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
              <FileText className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-ink">
                {fullRun && hasPapers ? `Regenerate all ${plural(willGenerate, "paper")}?` : `Generate ${plural(willGenerate, "paper")}?`}
              </h3>
              <p className="mt-0.5 text-sm text-ink-2">
                Uses template {activeTemplate?.original_filename} v{activeTemplate?.version}.{" "}
                {!hasPapers
                  ? "Validation passed."
                  : fullRun
                  ? "Every paper is replaced; copies already printed will no longer verify and must be reprinted."
                  : `Only papers that are new or out of date are made. The other ${plural(upToDate, "paper")} stay as printed.`}
              </p>
              {hasPapers && !nothingToUpdate && (
                <label className="mt-2 inline-flex cursor-pointer select-none items-center gap-2 text-xs text-ink-2">
                  <input
                    type="checkbox"
                    checked={regenerateAll}
                    onChange={(e) => setRegenerateAll(e.target.checked)}
                    className="h-3.5 w-3.5 accent-[var(--accent)]"
                  />
                  Regenerate every paper instead
                </label>
              )}
            </div>
          </div>
          <div className="flex shrink-0 justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowConfirm(false)}>Cancel</Button>
            <Button variant={fullRun && hasPapers ? "danger" : "primary"} onClick={() => handleGenerate(fullRun)}
              disabled={generating || jobActive} loading={generating}>
              <CheckCircle className="h-4 w-4" /> {fullRun && hasPapers ? "Regenerate all" : "Generate"}
            </Button>
          </div>
        </div>
      )}

      {validation && !validation.valid && (
        <div role="alert" className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm">
          <p className="flex items-center gap-2 font-medium text-warning">
            <AlertTriangle className="h-4 w-4" /> Resolve these issues before generating
          </p>
          <ul className="mt-1.5 list-inside list-disc space-y-0.5 pl-6 text-ink-2">
            {validation.errors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}

      {/* Late changes */}
      {hasPapers && toGenerate > 0 && !jobActive && (
        <div role="status" className="flex flex-col gap-3 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2 text-sm text-ink">
            <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <span>
              {plural(toGenerate, "paper")} {toGenerate === 1 ? "needs" : "need"} updating
              {outdated > 0 && ` (${outdated} out of date after a seat or template change)`}.{" "}
              <span className="text-ink-2">
                Only {toGenerate === 1 ? "that paper is" : "those papers are"} made again; the other {plural(upToDate, "paper")} stay valid as printed.
              </span>
            </span>
          </p>
          {canEdit && (
            <Button size="sm" onClick={handleValidate} disabled={generating || !activeTemplate} className="shrink-0">
              Update {plural(toGenerate, "paper")}
            </Button>
          )}
        </div>
      )}

      {/* Generation */}
      {canEdit && (
        <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-ink">B · Generate papers</h3>
            <p className="text-xs text-ink-3">
              {activeTemplate
                ? "Preview one paper with a sample student to check the layout, then generate one PDF per seated student."
                : "Available once the template in part A is uploaded."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={handlePreview} disabled={!activeTemplate || previewing} loading={previewing}>
              <Eye className="h-4 w-4" /> Preview a paper
            </Button>
            {nothingToUpdate ? (
              <Button variant="secondary" onClick={handleValidate} disabled={generating || jobActive || !activeTemplate}>
                <RefreshCw className="h-4 w-4" /> Regenerate all
              </Button>
            ) : (
              <Button onClick={handleValidate} disabled={generating || jobActive || !activeTemplate} loading={generating || jobActive}>
                <FileCheck2 className="h-4 w-4" /> {hasPapers ? `Update ${plural(toGenerate, "paper")}` : "Check & generate papers"}
              </Button>
            )}
          </div>
        </div>
      )}
      {canEdit && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {readiness.map((r) => (
            <div key={r.label} className="surface-card flex h-full items-start gap-3 px-4 py-3.5">
              <span className={r.ok ? "mt-0.5 text-success" : "mt-0.5 text-warning"}>
                {r.ok ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">{r.label}</p>
                <p className="truncate text-xs text-ink-3">{r.detail}</p>
              </div>
            </div>
          ))}
          <div className="surface-card flex h-full items-start gap-3 px-4 py-3.5">
            <span className="mt-0.5 text-accent"><FileText className="h-4 w-4" /></span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink">Papers up to date</p>
              <p className="tnum text-xs text-ink-3">{formatNumber(upToDate)} of {formatNumber(assigned)} seated students</p>
            </div>
          </div>
        </div>
      )}

      {/* Print */}
      {canEdit && upToDate > 0 && (
        <div className="surface-card flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
              <Printer className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-ink">C · Print papers</h3>
              <p className="mt-0.5 text-sm text-ink-2">
                One PDF with every paper in seat order, room by room. Each room starts with a cover sheet,
                so the printed stack can be handed straight to the proctors. Out-of-date papers are left out.
              </p>
              {paperStatus && paperStatus.not_printed < upToDate && (
                <p className="tnum mt-1 text-xs text-ink-3">
                  {formatNumber(upToDate - paperStatus.not_printed)} already sent to print · {formatNumber(paperStatus.not_printed)} not yet
                </p>
              )}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Select
              value={printRoom}
              onChange={(e) => setPrintRoom(e.target.value)}
              options={[
                { value: "", label: "All rooms" },
                ...(summary?.room_details ?? []).map((r) => ({ value: r.room_id, label: `${r.building} ${r.room_number}` })),
              ]}
              aria-label="Room to print"
              className="w-44"
            />
            <Select
              value={printScope}
              onChange={(e) => setPrintScope(e.target.value as "all" | "new")}
              options={[
                { value: "all", label: "All papers" },
                { value: "new", label: `Not yet printed (${formatNumber(paperStatus?.not_printed ?? 0)})` },
              ]}
              aria-label="Papers to print"
              className="w-52"
            />
            <label className="inline-flex h-9 cursor-pointer select-none items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink-2 shadow-[var(--shadow-sm)] hover:bg-surface-hover">
              <input
                type="checkbox"
                checked={doubleSided}
                onChange={(e) => setDoubleSided(e.target.checked)}
                className="h-3.5 w-3.5 accent-[var(--accent)]"
              />
              Double-sided
            </label>
            <DownloadButton
              url={getPrintFileUrl(examId, { roomId: printRoom || undefined, doubleSided, onlyNew: printScope === "new" })}
              filename="exam-papers.pdf"
              disabled={jobActive || (printScope === "new" && (paperStatus?.not_printed ?? 0) === 0)}
              onDownloaded={() => fetchData()}
            >
              <Download className="h-4 w-4" /> Download for printing
            </DownloadButton>
          </div>
        </div>
      )}

      {/* Documents table */}
      <div className="surface-card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line px-5 py-3.5 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-ink">Generated papers</h3>
            <p className="tnum text-xs text-ink-3">{plural(totalGenerated, "paper")}</p>
          </div>
          <div className="flex items-center gap-2">
            {(outdated > 0 || outdatedOnly) && (
              <label className="inline-flex h-9 cursor-pointer select-none items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink-2 shadow-[var(--shadow-sm)] hover:bg-surface-hover">
                <input
                  type="checkbox"
                  checked={outdatedOnly}
                  onChange={(e) => { setOutdatedOnly(e.target.checked); setPage(1); }}
                  className="h-3.5 w-3.5 accent-[var(--accent)]"
                />
                Out of date only
                <span className="tnum text-xs text-ink-3">{outdated}</span>
              </label>
            )}
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
              <Input type="text" placeholder="Search student # or name…" value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchData()}
                aria-label="Search documents"
                className="pl-8 md:w-72" />
            </div>
            <Button variant="secondary" onClick={() => fetchData()}>Search</Button>
          </div>
        </div>
        {generated.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-5 w-5 text-ink-3" />}
            title={searchQuery || outdatedOnly ? "No matching papers" : "No papers generated yet"}
            description={searchQuery ? "Try a different student number or name." : activeTemplate ? "Use “Check & generate papers” to create them." : "Upload the exam template in part A first."}
            action={
              canEdit && !searchQuery ? (
                activeTemplate ? (
                  <Button onClick={handleValidate} disabled={generating || jobActive} loading={generating}>
                    <FileCheck2 className="h-4 w-4" /> Check &amp; generate papers
                  </Button>
                ) : undefined
              ) : undefined
            }
          />
        ) : (
          <>
            <Table>
              <TableHead>
                <Th>Student #</Th>
                <Th>Name</Th>
                <Th>Seat on paper</Th>
                <Th>Template</Th>
                <Th>Status</Th>
                <Th>Printed</Th>
                <Th>Created</Th>
                <Th className="text-right">Actions</Th>
              </TableHead>
              <TableBody>
                {generated.map((g) => (
                  <tr key={g.id}>
                    <Td className="font-mono text-xs text-ink-2">{g.student_number}</Td>
                    <Td className="font-medium">{g.full_name}</Td>
                    <Td>
                      {g.room ?? "—"} <span className="font-mono text-xs font-medium">{g.seat_code}</span>
                    </Td>
                    <Td className="font-mono text-xs text-ink-2">v{g.template_version}</Td>
                    <Td>
                      <Badge variant={g.up_to_date ? "success" : "warning"}>
                        {g.up_to_date ? "Up to date" : "Out of date"}
                      </Badge>
                    </Td>
                    <Td className="text-xs text-ink-2">{g.printed_at ? formatDate(g.printed_at, "") : "Not yet"}</Td>
                    <Td className="text-xs text-ink-2">{formatDate(g.created_at, "")}</Td>
                    <Td className="py-1.5 text-right">
                      <DownloadButton url={getGeneratedExamDownloadUrl(examId, g.id)} filename="exam-paper.pdf" variant="ghost" size="sm">
                          <Download className="h-3.5 w-3.5" /> Download
                        </DownloadButton>
                    </Td>
                  </tr>
                ))}
              </TableBody>
            </Table>
            <div className="flex items-center justify-between border-t border-line bg-surface-2 px-4 py-2.5 text-xs text-ink-3">
              <span className="tnum">Page {page} of {pageCount}</span>
              {totalGenerated > 50 && (
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                    <ChevronLeft className="h-3.5 w-3.5" /> Previous
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setPage(p => p + 1)} disabled={page * 50 >= totalGenerated}>
                    Next <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
