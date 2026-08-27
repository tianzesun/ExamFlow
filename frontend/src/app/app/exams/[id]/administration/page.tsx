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
import { Card, CardContent } from "@/components/card";
import { Button } from "@/components/button";
import { Table, TableHead, TableBody, Th, Td } from "@/components/table";
import { PageLoader } from "@/components/spinner";
import {
  CheckCircle, XCircle, AlertCircle, AlertTriangle,
  Download, FileText, ClipboardCheck,
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

  return (
    <div className="space-y-6">
      <Link href={`/app/exams/${examId}`} className="text-sm text-zinc-500 hover:text-black dark:text-zinc-500 dark:hover:text-white">← Back to Exam</Link>

      <div>
        <h1 className="text-2xl font-bold text-black dark:text-white flex items-center gap-2">
          <ClipboardCheck className="h-6 w-6 text-zinc-400" />
          Exam Administration
        </h1>
        {exam && <p className="text-sm text-zinc-500">{exam.course_code} — {exam.exam_name}</p>}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md bg-red-50 p-4 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-400">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Status Overview */}
      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardContent>
            <h2 className="text-lg font-medium text-black dark:text-white">Readiness Checklist</h2>
            <div className="mt-3 space-y-2">
              {checks.map((check: CheckResult) => (
                <div key={check.name} className="flex items-center gap-2 text-sm">
                  {check.status === "PASS" ? (
                    <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                  ) : check.status === "FAIL" ? (
                    <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                  )}
                  <span className={check.status === "PASS" ? "text-black dark:text-white" : "text-zinc-500"}>
                    {CHECK_LABELS[check.name] || check.name}
                  </span>
                  <span className="text-xs text-zinc-400 ml-auto">{check.message}</span>
                </div>
              ))}
            </div>
            {allReady && (
              <div className="mt-3 flex items-center gap-2 text-sm font-medium text-green-600 dark:text-green-400">
                <CheckCircle className="h-4 w-4" />
                Ready for administration
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <h2 className="text-lg font-medium text-black dark:text-white">Summary</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-zinc-500">Template</dt><dd className="font-medium">{checks.find(c => c.name === "template")?.message || "None"}</dd></div>
              <div className="flex justify-between"><dt className="text-zinc-500">Students</dt><dd className="font-medium">{checks.find(c => c.name === "roster")?.count ?? 0} registered</dd></div>
              <div className="flex justify-between"><dt className="text-zinc-500">Assigned</dt><dd className="font-medium">{checks.find(c => c.name === "seating")?.count ?? 0} / {checks.find(c => c.name === "seating")?.required ?? 0}</dd></div>
              <div className="flex justify-between"><dt className="text-zinc-500">Rooms</dt><dd className="font-medium">{examRooms.length}</dd></div>
              <div className="flex justify-between"><dt className="text-zinc-500">Personalized Exams</dt><dd className="font-medium">{generatedCount}</dd></div>
              <div className="flex justify-between"><dt className="text-zinc-500">QR Codes</dt><dd className="font-medium">{qrCount}</dd></div>
            </dl>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      {canEdit && (
        <Card>
          <CardContent>
            <h2 className="text-lg font-medium text-black dark:text-white">Actions</h2>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button variant="secondary" onClick={handleGenerateQr} disabled={generatingQr || generatedCount === 0} loading={generatingQr}>
                Generate QR Codes ({generatedCount - qrCount} pending)
              </Button>
              <Button variant="primary" onClick={() => setShowConfirm(true)} disabled={generatingPkg || !allReady || generatedCount === 0} loading={generatingPkg}>
                Generate Exam Package
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Confirmation */}
      {showConfirm && (
        <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20">
          <CardContent>
            <h2 className="text-lg font-medium text-blue-900 dark:text-blue-100 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Confirm Package Generation
            </h2>
            <p className="mt-2 text-sm text-blue-800 dark:text-blue-300">
              This will generate the official exam administration package containing personalized exams,
              signature lists, and seating maps for {checks.find(c => c.name === "roster")?.count ?? 0} students across {examRooms.length} rooms.
            </p>
            <div className="mt-4 flex gap-3">
              <Button variant="primary" onClick={handleGeneratePackage} disabled={generatingPkg} loading={generatingPkg}>
                Generate Package
              </Button>
              <Button variant="secondary" onClick={() => setShowConfirm(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Package Ready */}
      {packageInfo && (
        <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20">
          <CardContent>
            <h2 className="text-lg font-medium text-green-900 dark:text-green-100 flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Package Ready
            </h2>
            <p className="mt-2 text-sm text-green-800 dark:text-green-300">
              {packageInfo.filename} ({(packageInfo.size / 1024 / 1024).toFixed(1)} MB)
            </p>
            <a href={getPackageDownloadUrl(examId)} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block">
              <Button variant="primary">
                <Download className="h-4 w-4" />
                Download Package
              </Button>
            </a>
          </CardContent>
        </Card>
      )}

      {/* Room Artifacts */}
      {examRooms.length > 0 && (
        <Card>
          <CardContent>
            <h2 className="text-lg font-medium text-black dark:text-white flex items-center gap-2">
              <FileText className="h-5 w-5 text-zinc-400" />
              Room Documents
            </h2>
            <Table className="mt-3">
              <TableHead>
                <Th>Room</Th>
                <Th>Signature List</Th>
                <Th>Seating Map</Th>
              </TableHead>
              <TableBody>
                {examRooms.map((r) => (
                  <tr key={r.id}>
                    <Td className="font-medium">{r.building} {r.room_number}</Td>
                    <Td>
                      <a href={getSignatureListUrl(examId, r.id)} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="sm">
                          <Download className="h-3.5 w-3.5" />
                          Download PDF
                        </Button>
                      </a>
                    </Td>
                    <Td>
                      <a href={getSeatingMapUrl(examId, r.id)} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="sm">
                          <Download className="h-3.5 w-3.5" />
                          Download PDF
                        </Button>
                      </a>
                    </Td>
                  </tr>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
