"use client";

import { useEffect, useState, useRef } from "react";
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
import { Card, CardContent } from "@/components/card";
import { Badge, STATUS_BADGES } from "@/components/badge";
import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { Table, TableHead, TableBody, Th, Td } from "@/components/table";
import { PageLoader } from "@/components/spinner";
import { Calendar, Clock, FileText, Download, Upload, ArrowLeft } from "lucide-react";

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

  const fetchData = () => {
    Promise.all([
      getExam(examId),
      getAssignmentSummary(examId).catch(() => null),
      listTemplates(examId).catch(() => []),
    ]).then(([e, s, t]) => {
      setExam(e);
      setSummary(s);
      setTemplates(t);
    }).catch((err) => setError(err.message)).finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [examId]);

  const handleStatusChange = async (newStatus: string) => {
    if (!exam) return;
    setUpdating(true);
    try {
      const updated = await updateExam(exam.id, { status: newStatus });
      setExam(updated);
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
  if (error) return <div className="rounded-md bg-red-50 p-4 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-400">{error}</div>;
  if (!exam) return <div className="text-zinc-600 dark:text-zinc-400">Exam not found.</div>;

  const transitions = VALID_TRANSITIONS[exam.status] || [];
  const activeTemplate = templates.find(t => t.is_active);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-black dark:text-white">{exam.exam_name}</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-500">
            {exam.course_code} — {exam.term} {exam.academic_year}
          </p>
        </div>
        <Badge variant={STATUS_BADGES[exam.status] || "default"}>
          {exam.status}
        </Badge>
      </div>

      <div className="flex gap-3">
        <Link href={`/app/exams/${exam.id}/roster`}>
          <Button variant="primary">Manage Roster</Button>
        </Link>
        <Link href={`/app/exams/${exam.id}/seating`}>
          <Button variant="secondary">Seating</Button>
        </Link>
        <Link href={`/app/exams/${exam.id}/documents`}>
          <Button variant="secondary">Documents</Button>
        </Link>
        <Link href={`/app/exams/${exam.id}/administration`}>
          <Button variant="secondary">Administration</Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardContent>
            <h2 className="text-lg font-medium text-black dark:text-white">Exam Details</h2>
            <dl className="mt-4 space-y-3">
              <div><dt className="text-sm text-zinc-500">Course</dt><dd className="text-sm font-medium text-black dark:text-white">{exam.course_code} — {exam.course_name}</dd></div>
              <div className="flex items-center gap-2"><dt className="text-sm text-zinc-500">Date</dt><dd className="text-sm font-medium text-black dark:text-white flex items-center gap-1"><Calendar className="h-3.5 w-3.5 text-zinc-400" />{exam.exam_date}</dd></div>
              <div className="flex items-center gap-2"><dt className="text-sm text-zinc-500">Time</dt><dd className="text-sm font-medium text-black dark:text-white flex items-center gap-1"><Clock className="h-3.5 w-3.5 text-zinc-400" />{exam.start_time}</dd></div>
              <div><dt className="text-sm text-zinc-500">Duration</dt><dd className="text-sm font-medium text-black dark:text-white">{exam.duration_minutes} min</dd></div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <h2 className="text-lg font-medium text-black dark:text-white">Status</h2>
            <dl className="mt-4 space-y-3">
              <div><dt className="text-sm text-zinc-500">Created</dt><dd className="text-sm font-medium text-black dark:text-white">{new Date(exam.created_at).toLocaleDateString()}</dd></div>
              <div><dt className="text-sm text-zinc-500">Updated</dt><dd className="text-sm font-medium text-black dark:text-white">{new Date(exam.updated_at).toLocaleDateString()}</dd></div>
            </dl>
            {canEdit && transitions.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Change Status</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {transitions.map((s) => (
                    <Button key={s} variant="ghost" size="sm" onClick={() => handleStatusChange(s)} disabled={updating}>
                      {s}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Exam Template Section */}
      <Card>
        <CardContent>
          <h2 className="text-lg font-medium text-black dark:text-white flex items-center gap-2">
            <FileText className="h-5 w-5 text-zinc-400" />
            Exam Template (Crowdmark)
          </h2>
          {activeTemplate ? (
            <div className="mt-3 rounded-md border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-800 dark:text-green-300">
                    {activeTemplate.original_filename}
                  </p>
                  <p className="mt-1 text-xs text-green-600 dark:text-green-400">
                    Version {activeTemplate.version} · {(activeTemplate.file_size / 1024 / 1024).toFixed(1)} MB · Active
                    {activeTemplate.crowdmark_exam_id && <span> · Crowdmark ID: {activeTemplate.crowdmark_exam_id}</span>}
                  </p>
                </div>
                <div className="flex gap-2">
                  <a href={getTemplateDownloadUrl(examId, activeTemplate.id)} target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="sm">
                      <Download className="h-3.5 w-3.5" />
                      Download
                    </Button>
                  </a>
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-sm text-zinc-500">No active template uploaded.</p>
          )}

          {/* Upload form */}
          {canEdit && (
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-3">
                <input ref={templateInputRef} type="file" accept=".pdf" onChange={handleTemplateUpload} className="text-sm" />
                {uploading && <span className="text-sm text-zinc-500">Uploading...</span>}
              </div>
              <div className="flex gap-3">
                <Input type="text" placeholder="Crowdmark Exam ID (optional)" value={crowdmarkId}
                  onChange={(e) => setCrowdmarkId(e.target.value)} />
                <Input type="text" placeholder="Crowdmark URL (optional)" value={crowdmarkUrl}
                  onChange={(e) => setCrowdmarkUrl(e.target.value)} className="flex-1" />
              </div>
            </div>
          )}

          {/* Version history */}
          {templates.length > 1 && (
            <div className="mt-4">
              <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Version History</h3>
              <Table className="mt-2">
                <TableHead>
                  <Th>Version</Th>
                  <Th>File</Th>
                  <Th>Size</Th>
                  <Th>Status</Th>
                  <Th>Date</Th>
                  {canEdit && <Th className="text-right">Actions</Th>}
                </TableHead>
                <TableBody>
                  {templates.map((t) => (
                    <tr key={t.id}>
                      <Td>v{t.version}</Td>
                      <Td>{t.original_filename}</Td>
                      <Td>{(t.file_size / 1024 / 1024).toFixed(1)} MB</Td>
                      <Td>
                        <Badge variant={t.is_active ? "success" : "default"}>
                          {t.is_active ? "Active" : "Archived"}
                        </Badge>
                      </Td>
                      <Td className="text-xs text-zinc-500">{t.created_at ? new Date(t.created_at).toLocaleDateString() : ""}</Td>
                      {canEdit && (
                        <Td className="text-right">
                          <div className="flex justify-end gap-2">
                            <a href={getTemplateDownloadUrl(examId, t.id)} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-zinc-500 hover:text-black dark:text-zinc-400">Download</a>
                            {!t.is_active && (
                              <button onClick={() => handleActivate(t.id)} className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400">Activate</button>
                            )}
                            {t.is_active && templates.filter(tt => tt.is_active).length > 1 && (
                              <button onClick={() => handleArchive(t.id)} className="text-xs text-red-600 hover:text-red-800 dark:text-red-400">Archive</button>
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
        </CardContent>
      </Card>

      {/* Seating Summary */}
      <Card>
        <CardContent>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-black dark:text-white">Seating Assignment</h2>
            <Link href={`/app/exams/${exam.id}/seating`} className="text-sm text-zinc-500 hover:text-black dark:text-zinc-500 dark:hover:text-white">
              {summary && summary.assigned_students > 0 ? "View Details →" : "Configure →"}
            </Link>
          </div>
          {summary ? (
            <div className="mt-3 grid grid-cols-4 gap-4 text-sm">
              <div><span className="text-zinc-500">Registered:</span> <span className="font-medium">{summary.registered_students}</span></div>
              <div><span className="text-zinc-500">Assigned:</span> <span className="font-medium">{summary.assigned_students}</span></div>
              <div><span className="text-zinc-500">Seats:</span> <span className="font-medium">{summary.available_seats}</span></div>
              <div><span className="text-zinc-500">Unused:</span> <span className="font-medium">{summary.unused_seats}</span></div>
            </div>
          ) : (
            <p className="mt-2 text-sm text-zinc-500">Loading summary...</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
