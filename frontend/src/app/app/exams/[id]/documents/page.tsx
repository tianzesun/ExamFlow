"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { getExam } from "@/lib/api/exams";
import { getAssignmentSummary, AssignmentSummary } from "@/lib/api/assignments";
import { ExamTemplate } from "@/lib/api/templates";
import {
  validateGeneration, generateExams, listGeneratedExams,
  getGeneratedExamDownloadUrl, GeneratedExam,
} from "@/lib/api/generated";
import { Exam } from "@/lib/types";
import { useAuth } from "@/lib/auth/context";
import { Badge } from "@/components/badge";
import { formatDate, formatNumber, plural } from "@/lib/format";
import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { Table, TableHead, TableBody, Th, Td } from "@/components/table";
import { PageLoader } from "@/components/spinner";
import { EmptyState } from "@/components/empty-state";
import { TemplateCard } from "@/components/exam/TemplateCard";
import { notifyExamChanged } from "@/components/exam/workspace";
import { errorReference } from "@/lib/api/client";
import {
  FileText, Download, AlertCircle, CheckCircle, AlertTriangle, FileCheck2,
  ChevronLeft, ChevronRight, Search,
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Generation state
  const [validation, setValidation] = useState<{ valid: boolean; errors: string[] } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [genResult, setGenResult] = useState<{ generated: number; failed: number } | null>(null);

  const canEdit = user?.role === "ADMIN" || user?.role === "STAFF";

  const fetchData = useCallback(() => {
    let cancelled = false;
    Promise.resolve()
      .then(() => {
        if (!cancelled) setLoading(true);
      })
      .then(async () => {
        if (cancelled) return null;
        const [e, s, g] = await Promise.all([
          getExam(examId),
          getAssignmentSummary(examId).catch(() => null),
          listGeneratedExams(examId, { page, page_size: 50, query: searchQuery || undefined }),
        ]);
        if (cancelled) return null;
        return { exam: e, summary: s, generated: g } as const;
      })
      .then((next) => {
        if (!cancelled && next) {
          setExam(next.exam);
          setSummary(next.summary);
          setGenerated(next.generated.exams);
          setTotalGenerated(next.generated.total);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(`Exam papers could not be loaded. Try again in a moment.${errorReference(err)}`);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [examId, page, searchQuery]);

  useEffect(() => {
    const cleanup = fetchData();
    return cleanup;
  }, [fetchData]);

  const handleValidate = async () => {
    setError(null);
    setGenResult(null);
    try {
      const v = await validateGeneration(examId);
      setValidation(v);
      if (v.valid) setShowConfirm(true);
    } catch (err) {
      setError(`The pre-generation check could not run. Try again in a moment.${errorReference(err)}`);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setShowConfirm(false);
    setError(null);
    try {
      const result = await generateExams(examId);
      setGenResult(result);
      fetchData();
      notifyExamChanged();
    } catch (err) {
      setError(`Papers could not be generated. Try again in a moment.${errorReference(err)}`);
    } finally {
      setGenerating(false);
    }
  };

  const activeTemplate = templates.find(t => t.is_active);

  if (loading && !exam) return <PageLoader />;

  const assigned = summary?.assigned_students ?? 0;
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
          Upload the exam template (A), then generate a personalized paper for every seated student (B).
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
          {genResult.failed > 0 && <span className="text-danger">· {formatNumber(genResult.failed)} failed</span>}
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
              <h3 className="text-sm font-semibold text-ink">Generate {plural(assigned, "paper")}?</h3>
              <p className="mt-0.5 text-sm text-ink-2">
                Uses template {activeTemplate?.original_filename} v{activeTemplate?.version}. Validation passed.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowConfirm(false)}>Cancel</Button>
            <Button onClick={handleGenerate} disabled={generating} loading={generating}>
              <CheckCircle className="h-4 w-4" /> Generate
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

      {/* Generation */}
      {canEdit && (
        <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-ink">B · Generate papers</h3>
            <p className="text-xs text-ink-3">
              {activeTemplate
                ? "Checks everything below, then creates one PDF per seated student."
                : "Available once the template in part A is uploaded."}
            </p>
          </div>
          <Button onClick={handleValidate} disabled={generating || !activeTemplate} loading={generating}>
            <FileCheck2 className="h-4 w-4" /> Check &amp; generate papers
          </Button>
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
              <p className="text-sm font-medium text-ink">Generated</p>
              <p className="tnum text-xs text-ink-3">{formatNumber(totalGenerated)} of {formatNumber(assigned)} seated students</p>
            </div>
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
            title={searchQuery ? "No matching papers" : "No papers generated yet"}
            description={searchQuery ? "Try a different student number or name." : activeTemplate ? "Use “Check & generate papers” to create them." : "Upload the exam template in part A first."}
            action={
              canEdit && !searchQuery ? (
                activeTemplate ? (
                  <Button onClick={handleValidate} disabled={generating} loading={generating}>
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
                <Th>File</Th>
                <Th className="text-right">Size</Th>
                <Th>Template</Th>
                <Th>Status</Th>
                <Th>Created</Th>
                <Th className="text-right">Actions</Th>
              </TableHead>
              <TableBody>
                {generated.map((g) => (
                  <tr key={g.id}>
                    <Td className="font-mono text-xs text-ink-2">{g.student_number}</Td>
                    <Td className="font-medium">{g.full_name}</Td>
                    <Td className="max-w-[240px] truncate font-mono text-xs text-ink-2">{g.file_name}</Td>
                    <Td className="tnum text-right text-xs text-ink-2">{formatNumber(Math.round(g.file_size / 1024))} KB</Td>
                    <Td className="font-mono text-xs text-ink-2">v{g.template_version}</Td>
                    <Td>
                      <Badge variant={g.status === "GENERATED" ? "success" : "danger"}>
                        {g.status.charAt(0) + g.status.slice(1).toLowerCase()}
                      </Badge>
                    </Td>
                    <Td className="text-xs text-ink-2">{formatDate(g.created_at, "")}</Td>
                    <Td className="py-1.5 text-right">
                      <a href={getGeneratedExamDownloadUrl(examId, g.id)} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="sm">
                          <Download className="h-3.5 w-3.5" /> Download
                        </Button>
                      </a>
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
