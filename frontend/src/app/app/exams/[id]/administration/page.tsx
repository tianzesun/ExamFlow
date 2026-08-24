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
    setLoading(true);
    Promise.all([
      getExam(examId),
      getReadiness(examId).catch(() => null),
      getExamRooms(examId).catch(() => []),
    ]).then(([e, r, rooms]) => {
      setExam(e);
      setReadiness(r);
      setExamRooms(rooms);
    }).catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, [examId]);

  useEffect(() => { fetchData(); }, [fetchData]);

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

  if (loading && !exam) return <div className="text-zinc-600 dark:text-zinc-400">Loading...</div>;

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
        <h1 className="text-2xl font-bold text-black dark:text-white">Exam Administration</h1>
        {exam && <p className="text-sm text-zinc-500">{exam.course_code} — {exam.exam_name}</p>}
      </div>

      {error && <div className="rounded-md bg-red-50 p-4 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-400">{error}</div>}

      {/* Status Overview */}
      <div className="grid grid-cols-2 gap-6">
        <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-lg font-medium text-black dark:text-white">Readiness Checklist</h2>
          <div className="mt-3 space-y-2">
            {checks.map((check: CheckResult) => (
              <div key={check.name} className="flex items-center gap-2 text-sm">
                <span className={
                  check.status === "PASS" ? "text-green-600 dark:text-green-400" :
                  check.status === "FAIL" ? "text-red-600 dark:text-red-400" :
                  "text-yellow-600 dark:text-yellow-400"
                }>
                  {check.status === "PASS" ? "✓" : check.status === "FAIL" ? "✗" : "○"}
                </span>
                <span className={check.status === "PASS" ? "text-black dark:text-white" : "text-zinc-500"}>
                  {CHECK_LABELS[check.name] || check.name}
                </span>
                <span className="text-xs text-zinc-400 ml-auto">{check.message}</span>
              </div>
            ))}
          </div>
          {allReady && (
            <p className="mt-3 text-sm font-medium text-green-600 dark:text-green-400">Ready for administration</p>
          )}
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-lg font-medium text-black dark:text-white">Summary</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-zinc-500">Template</dt><dd className="font-medium">{checks.find(c => c.name === "template")?.message || "None"}</dd></div>
            <div className="flex justify-between"><dt className="text-zinc-500">Students</dt><dd className="font-medium">{checks.find(c => c.name === "roster")?.count ?? 0} registered</dd></div>
            <div className="flex justify-between"><dt className="text-zinc-500">Assigned</dt><dd className="font-medium">{checks.find(c => c.name === "seating")?.count ?? 0} / {checks.find(c => c.name === "seating")?.required ?? 0}</dd></div>
            <div className="flex justify-between"><dt className="text-zinc-500">Rooms</dt><dd className="font-medium">{examRooms.length}</dd></div>
            <div className="flex justify-between"><dt className="text-zinc-500">Personalized Exams</dt><dd className="font-medium">{generatedCount}</dd></div>
            <div className="flex justify-between"><dt className="text-zinc-500">QR Codes</dt><dd className="font-medium">{qrCount}</dd></div>
          </dl>
        </div>
      </div>

      {/* Actions */}
      {canEdit && (
        <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-lg font-medium text-black dark:text-white">Actions</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            <button onClick={handleGenerateQr} disabled={generatingQr || generatedCount === 0}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300">
              {generatingQr ? "Generating QR..." : `Generate QR Codes (${generatedCount - qrCount} pending)`}
            </button>
            <button onClick={() => setShowConfirm(true)} disabled={generatingPkg || !allReady || generatedCount === 0}
              className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black">
              {generatingPkg ? "Generating..." : "Generate Exam Package"}
            </button>
          </div>
        </div>
      )}

      {/* Confirmation */}
      {showConfirm && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-6 shadow-sm dark:border-blue-800 dark:bg-blue-900/20">
          <h2 className="text-lg font-medium text-blue-900 dark:text-blue-100">Confirm Package Generation</h2>
          <p className="mt-2 text-sm text-blue-800 dark:text-blue-300">
            This will generate the official exam administration package containing personalized exams,
            signature lists, and seating maps for {checks.find(c => c.name === "roster")?.count ?? 0} students across {examRooms.length} rooms.
          </p>
          <div className="mt-4 flex gap-3">
            <button onClick={handleGeneratePackage} disabled={generatingPkg}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {generatingPkg ? "Generating..." : "Generate Package"}
            </button>
            <button onClick={() => setShowConfirm(false)}
              className="rounded-md border border-blue-300 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:text-blue-300">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Package Ready */}
      {packageInfo && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-6 shadow-sm dark:border-green-800 dark:bg-green-900/20">
          <h2 className="text-lg font-medium text-green-900 dark:text-green-100">Package Ready</h2>
          <p className="mt-2 text-sm text-green-800 dark:text-green-300">
            {packageInfo.filename} ({(packageInfo.size / 1024 / 1024).toFixed(1)} MB)
          </p>
          <a href={getPackageDownloadUrl(examId)} target="_blank" rel="noopener noreferrer"
            className="mt-3 inline-block rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700">
            Download Package
          </a>
        </div>
      )}

      {/* Room Artifacts */}
      {examRooms.length > 0 && (
        <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-lg font-medium text-black dark:text-white">Room Documents</h2>
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-b dark:border-zinc-700">
                <th className="py-2 text-left text-xs font-medium text-zinc-500">Room</th>
                <th className="py-2 text-left text-xs font-medium text-zinc-500">Signature List</th>
                <th className="py-2 text-left text-xs font-medium text-zinc-500">Seating Map</th>
              </tr>
            </thead>
            <tbody>
              {examRooms.map((r) => (
                <tr key={r.id} className="border-b dark:border-zinc-800/50">
                  <td className="py-2 font-medium">{r.building} {r.room_number}</td>
                  <td className="py-2">
                    <a href={getSignatureListUrl(examId, r.id)} target="_blank" rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400">Download PDF</a>
                  </td>
                  <td className="py-2">
                    <a href={getSeatingMapUrl(examId, r.id)} target="_blank" rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400">Download PDF</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
