"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, FileText, ShieldAlert } from "lucide-react";
import { API_BASE } from "@/lib/api/client";
import { formatDateLong } from "@/lib/format";
import { Spinner } from "@/components";

interface VerifyResult {
  valid: boolean;
  message: string;
  course_code?: string | null;
  exam_name?: string | null;
  exam_date?: string | null;
  generation_version?: number;
}

/** Public page opened by scanning the QR code printed on an exam paper. */
export default function VerifyPaperPage() {
  const { token } = useParams<{ token: string }>();
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/verify/${encodeURIComponent(token)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then(setResult)
      .catch(() => setFailed(true));
  }, [token]);

  return (
    <main className="app-canvas flex items-center justify-center px-4 py-10" style={{ minHeight: "100vh" }}>
      <div className="surface-card accent-top w-full max-w-md px-6 py-8 text-center animate-rise">
        <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-grad-primary text-white">
          <FileText className="h-5 w-5" />
        </span>
        <p className="eyebrow mt-4">ExamFlow paper check</p>

        {!result && !failed && (
          <div className="mt-8 flex justify-center"><Spinner className="h-6 w-6 text-ink-3" /></div>
        )}

        {failed && (
          <p className="mt-6 text-sm text-ink-2">We couldn&rsquo;t check this paper right now. Try scanning again in a moment.</p>
        )}

        {result?.valid && (
          <>
            <CheckCircle2 className="mx-auto mt-6 h-12 w-12 text-success" />
            <h1 className="mt-3 text-xl font-semibold text-ink">Genuine exam paper</h1>
            <p className="mt-1 text-sm text-ink-2">This is the current copy issued for this sitting.</p>
            <dl className="mt-6 space-y-2 rounded-xl bg-surface-2 px-4 py-3 text-left text-sm">
              <div className="flex justify-between gap-4"><dt className="text-ink-3">Course</dt><dd className="font-medium text-ink">{result.course_code}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-ink-3">Exam</dt><dd className="truncate font-medium text-ink">{result.exam_name}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-ink-3">Date</dt><dd className="font-medium text-ink">{formatDateLong(result.exam_date)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-ink-3">Version</dt><dd className="tnum font-medium text-ink">{result.generation_version}</dd></div>
            </dl>
          </>
        )}

        {result && !result.valid && (
          <>
            <ShieldAlert className="mx-auto mt-6 h-12 w-12 text-danger" />
            <h1 className="mt-3 text-xl font-semibold text-ink">Not a current paper</h1>
            <p className="mt-1 text-sm text-ink-2">
              {result.message === "Invalid token"
                ? "This code doesn't match any paper issued by ExamFlow."
                : result.message === "This paper has been replaced by a newer version"
                ? "This copy was replaced by a newer version. Ask the exam office for the current paper."
                : `${result.message}.`}
            </p>
          </>
        )}
      </div>
    </main>
  );
}
