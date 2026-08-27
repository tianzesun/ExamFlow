"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getExam } from "@/lib/api/exams";
import { getAssignmentSummary, AssignmentSummary } from "@/lib/api/assignments";
import { listTemplates, ExamTemplate } from "@/lib/api/templates";
import {
  validateGeneration, generateExams, listGeneratedExams,
  getGeneratedExamDownloadUrl, GeneratedExam,
} from "@/lib/api/generated";
import { Exam } from "@/lib/types";
import { useAuth } from "@/lib/auth/context";
import { Card, CardContent } from "@/components/card";
import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { Table, TableHead, TableBody, Th, Td } from "@/components/table";
import { PageLoader } from "@/components/spinner";
import { EmptyState } from "@/components/empty-state";
import { FileText, Download, AlertCircle, CheckCircle, AlertTriangle } from "lucide-react";

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
        const [e, s, t, g] = await Promise.all([
          getExam(examId),
          getAssignmentSummary(examId).catch(() => null),
          listTemplates(examId).catch(() => []),
          listGeneratedExams(examId, { page, page_size: 50, query: searchQuery || undefined }),
        ]);
        if (cancelled) return null;
        return { exam: e, summary: s, templates: t, generated: g } as const;
      })
      .then((next) => {
        if (!cancelled && next) {
          setExam(next.exam);
          setSummary(next.summary);
          setTemplates(next.templates);
          setGenerated(next.generated.exams);
          setTotalGenerated(next.generated.total);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
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
      setError(err instanceof Error ? err.message : "Validation failed");
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const activeTemplate = templates.find(t => t.is_active);

  if (loading && !exam) return <PageLoader />;

  return (
    <div className="space-y-6">
      <Link href={`/app/exams/${examId}`} className="text-sm text-zinc-500 hover:text-black dark:text-zinc-500 dark:hover:text-white">← Back to Exam</Link>

      <div>
        <h1 className="text-2xl font-bold text-black dark:text-white flex items-center gap-2">
          <FileText className="h-6 w-6 text-zinc-400" />
          Generated Documents
        </h1>
        {exam && <p className="text-sm text-zinc-500">{exam.course_code} — {exam.exam_name}</p>}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md bg-red-50 p-4 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-400">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Generation Panel */}
      {canEdit && (
        <Card>
          <CardContent>
            <h2 className="text-lg font-medium text-black dark:text-white">Generate Personalized Exams</h2>
            <div className="mt-3 grid grid-cols-4 gap-4 text-sm">
              <div><span className="text-zinc-500">Template:</span> <span className="font-medium">{activeTemplate ? `v${activeTemplate.version}` : "None"}</span></div>
              <div><span className="text-zinc-500">Students:</span> <span className="font-medium">{summary?.registered_students ?? 0}</span></div>
              <div><span className="text-zinc-500">Assigned:</span> <span className="font-medium">{summary?.assigned_students ?? 0}</span></div>
              <div><span className="text-zinc-500">Generated:</span> <span className="font-medium">{totalGenerated}</span></div>
            </div>

            {!activeTemplate && (
              <div className="mt-3 flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4" />
                Upload a Crowdmark template first.
              </div>
            )}

            {validation && !validation.valid && (
              <div className="mt-3 rounded-md bg-amber-50 p-3 text-sm dark:bg-amber-900/20">
                <p className="font-medium text-amber-800 dark:text-amber-300">Validation issues:</p>
                <ul className="mt-1 list-inside list-disc text-amber-700 dark:text-amber-400">
                  {validation.errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            )}

            {genResult && (
              <div className="flex items-center gap-2 mt-3 rounded-md bg-green-50 p-3 text-sm dark:bg-green-900/20">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <p className="text-green-800 dark:text-green-300">
                  Generated: {genResult.generated} · Failed: {genResult.failed}
                </p>
              </div>
            )}

            <div className="mt-4 flex gap-3">
              <Button variant="secondary" onClick={handleValidate} disabled={generating || !activeTemplate} loading={generating}>
                Validate & Preview
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Confirmation Dialog */}
      {showConfirm && (
        <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20">
          <CardContent>
            <h2 className="text-lg font-medium text-blue-900 dark:text-blue-100">Confirm Generation</h2>
            <p className="mt-2 text-sm text-blue-800 dark:text-blue-300">
              This will generate {summary?.assigned_students ?? 0} personalized examination documents
              using template {activeTemplate?.original_filename} v{activeTemplate?.version}.
            </p>
            <div className="mt-4 flex gap-3">
              <Button variant="primary" onClick={handleGenerate} disabled={generating} loading={generating}>
                <CheckCircle className="h-4 w-4" />
                Generate
              </Button>
              <Button variant="secondary" onClick={() => setShowConfirm(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Documents Table */}
      <Card>
        <CardContent>
          <h2 className="text-lg font-medium text-black dark:text-white">Documents ({totalGenerated})</h2>
          <div className="mt-3 flex items-center gap-3">
            <Input type="text" placeholder="Search student # or name..." value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchData()}
              className="flex-1" />
            <Button variant="primary" size="sm" onClick={() => fetchData()}>Search</Button>
          </div>
          {generated.length === 0 ? (
            <EmptyState
              icon={<FileText className="h-6 w-6 text-zinc-400" />}
              title="No generated documents yet"
              description="Generate personalized exams to see them here."
            />
          ) : (
            <>
              <Table className="mt-4">
                <TableHead>
                  <Th>Student #</Th>
                  <Th>Name</Th>
                  <Th>File</Th>
                  <Th>Size</Th>
                  <Th>Template</Th>
                  <Th>Status</Th>
                  <Th>Date</Th>
                  <Th className="text-right">Actions</Th>
                </TableHead>
                <TableBody>
                  {generated.map((g) => (
                    <tr key={g.id}>
                      <Td>{g.student_number}</Td>
                      <Td>{g.full_name}</Td>
                      <Td className="text-xs text-zinc-500">{g.file_name}</Td>
                      <Td className="text-xs text-zinc-500">{(g.file_size / 1024).toFixed(0)} KB</Td>
                      <Td className="text-xs text-zinc-500">v{g.template_version}</Td>
                      <Td>
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${g.status === "GENERATED" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}>
                          {g.status}
                        </span>
                      </Td>
                      <Td className="text-xs text-zinc-500">{g.created_at ? new Date(g.created_at).toLocaleDateString() : ""}</Td>
                      <Td className="text-right">
                        <a href={getGeneratedExamDownloadUrl(examId, g.id)} target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" size="sm">
                            <Download className="h-3.5 w-3.5" />
                            Download
                          </Button>
                        </a>
                      </Td>
                    </tr>
                  ))}
                </TableBody>
              </Table>
              {totalGenerated > 50 && (
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-zinc-500">Page {page} of {Math.ceil(totalGenerated / 50)}</span>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                      Prev
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setPage(p => p + 1)} disabled={page * 50 >= totalGenerated}>
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
