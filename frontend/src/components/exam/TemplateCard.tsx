"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Download, FileText, Upload } from "lucide-react";
import {
  uploadTemplate, listTemplates, getTemplateDownloadUrl,
  activateTemplate, archiveTemplate, ExamTemplate,
} from "@/lib/api/templates";
import { errorReference } from "@/lib/api/client";
import { Card, CardHeader } from "@/components/card";
import { Badge } from "@/components/badge";
import { Button } from "@/components/button";
import { DownloadButton } from "@/components/download-button";
import { Input } from "@/components/input";
import { Table, TableHead, TableBody, Th, Td } from "@/components/table";
import { formatDate } from "@/lib/format";
import { notifyExamChanged } from "./workspace";

const formatMb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/** The Crowdmark PDF that personalized papers are generated from. */
export function TemplateCard({
  examId,
  canEdit,
  onChange,
}: {
  examId: string;
  canEdit: boolean;
  onChange?: (templates: ExamTemplate[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [templates, setTemplates] = useState<ExamTemplate[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [crowdmarkId, setCrowdmarkId] = useState("");
  const [crowdmarkUrl, setCrowdmarkUrl] = useState("");

  const load = useCallback(async () => {
    const t = await listTemplates(examId).catch(() => [] as ExamTemplate[]);
    setTemplates(t);
    onChange?.(t);
  }, [examId, onChange]);

  useEffect(() => {
    let cancelled = false;
    listTemplates(examId)
      .catch(() => [] as ExamTemplate[])
      .then((t) => {
        if (cancelled) return;
        setTemplates(t);
        onChange?.(t);
      });
    return () => { cancelled = true; };
  }, [examId, onChange]);

  const changed = async () => {
    await load();
    notifyExamChanged();
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      await uploadTemplate(examId, file, crowdmarkId || undefined, crowdmarkUrl || undefined);
      setCrowdmarkId("");
      setCrowdmarkUrl("");
      await changed();
    } catch (err) {
      setError(`The PDF could not be uploaded. Check that it is a valid PDF and try again.${errorReference(err)}`);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleActivate = async (templateId: string) => {
    try {
      await activateTemplate(examId, templateId);
      await changed();
    } catch (err) {
      setError(`That version could not be activated.${errorReference(err)}`);
    }
  };

  const handleArchive = async (templateId: string) => {
    if (!confirm("Archive this template?")) return;
    try {
      await archiveTemplate(examId, templateId);
      await changed();
    } catch (err) {
      setError(`That version could not be archived.${errorReference(err)}`);
    }
  };

  const active = templates.find((t) => t.is_active);

  return (
    <Card>
      <CardHeader className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">A · Exam template</h2>
          <p className="text-xs text-ink-3">The Crowdmark PDF each student&rsquo;s paper is generated from</p>
        </div>
        {active ? <Badge variant="success">Uploaded</Badge> : <Badge variant="warning">Needed</Badge>}
      </CardHeader>
      <div className="space-y-5 px-5 py-4">
        {error && (
          <div role="alert" className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {active ? (
          <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface-2 p-3.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success">
                <CheckCircle2 className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{active.original_filename}</p>
                <p className="tnum mt-0.5 text-xs text-ink-3">
                  Version {active.version} · {formatMb(active.file_size)}
                  {active.crowdmark_exam_id && <> · Crowdmark ID <span className="font-mono">{active.crowdmark_exam_id}</span></>}
                  {active.created_at && <> · Uploaded {formatDate(active.created_at)}</>}
                </p>
              </div>
            </div>
            <DownloadButton url={getTemplateDownloadUrl(examId, active.id)} filename="exam-paper.pdf" variant="secondary" size="sm">
                <Download className="h-3.5 w-3.5" /> Download
              </DownloadButton>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-lg border border-dashed border-line-strong px-4 py-3.5 text-sm text-ink-2">
            <FileText className="h-4 w-4 shrink-0 text-ink-3" />
            No template yet. Export the exam PDF from Crowdmark and upload it here.
          </div>
        )}

        {canEdit && (
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">
              {active ? "Replace with a new version" : "Upload the PDF"}
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input type="text" placeholder="Crowdmark exam ID (optional)" value={crowdmarkId}
                onChange={(e) => setCrowdmarkId(e.target.value)} aria-label="Crowdmark exam ID" />
              <Input type="text" placeholder="Crowdmark URL (optional)" value={crowdmarkUrl}
                onChange={(e) => setCrowdmarkUrl(e.target.value)} aria-label="Crowdmark URL" />
            </div>
            <div className="flex items-center justify-end gap-3">
              <span className="text-xs text-ink-3">PDF only</span>
              <input ref={inputRef} type="file" accept=".pdf" onChange={handleUpload} className="sr-only" tabIndex={-1} aria-hidden />
              <Button size="sm" variant={active ? "secondary" : "primary"} onClick={() => inputRef.current?.click()} loading={uploading}>
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
                        <DownloadButton url={getTemplateDownloadUrl(examId, t.id)} filename="exam-paper.pdf" variant="ghost" size="sm">Download</DownloadButton>
                        {!t.is_active && (
                          <Button variant="ghost" size="sm" className="text-accent hover:text-accent-strong" onClick={() => handleActivate(t.id)}>
                            Activate
                          </Button>
                        )}
                        {t.is_active && templates.filter((tt) => tt.is_active).length > 1 && (
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
  );
}
