"use client";

import { type LucideIcon } from "lucide-react";
import { Sparkline } from "@/components/charts/Sparkline";
import { NumberTicker } from "@/components/ui/NumberTicker";

type Color = "accent" | "success" | "warning" | "danger" | "violet" | "neutral";
const ICON_TINT: Record<Color, string> = {
  accent: "text-accent",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  violet: "text-violet",
  neutral: "text-ink-3",
};
const COLOR_VAR: Record<Color, string> = {
  accent: "var(--accent)",
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
  violet: "var(--violet)",
  neutral: "var(--ink-3)",
};
/** CSS variable names (without var()) used for tinted glow washes. */
const COLOR_VAR_BG: Record<Color, string> = {
  accent: "--accent",
  success: "--success",
  warning: "--warning",
  danger: "--danger",
  violet: "--violet",
  neutral: "--ink-3",
};

export interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  change?: string;
  sparkline?: number[];
  /** Subtle icon tint; default is neutral */
  color?: Color;
}

export function StatCard({
  icon: Icon,
  label,
  value,
  change,
  sparkline,
  color = "neutral",
}: StatCardProps) {
  const numeric =
    typeof value === "number" && Number.isFinite(value);
  return (
    <div className="group surface-card relative overflow-hidden px-5 py-4 transition-shadow duration-200 hover:shadow-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="flex h-6 w-6 items-center justify-center rounded-md border border-line bg-surface-2"
            style={color === "neutral" ? undefined : { color: `var(${COLOR_VAR_BG[color]})` }}
          >
            <Icon className="h-3.5 w-3.5" />
          </span>
          <p className="text-xs font-medium text-ink-2">{label}</p>
        </div>
        {change && (
          <span
            className={`tnum text-xs font-medium ${
              change.startsWith("+")
                ? "text-success"
                : change.startsWith("-")
                  ? "text-danger"
                  : "text-ink-2"
            }`}
          >
            {change}
          </span>
        )}
      </div>
      <div className="mt-2 flex items-baseline justify-between gap-2">
        {numeric ? (
          <NumberTicker
            value={value}
            className="tnum text-2xl font-bold tracking-tight text-ink"
          />
        ) : (
          <span className="tnum text-2xl font-bold tracking-tight text-ink">
            {value}
          </span>
        )}
      </div>
      {sparkline && sparkline.length >= 2 && (
        <div className="mt-2.5 h-6">
          <Sparkline data={sparkline} color={COLOR_VAR[color]} width={96} height={24} />
        </div>
      )}
    </div>
  );
}