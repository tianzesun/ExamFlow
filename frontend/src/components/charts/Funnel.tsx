/**
 * Horizontal funnel showing how exams progress through statuses.
 * Each stage width is proportional to its count with a tabular value.
 */
export function Funnel({
  data,
  color,
}: {
  data: Array<{ label: string; value: number; color?: string }>;
  color?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));

  if (data.length === 0) {
    return (
      <p className="py-6 text-center text-xs text-ink-3">No data</p>
    );
  }

  const minWidth = 24;

  return (
    <div className="space-y-3">
      {data.map((d, i) => {
        const pct = (d.value / max) * 100;
        const barW = Math.max(minWidth, pct) + "%";
        return (
          <div key={d.label} className="flex items-center gap-3">
            <span className="w-20 shrink-0 truncate text-xs text-ink-2">
              {d.label}
            </span>
            <div className="relative flex-1">
              <div
                className="h-6 rounded-md transition-[width] duration-500"
                style={{
                  width: barW,
                  background: d.color ?? color ?? "var(--ink-3)",
                  opacity: i === 0 ? 1 : 0.85 - (i * 0.06),
                }}
              />
              <span
                className="absolute inset-0 flex items-center justify-end pr-2 text-xs font-medium text-ink"
                style={{
                  color: d.color
                    ? "var(--surface)"
                    : i === 0
                      ? "var(--ink)"
                      : "var(--ink-2)",
                }}
              >
                {d.value}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
