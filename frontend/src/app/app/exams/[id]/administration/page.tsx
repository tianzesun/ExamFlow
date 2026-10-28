"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getExam } from "@/lib/api/exams";
import { getReadiness, ReadinessResult, CheckResult } from "@/lib/api/readiness";
import { getExamRooms } from "@/lib/api/assignments";
import {
  generateQr, generatePackage, getPackageDownloadUrl,
  getSignatureListUrl, getSeatingMapUrl,
} from "@/lib/api/administration";
import { Exam } from "@/lib/types";
import { useAuth } from "@/lib/auth/context";
import { Card, CardHeader } from "@/components/card";
import { Badge } from "@/components/badge";
import { EmptyState } from "@/components/empty-state";
import { formatNumber, plural } from "@/lib/format";
import { Button } from "@/components/button";
import { Table, TableHead, TableBody, Th, Td } from "@/components/table";
import { PageLoader } from "@/components/spinner";
import {
  CheckCircle, XCircle, AlertCircle, AlertTriangle,
  Download, FileText, ClipboardCheck, DoorOpen, LayoutGrid, Package, QrCode,
} from "lucide-react";

const CHECK_LABELS: Record<string, string> = {
  roster: "Roster imported",
  rooms: "Rooms configured",
  seating: "Seating assigned",
  template: "Template active",
  documents: "Exams generated",
  qr: "QR codes ready",
};

export default function AdministrationPage() {
  const params = useParams();
  const { user } = useAuth();
  const examId = params.id as string;

  const [exam, setExam] = useState<Exam | null>(null);
  const [readiness, setReadiness] = useState<ReadinessResult | null>(null);
  const [examRooms, setExamRooms] = useState<{ id: string; building: string; room_number: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [generatingQr, setGeneratingQr] = useState(false);
  const [generatingPkg, setGeneratingPkg] = useState(false);
  const [packageInfo, setPackageInfo] = useState<{ filename: string; size: number } | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const canEdit = user?.role === "ADMIN" || user?.role === "STAFF";

  const fetchData = useCallback(() => {
    let cancelled = false;
    Promise.resolve()
      .then(() => {
        if (!cancelled) setLoading(true);
      })
      .then(async () => {
        if (cancelled) return null;
        const [e, r, rooms] = await Promise.all([
          getExam(examId),
          getReadiness(examId).catch(() => null),
          getExamRooms(examId).catch(() => []),
        ]);
        if (cancelled) return null;
        return { exam: e, readiness: r, rooms } as const;
      })
      .then((next) => {
        if (!cancelled && next) {
          setExam(next.exam);
          setReadiness(next.readiness);
          setExamRooms(next.rooms);
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

  const handleGenerateQr = async () => {
    setGeneratingQr(true);
    setError(null);
    try {
      await generateQr(examId);
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "QR generation failed");
    } finally {
      setGeneratingQr(false);
    }
  };

  const handleGeneratePackage = async () => {
    setGeneratingPkg(true);
    setShowConfirm(false);
    setError(null);
    try {
      const result = await generatePackage(examId);
      setPackageInfo(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Package generation failed");
    } finally {
      setGeneratingPkg(false);
    }
  };

  if (loading && !exam) return <PageLoader />;

  const checks = readiness?.checks || [];
  const allReady = readiness?.ready ?? false;
  const documentsCheck = checks.find(c => c.name === "documents");
  const generatedCount = documentsCheck?.count ?? 0;
  const qrCheck = checks.find(c => c.name === "qr");
  const qrCount = qrCheck?.count ?? 0;

  const rosterCount = checks.find(c => c.name === "roster")?.count ?? 0;
  const seatingCheck = checks.find(c => c.name === "seating");
  const passed = checks.filter(c => c.status === "PASS").length;
  const pendingQr = Math.max(0, generatedCount - qrCount);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-ink">Administration</h2>
          <p className="text-sm text-ink-2">Final checks, QR codes and the printable package for exam day.</p>
        </div>
        {canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={handleGenerateQr} disabled={generatingQr || generatedCount === 0} loading={generatingQr}>
              <QrCode className="h-4 w-4" /> Generate QR codes
              {pendingQr > 0 && <span className="tnum rounded bg-surface-hover px-1.5 text-[11px] text-ink-2">{formatNumber(pendingQr)}</span>}
            </Button>
            <Button onClick={() => setShowConfirm(true)} disabled={generatingPkg || !allReady || generatedCount === 0} loading={generatingPkg}>
              <Package className="h-4 w-4" /> Generate package
            </Button>
          </div>
        )}
      </div>

      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Confirmation */}
      {showConfirm && (
        <div role="alertdialog" className="surface-card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
              <AlertTriangle className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-ink">Generate the administration package?</h3>
              <p className="mt-0.5 text-sm text-ink-2">
                Includes personalized exams, signature lists and seating maps for {plural(rosterCount, "student")} across {plural(examRooms.length, "room")}.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowConfirm(false)}>Cancel</Button>
            <Button onClick={handleGeneratePackage} disabled={generatingPkg} loading={generatingPkg}>
              Generate package
            </Button>
          </div>
        </div>
      )}

      {/* Package ready */}
      {packageInfo && (
        <div className="surface-card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success">
              <CheckCircle className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-ink">Package ready</h3>
              <p className="mt-0.5 truncate text-sm text-ink-2">
                <span className="font-mono text-xs">{packageInfo.filename}</span> · {(packageInfo.size / 1024 / 1024).toFixed(1)} MB
              </p>
            </div>
          </div>
          <a href={getPackageDownloadUrl(examId)} target="_blank" rel="noopener noreferrer" className="shrink-0">
            <Button>
              <Download className="h-4 w-4" /> Download package
            </Button>
          </a>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Readiness */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-ink">Readiness checklist</h3>
              <p className="tnum text-xs text-ink-3">{passed} of {checks.length} checks passed</p>
            </div>
            {readiness && (
              <Badge variant={allReady ? "success" : "warning"}>
                {allReady ? "Ready for administration" : "Not ready"}
              </Badge>
            )}
          </CardHeader>
          {checks.length === 0 ? (
            <EmptyState
              icon={<ClipboardCheck className="h-5 w-5 text-ink-3" />}
              title="Readiness unavailable"
              description="Readiness checks could not be loaded right now."
            />
          ) : (
            <ul className="divide-y divide-line">
              {checks.map((check: CheckResult) => (
                <li key={check.name} className="flex items-center gap-3 px-5 py-3 text-sm">
                  {check.status === "PASS" ? (
                    <CheckCircle className="h-4 w-4 shrink-0 text-success" />
                  ) : check.status === "FAIL" ? (
                    <XCircle className="h-4 w-4 shrink-0 text-danger" />
                  ) : (
                    <AlertCircle className="h-4 w-4 shrink-0 text-warning" />
                  )}
                  <span className={check.status === "PASS" ? "font-medium text-ink" : "font-medium text-ink-2"}>
                    {CHECK_LABELS[check.name] || check.name}
                  </span>
                  <span className="ml-auto truncate text-right text-xs text-ink-3">{check.message}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Summary */}
        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold text-ink">Summary</h3>
            <p className="text-xs text-ink-3">What goes into the package</p>
          </CardHeader>
          <dl className="divide-y divide-line px-5 text-sm">
            {[
              ["Template", checks.find(c => c.name === "template")?.message || "None"],
              ["Students", `${formatNumber(rosterCount)} registered`],
              ["Seated", `${formatNumber(seatingCheck?.count ?? 0)} / ${formatNumber(seatingCheck?.required ?? 0)}`],
              ["Rooms", formatNumber(examRooms.length)],
              ["Personalized exams", formatNumber(generatedCount)],
              ["QR codes", formatNumber(qrCount)],
            ].map(([label, value]) => (
              <div key={label} className="flex items-baseline justify-between gap-4 py-2.5">
                <dt className="shrink-0 text-ink-3">{label}</dt>
                <dd className="tnum min-w-0 truncate text-right font-medium text-ink">{value}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>

      {/* Room documents */}
      <div className="surface-card overflow-hidden">
        <div className="border-b border-line px-5 py-3.5">
          <h3 className="text-sm font-semibold text-ink">Room documents</h3>
          <p className="text-xs text-ink-3">Signature lists and seating maps for proctors, per room</p>
        </div>
        {examRooms.length === 0 ? (
          <EmptyState
            icon={<DoorOpen className="h-5 w-5 text-ink-3" />}
            title="No rooms selected"
            description="Add rooms in seating to produce per-room documents."
            action={
              <Link href={`/app/exams/${examId}/seating`}>
                <Button>Open seating</Button>
              </Link>
            }
          />
        ) : (
          <Table>
            <TableHead>
              <Th>Room</Th>
              <Th className="text-right">Documents</Th>
            </TableHead>
            <TableBody>
              {examRooms.map((r) => (
                <tr key={r.id}>
                  <Td className="font-medium">
                    {r.building} <span className="font-mono text-xs text-ink-2">{r.room_number}</span>
                  </Td>
                  <Td className="py-1.5 text-right">
                    <div className="flex justify-end gap-1">
                      <a href={getSignatureListUrl(examId, r.id)} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="sm">
                          <FileText className="h-3.5 w-3.5" /> Signature list
                        </Button>
                      </a>
                      <a href={getSeatingMapUrl(examId, r.id)} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="sm">
                          <LayoutGrid className="h-3.5 w-3.5" /> Seating map
                        </Button>
                      </a>
                    </div>
                  </Td>
                </tr>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
