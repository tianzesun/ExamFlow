"use client";

import { useAuth } from "@/lib/auth/context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchApi } from "@/lib/api/client";
import { Badge, PageContainer, PageHeader, Skeleton } from "@/components";
import { ShieldCheck, AlertCircle, CheckCircle2 } from "lucide-react";

export default function AdminPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [adminTest, setAdminTest] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user && user.role !== "ADMIN") {
      router.push("/app");
    }
  }, [user, router]);

  useEffect(() => {
    if (user?.role === "ADMIN") {
      fetchApi<{ message: string }>("/api/admin/test")
        .then((data) => setAdminTest(data.message))
        .catch((err) => setError(err.message));
    }
  }, [user]);

  if (!user || user.role !== "ADMIN") {
    return null;
  }

  const status = error ? "error" : adminTest ? "ok" : "loading";

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Admin area"
        description="System checks available to administrators."
        meta={<Badge variant="violet"><ShieldCheck className="h-3 w-3" /> Admin only</Badge>}
      />

      <section className="surface-card max-w-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-ink">Admin test endpoint</h2>
            <p className="mt-0.5 text-xs text-ink-3">
              Verifies that admin-only API routes accept your session.
            </p>
          </div>
          {status === "ok" && <Badge variant="success">Passing</Badge>}
          {status === "error" && <Badge variant="danger">Failing</Badge>}
          {status === "loading" && <Badge>Checking…</Badge>}
        </div>
        <div className="px-5 py-4">
          <p className="eyebrow mb-1.5">Response</p>
          {status === "error" ? (
            <div className="flex items-center gap-2 text-sm text-danger">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          ) : status === "ok" ? (
            <div className="flex items-center gap-2 text-sm text-ink">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
              <span className="font-mono text-xs">{adminTest}</span>
            </div>
          ) : (
            <Skeleton className="h-5 w-64" />
          )}
          <p className="mt-3 font-mono text-[11px] text-ink-3">GET /api/admin/test</p>
        </div>
      </section>
    </PageContainer>
  );
}
