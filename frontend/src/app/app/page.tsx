"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Calendar, BookOpen, DoorOpen, ArrowRight } from "lucide-react";
import { useAuth } from "@/lib/auth/context";
import { getExams } from "@/lib/api/exams";
import { Card, Badge, Button, PageLoader, STATUS_BADGES } from "@/components";

export default function AppPage() {
  const { user } = useAuth();
  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getExams({}, 1, 100)
      .then((data) => setExams(data.exams))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (!user) return null;

  const upcomingExams = exams
    .filter((e) => new Date(e.exam_date) >= new Date() && e.status !== "ARCHIVED")
    .sort((a, b) => new Date(a.exam_date).getTime() - new Date(b.exam_date).getTime())
    .slice(0, 5);

  const statusCounts = ["DRAFT", "READY", "GENERATED", "COMPLETED", "ARCHIVED"].map((s) => ({
    status: s,
    count: exams.filter((e) => e.status === s).length,
  }));

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-black dark:text-white">
          Welcome back, {user.display_name?.split(" ")[0]}
        </h1>
        <p className="text-sm text-zinc-500">
          {user.role} &middot; {exams.length} exam{exams.length !== 1 ? "s" : ""} total
        </p>
      </div>

      {/* Status Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {statusCounts.map(({ status, count }) => (
          <Card key={status} className="p-4">
            <p className={`text-2xl font-bold ${
              status === "DRAFT" ? "text-zinc-600 dark:text-zinc-400" :
              status === "READY" ? "text-green-600 dark:text-green-400" :
              status === "GENERATED" ? "text-purple-600 dark:text-purple-400" :
              status === "COMPLETED" ? "text-amber-600 dark:text-amber-400" :
              "text-zinc-500"
            }`}>{count}</p>
            <Badge variant={STATUS_BADGES[status]} className="mt-1">{status}</Badge>
          </Card>
        ))}
      </div>

      {/* Upcoming Exams */}
      <Card>
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <h2 className="text-lg font-semibold text-black dark:text-white">Upcoming Exams</h2>
          <Link href="/app/exams" className="flex items-center gap-1 text-sm text-zinc-500 hover:text-black dark:hover:text-white">
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="px-6 py-4">
          {upcomingExams.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-500">No upcoming exams.</p>
          ) : (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
              {upcomingExams.map((exam) => (
                <Link
                  key={exam.id}
                  href={`/app/exams/${exam.id}`}
                  className="flex items-center justify-between py-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/30 -mx-6 px-6"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
                      <BookOpen className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-black dark:text-white">
                        {exam.course_code} &mdash; {exam.exam_name}
                      </p>
                      <p className="text-xs text-zinc-500">{exam.term} {exam.academic_year}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 text-xs text-zinc-500">
                      <Calendar className="h-3 w-3" />
                      {exam.exam_date}
                    </div>
                    <Badge variant={STATUS_BADGES[exam.status]}>{exam.status}</Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Quick Actions */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { href: "/app/exams/new", icon: Plus, label: "Create Exam", desc: "Set up a new examination" },
          { href: "/app/rooms", icon: DoorOpen, label: "Manage Rooms", desc: "View and configure rooms" },
          { href: "/app/courses", icon: BookOpen, label: "Manage Courses", desc: "Add or edit courses" },
        ].map(({ href, icon: Icon, label, desc }) => (
          <Link key={href} href={href}>
            <Card className="group p-4 transition-colors hover:border-zinc-400 dark:hover:border-zinc-600">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 group-hover:bg-zinc-200 dark:bg-zinc-800 dark:group-hover:bg-zinc-700">
                  <Icon className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-black dark:text-white">{label}</p>
                  <p className="text-xs text-zinc-500">{desc}</p>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
