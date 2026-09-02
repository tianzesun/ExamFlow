"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface DonutChartProps {
  data: Array<{
    name: string;
    value: number;
    color?: string;
  }>;
  height?: number;
  className?: string;
  showLegend?: boolean;
  innerRadius?: number;
  outerRadius?: number;
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload: { color: string } }>;
}) {
  if (!active || !payload || !payload.length) return null;

  const { name, value } = payload[0];
  return (
    <div className="rounded-md border border-line bg-surface px-3 py-2 shadow-md">
      <p className="text-xs font-medium text-ink">{name}</p>
      <p className="text-sm text-ink-2">
        {value} exam{value !== 1 ? "s" : ""}
      </p>
    </div>
  );
}

const DEFAULT_COLORS = [
  "var(--accent)",
  "var(--violet)",
  "var(--success)",
  "var(--warning)",
  "var(--danger)",
  "var(--ink-3)",
];

export function DonutChart({
  data,
  height = 300,
  className = "",
  showLegend = true,
  innerRadius = 60,
  outerRadius = 100,
}: DonutChartProps) {
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

  return (
    <div className={`w-full ${className}`} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          {showLegend && <Legend />}
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
