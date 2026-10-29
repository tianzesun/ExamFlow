"use client";

import { type LucideIcon } from "lucide-react";
import { Sparkline } from "@/components/charts/Sparkline";
import { NumberTicker } from "@/components/ui/NumberTicker";

type Color = "accent" | "success" | "warning" | "danger" | "violet" | "neutral";
const COLOR_VAR: Record<Color, string> = {
  accent: "var(--accent)",
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
  violet: "var(--violet)",
  neutral: "var(--ink-3)",
};
/** CSS variable names (without var()) used for accent tinting. */
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
  /** Secondary line under the value, e.g. "of 53 exams" */
  hint?: string;
  /** 0–1 completion shown as a slim bar along the bottom */
  progress?: number;
}

export function StatCard({
  icon: Icon,
  label,
  value,
  change,
  sparkline,
  color = "neutral",
  hint,
  progress,
}: StatCardProps) {
  const numeric =
    typeof value === "number" && Number.isFinite(value);
  const tint = color === "neutral" ? undefined : `var(${COLOR_VAR_BG[color]})`;
  return (
    <div className="surface-card card hoverable group flex h-full flex-col overflow-hidden px-4 pb-4 pt-4 sm:px-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-medium leading-snug text-ink-2">{label}</p>
        <span
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-hover text-ink-3 transition-transform duration-200 group-hover:scale-110"
          style={
            tint
              ? {
                  color: "#fff",
                  background: `linear-gradient(135deg, ${tint}, color-mix(in srgb, ${tint} 55%, var(--violet)))`,
                  boxShadow: `0 6px 16px -6px color-mix(in srgb, ${tint} 70%, transparent)`,
                }
              : undefined
          }
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-1.5 flex items-baseline gap-2">
        {numeric ? (
          <NumberTicker
            value={value}
            className="tnum text-[32px] font-semibold leading-none tracking-tight text-ink"
          />
        ) : (
          <span className="tnum text-[28px] font-semibold leading-none tracking-tight text-ink">
            {value}
          </span>
        )}
        {change && (
          <span
            className={`tnum text-xs font-medium ${
              change.startsWith("+")
                ? "text-success"
                : change.startsWith("-")
                  ? "text-danger"
                  : "text-ink-3"
            }`}
          >
            {change}
          </span>
        )}
      </div>
      {hint && <p className="mt-1.5 text-xs text-ink-3">{hint}</p>}
      <div className="mt-auto pt-3">
        {progress !== undefined ? (
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-hover">
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{
                width: `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%`,
                background: `linear-gradient(90deg, ${COLOR_VAR[color]}, color-mix(in srgb, ${COLOR_VAR[color]} 50%, var(--violet)))`,
              }}
            />
          </div>
        ) : sparkline && sparkline.length >= 2 ? (
          <div className="h-6">
            <Sparkline data={sparkline} color={COLOR_VAR[color]} width={96} height={24} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
