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
    setLoading(true);
    Promise.all([
      getExam(examId),
      getAssignmentSummary(examId).catch(() => null),
      listTemplates(examId).catch(() => []),
      listGeneratedExams(examId, { page, page_size: 50, query: searchQuery || undefined }),
    ]).then(([e, s, t, g]) => {
      setExam(e);
      setSummary(s);
      setTemplates(t);
      setGenerated(g.exams);
      setTotalGenerated(g.total);
    }).catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, [examId, page, searchQuery]);

  useEffect(() => { fetchData(); }, [fetchData]);

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

  if (loading && !exam) return <div className="text-zinc-600 dark:text-zinc-400">Loading...</div>;

  return (
    <div className="space-y-6">
      <Link href={`/app/exams/${examId}`} className="text-sm text-zinc-500 hover:text-black dark:text-zinc-500 dark:hover:text-white">← Back to Exam</Link>

      <div>
        <h1 className="text-2xl font-bold text-black dark:text-white">Generated Documents</h1>
        {exam && <p className="text-sm text-zinc-500">{exam.course_code} — {exam.exam_name}</p>}
      </div>

      {error && <div className="rounded-md bg-red-50 p-4 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-400">{error}</div>}

      {/* Generation Panel */}
      {canEdit && (
        <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-lg font-medium text-black dark:text-white">Generate Personalized Exams</h2>
          <div className="mt-3 grid grid-cols-4 gap-4 text-sm">
            <div><span className="text-zinc-500">Template:</span> <span className="font-medium">{activeTemplate ? `v${activeTemplate.version}` : "None"}</span></div>
            <div><span className="text-zinc-500">Students:</span> <span className="font-medium">{summary?.registered_students ?? 0}</span></div>
            <div><span className="text-zinc-500">Assigned:</span> <span className="font-medium">{summary?.assigned_students ?? 0}</span></div>
            <div><span className="text-zinc-500">Generated:</span> <span className="font-medium">{totalGenerated}</span></div>
          </div>

          {!activeTemplate && (
            <p className="mt-3 text-sm text-amber-600 dark:text-amber-400">Upload a Crowdmark template first.</p>
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
            <div className="mt-3 rounded-md bg-green-50 p-3 text-sm dark:bg-green-900/20">
              <p className="text-green-800 dark:text-green-300">
                Generated: {genResult.generated} · Failed: {genResult.failed}
              </p>
            </div>
          )}

          <div className="mt-4 flex gap-3">
            <button onClick={handleValidate} disabled={generating || !activeTemplate}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300">
              {generating ? "Generating..." : "Validate & Preview"}
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      {showConfirm && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-6 shadow-sm dark:border-blue-800 dark:bg-blue-900/20">
          <h2 className="text-lg font-medium text-blue-900 dark:text-blue-100">Confirm Generation</h2>
          <p className="mt-2 text-sm text-blue-800 dark:text-blue-300">
            This will generate {summary?.assigned_students ?? 0} personalized examination documents
            using template {activeTemplate?.original_filename} v{activeTemplate?.version}.
          </p>
          <div className="mt-4 flex gap-3">
            <button onClick={handleGenerate} disabled={generating}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {generating ? "Generating..." : "Generate"}
            </button>
            <button onClick={() => setShowConfirm(false)}
              className="rounded-md border border-blue-300 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:text-blue-300">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Documents Table */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-lg font-medium text-black dark:text-white">Documents ({totalGenerated})</h2>
        <div className="mt-3 flex items-center gap-3">
          <input type="text" placeholder="Search student # or name..." value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchData()}
            className="flex-1 rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
          <button onClick={() => fetchData()} className="rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-black">Search</button>
        </div>
        {generated.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">No generated documents yet.</p>
        ) : (
          <>
            <table className="mt-4 w-full text-sm">
              <thead>
                <tr className="border-b dark:border-zinc-700">
                  <th className="py-2 text-left text-xs font-medium text-zinc-500">Student #</th>
                  <th className="py-2 text-left text-xs font-medium text-zinc-500">Name</th>
                  <th className="py-2 text-left text-xs font-medium text-zinc-500">File</th>
                  <th className="py-2 text-left text-xs font-medium text-zinc-500">Size</th>
                  <th className="py-2 text-left text-xs font-medium text-zinc-500">Template</th>
                  <th className="py-2 text-left text-xs font-medium text-zinc-500">Status</th>
                  <th className="py-2 text-left text-xs font-medium text-zinc-500">Date</th>
                  <th className="py-2 text-right text-xs font-medium text-zinc-500"></th>
                </tr>
              </thead>
              <tbody>
                {generated.map((g) => (
                  <tr key={g.id} className="border-b dark:border-zinc-800/50">
                    <td className="py-2">{g.student_number}</td>
                    <td className="py-2">{g.full_name}</td>
                    <td className="py-2 text-xs text-zinc-500">{g.file_name}</td>
                    <td className="py-2 text-xs text-zinc-500">{(g.file_size / 1024).toFixed(0)} KB</td>
                    <td className="py-2 text-xs text-zinc-500">v{g.template_version}</td>
                    <td className="py-2">
                      <span className={`inline-block rounded px-1.5 py-0.5 text-xs ${g.status === "GENERATED" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700"}`}>
                        {g.status}
                      </span>
                    </td>
                    <td className="py-2 text-xs text-zinc-500">{g.created_at ? new Date(g.created_at).toLocaleDateString() : ""}</td>
                    <td className="py-2 text-right">
                      <a href={getGeneratedExamDownloadUrl(g.id)} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400">Download</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {totalGenerated > 50 && (
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-zinc-500">Page {page} of {Math.ceil(totalGenerated / 50)}</span>
                <div className="flex gap-2">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="rounded border border-zinc-300 px-2 py-1 text-xs disabled:opacity-50 dark:border-zinc-700">Prev</button>
                  <button onClick={() => setPage(p => p + 1)} disabled={page * 50 >= totalGenerated}
                    className="rounded border border-zinc-300 px-2 py-1 text-xs disabled:opacity-50 dark:border-zinc-700">Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
