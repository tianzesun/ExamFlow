"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface FunnelProps {
  data: Array<{ label: string; value: number; color?: string }>;
  height?: number;
  className?: string;
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: { label: string; value: number } }>;
}) {
  if (!active || !payload || !payload.length) return null;

  const { label, value } = payload[0].payload;
  return (
    <div className="rounded-md border border-line bg-surface px-3 py-2 shadow-md">
      <p className="text-xs font-medium text-ink">{label}</p>
      <p className="text-sm text-ink-2">
        {value} exam{value !== 1 ? "s" : ""}
      </p>
    </div>
  );
}

const DEFAULT_COLORS = [
  "var(--ink-3)",
  "var(--accent)",
  "var(--success)",
  "var(--violet)",
  "var(--violet-strong)",
];

export function Funnel({
  data,
  height = 200,
  className = "",
}: FunnelProps) {
  if (data.length === 0) {
    return (
      <p className="py-6 text-center text-xs text-ink-3">No data</p>
    );
  }

  return (
    <div className={`w-full ${className}`} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 40, left: 0, bottom: 0 }}
        >
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="label"
            tick={{ fontSize: 12, fill: "var(--ink-2)" }}
            tickLine={false}
            axisLine={false}
            width={80}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar
            dataKey="value"
            radius={[0, 4, 4, 0]}
            barSize={24}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length]}
                fillOpacity={1 - index * 0.06}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
