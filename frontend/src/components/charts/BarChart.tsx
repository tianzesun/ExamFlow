"use client";

import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface BarChartProps {
  data: Array<Record<string, string | number>>;
  bars: Array<{
    key: string;
    color?: string;
    name?: string;
  }>;
  xKey?: string;
  height?: number;
  className?: string;
  showLegend?: boolean;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="rounded-md border border-line bg-surface px-3 py-2 shadow-md">
      <p className="text-xs font-medium text-ink">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="text-xs text-ink-2" style={{ color: entry.color }}>
          {entry.name}: {entry.value}
        </p>
      ))}
    </div>
  );
}

export function BarChart({
  data,
  bars,
  xKey = "label",
  height = 300,
  className = "",
  showLegend = true,
}: BarChartProps) {
  if (!data.length) {
    return (
      <div
        className={`flex items-center justify-center text-xs text-ink-3 ${className}`}
        style={{ height }}
      >
        No data
      </div>
    );
  }

  const defaultColors = [
    "var(--accent)",
    "var(--violet)",
    "var(--success)",
    "var(--warning)",
    "var(--danger)",
  ];

  return (
    <div className={`w-full ${className}`} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--line)"
            vertical={false}
          />
          <XAxis
            dataKey={xKey}
            tick={{ fontSize: 10, fill: "var(--ink-3)" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "var(--ink-3)" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          {showLegend && <Legend />}
          {bars.map((bar, index) => (
            <Bar
              key={bar.key}
              dataKey={bar.key}
              name={bar.name || bar.key}
              fill={bar.color || defaultColors[index % defaultColors.length]}
              radius={[4, 4, 0, 0]}
            />
          ))}
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}
