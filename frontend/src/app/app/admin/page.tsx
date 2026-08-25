"use client";

import { useAuth } from "@/lib/auth/context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/card";
import { PageLoader } from "@/components/spinner";
import { ShieldCheck, AlertCircle, CheckCircle } from "lucide-react";

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
      fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/admin/test`, {
        credentials: "include",
      })
        .then((res) => {
          if (!res.ok) throw new Error("Failed to access admin endpoint");
          return res.json();
        })
        .then((data) => setAdminTest(data.message))
        .catch((err) => setError(err.message));
    }
  }, [user]);

  if (!user || user.role !== "ADMIN") {
    return null;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-black dark:text-white flex items-center gap-2">
        <ShieldCheck className="h-6 w-6 text-zinc-400" />
        Admin Area
      </h1>

      <Card>
        <CardContent>
          <h2 className="text-lg font-medium text-black dark:text-white">
            Admin Test Endpoint
          </h2>
          {error ? (
            <div className="mt-2 flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          ) : adminTest ? (
            <div className="mt-2 flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
              <CheckCircle className="h-4 w-4" />
              {adminTest}
            </div>
          ) : (
            <PageLoader />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
