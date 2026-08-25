import { type ReactNode } from "react";

export type SeriesColor =
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "violet"
  | "neutral";

const COLOR_VAR: Record<SeriesColor, string> = {
  accent: "var(--accent)",
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
  violet: "var(--violet)",
  neutral: "var(--ink-3)",
};

export interface BarDatum {
  label: string;
  value: number;
  color?: SeriesColor;
}

/**
 * Vertical bar chart — clean axes, minimal grid, tabular values.
 * Pure CSS/flex so text stays crisp and theme-aware.
 */
export function TrendBars({
  data,
  height = 160,
  valueSuffix = "",
}: {
  data: BarDatum[];
  height?: number;
  valueSuffix?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const barHeight = height - 36;

  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-xs text-ink-3"
        style={{ height }}
      >
        No data
      </div>
    );
  }

  return (
    <div className="flex items-end gap-3" style={{ height }}>
      {data.map((d) => {
        const pct = Math.round((d.value / max) * 100);
        return (
          <div
            key={d.label}
            className="group flex flex-1 flex-col items-center justify-end gap-2"
          >
            <span className="tnum text-xs font-medium text-ink-2">
              {d.value}
              {valueSuffix}
            </span>
            <div
              className="flex w-full items-end justify-center"
              style={{ height: barHeight }}
            >
              <div
                className="w-full max-w-[32px] rounded-sm transition-[height] duration-500"
                style={{
                  height: `${pct}%`,
                  background: COLOR_VAR[d.color ?? "accent"],
                }}
                title={`${d.label}: ${d.value}${valueSuffix}`}
              />
            </div>
            <span className="text-[11px] leading-none text-ink-3">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Horizontal labeled bars — for distribution breakdowns.
 */
export function BarList({
  data,
  emptyLabel = "No data",
}: {
  data: BarDatum[];
  emptyLabel?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));

  if (data.length === 0) {
    return <p className="py-6 text-center text-xs text-ink-3">{emptyLabel}</p>;
  }

  return (
    <div className="space-y-3">
      {data.map((d) => {
        const pct = Math.round((d.value / max) * 100);
        return (
          <div key={d.label} className="flex items-center gap-3">
            <span className="w-24 shrink-0 truncate text-xs text-ink-2">
              {d.label}
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-hover">
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{
                  width: `${pct}%`,
                  background: COLOR_VAR[d.color ?? "accent"],
                }}
              />
            </div>
            <span className="tnum w-8 shrink-0 text-right text-xs font-medium text-ink">
              {d.value}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Generic placeholder used by analytics panels.
 */
export function ChartEmpty({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-40 items-center justify-center text-sm text-ink-2">
      {children}
    </div>
  );
}
