"use client";

import { type LucideIcon } from "lucide-react";

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  change?: string;
  /** Reserved for a subtle icon tint; default is neutral */
  color?: "accent" | "success" | "warning" | "danger" | "violet" | "neutral";
}

const ICON_TINT: Record<string, string> = {
  accent: "text-accent",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  violet: "text-violet",
  neutral: "text-ink-3",
};

export function StatCard({
  icon: Icon,
  label,
  value,
  change,
  color = "neutral",
}: StatCardProps) {
  return (
    <div className="surface-card px-4 py-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-ink-2">{label}</p>
        <Icon className={`h-4 w-4 shrink-0 ${ICON_TINT[color] ?? "text-ink-3"}`} />
      </div>
      <div className="mt-1.5 flex items-baseline gap-2">
        <p className="tnum text-2xl font-semibold tracking-tight text-ink">{value}</p>
        {change && (
          <span className="tnum text-xs font-medium text-success">{change}</span>
        )}
      </div>
    </div>
  );
}