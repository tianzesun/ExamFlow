"use client";

import Link from "next/link";
import { Calendar, Clock, Users, MapPin, ArrowRight } from "lucide-react";
import { NumberTicker } from "@/components/ui/NumberTicker";

interface Exam {
  id: string;
  course_code: string;
  exam_name: string;
  term: string;
  academic_year: number;
  exam_date: string;
  start_time: string;
  duration_minutes: number;
  status: string;
  student_count?: number;
  assigned_count?: number;
  room_count?: number;
}

interface ExamCardProps {
  exam: Exam;
}

const STATUS_STYLES: Record<string, { dot: string; text: string }> = {
  DRAFT: { dot: "bg-ink-3", text: "text-ink-2" },
  CONFIGURED: { dot: "bg-accent", text: "text-accent" },
  READY: { dot: "bg-warning", text: "text-warning" },
  GENERATED: { dot: "bg-violet", text: "text-violet" },
  COMPLETED: { dot: "bg-success", text: "text-success" },
  ARCHIVED: { dot: "bg-ink-3", text: "text-ink-3" },
};

export function ExamCard({ exam }: ExamCardProps) {
  const status = STATUS_STYLES[exam.status] || STATUS_STYLES.DRAFT;
  const progress = exam.student_count
    ? Math.round(((exam.assigned_count ?? 0) / exam.student_count) * 100)
    : 0;

  return (
    <Link href={`/app/exams/${exam.id}`} className="block h-full">
      <div
        className={`relative overflow-hidden rounded-lg border bg-surface p-4 transition-all duration-200 group hover:translate-y-[-2px] hover:shadow-md border-line`}
      >
        {/* status accent border bar */}
        <span
          className={`absolute top-0 left-0 block h-full w-0.5 ${status.dot}`}
          aria-hidden="true"
        />
        {/* Header */}
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold text-ink">{exam.exam_name}</h3>
            <p className="mt-0.5 text-xs text-ink-2">
              {exam.term} {exam.academic_year}
            </p>
          </div>
          <span className={`inline-flex shrink-0 items-center gap-1.5 text-xs font-medium ${status.text}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
            {exam.status}
          </span>
        </div>

        {/* Info row */}
        <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-ink-3" />
            {exam.exam_date}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-ink-3" />
            {exam.start_time} · {exam.duration_minutes}m
          </span>
        </div>

        {/* Progress */}
        {exam.student_count !== undefined && (
          <div className="mb-4">
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-ink-2">
                <Users className="mr-1 inline h-3 w-3 text-ink-3" />
                {exam.assigned_count ?? 0} / {exam.student_count} students
              </span>
              <NumberTicker
                value={progress}
                suffix="%"
                className="font-medium text-ink"
              />
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-surface-hover">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-auto flex items-center justify-between border-t border-line pt-3">
          <span className="inline-flex items-center gap-1.5 text-xs text-ink-2">
            <MapPin className="h-3.5 w-3.5 text-ink-3" />
            {exam.room_count ?? 0} room{(exam.room_count ?? 0) !== 1 ? "s" : ""} assigned
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-accent">
            Open
            <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}