"use client";

import { Plus, Upload, FileText, DoorOpen } from "lucide-react";
import Link from "next/link";

interface QuickAction {
  label: string;
  icon: React.ElementType;
  href?: string;
  onClick?: () => void;
  /** The first action becomes the primary/"New" action; the rest are secondary */
  primary?: boolean;
}

interface QuickActionsProps {
  courseId?: string;
  onImportRoster?: () => void;
  onUploadTemplate?: () => void;
}

export function QuickActions({
  courseId,
  onImportRoster,
  onUploadTemplate,
}: QuickActionsProps) {
  const actions: QuickAction[] = [
    {
      label: "New Exam",
      icon: Plus,
      href: courseId ? `/app/exams/new?course_id=${courseId}` : "/app/exams/new",
      primary: true,
    },
    {
      label: "Import Roster",
      icon: Upload,
      onClick: onImportRoster,
    },
    {
      label: "Upload Template",
      icon: FileText,
      onClick: onUploadTemplate,
    },
    {
      label: "Manage Rooms",
      icon: DoorOpen,
      href: "/app/rooms",
    },
  ];

  const base =
    "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors";
  const primary = "bg-accent text-white hover:bg-accent-strong";
  const secondary =
    "border border-line bg-surface text-ink-2 hover:bg-surface-hover hover:text-ink";

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => {
        const cls = `${base} ${action.primary ? primary : secondary}`;
        if (action.href) {
          return (
            <Link key={action.label} href={action.href} className={cls}>
              <action.icon className="h-4 w-4" />
              {action.label}
            </Link>
          );
        }
        return (
          <button key={action.label} onClick={action.onClick} className={cls}>
            <action.icon className="h-4 w-4" />
            {action.label}
          </button>
        );
      })}
    </div>
  );
}