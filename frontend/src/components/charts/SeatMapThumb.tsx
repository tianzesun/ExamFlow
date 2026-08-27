import type { Seat } from "@/lib/api/rooms";

const STATUS_COLOR: Record<string, string> = {
  AVAILABLE: "var(--ink-3)",
  ASSIGNED: "var(--accent)",
  BLOCKED: "var(--danger)",
  UNAVAILABLE: "var(--ink-3)",
};

/**
 * Compact SVG seat-layout thumbnail. Renders a fixed grid where each seat
 * is a small rect colored by status. Falls back to a textual count when no
 * structured seat data is available.
 */
export function SeatMapThumb({
  seats,
  maxCols = 8,
  cell = 10,
  gap = 2,
  className = "",
}: {
  seats: Seat[];
  maxCols?: number;
  cell?: number;
  gap?: number;
  className?: string;
}) {
  if (!seats.length) {
    return (
      <span className={`text-xs text-ink-3 ${className}`}>No seats</span>
    );
  }

  // Auto-size grid to seat codes (e.g. "A01" → row A, col 1).
  const rows: Record<string, Seat[]> = {};
  let cols = 0;
  for (const s of seats) {
    const rowKey = s.row_number?.toString() ?? s.seat_code?.[0] ?? "?";
    rows[rowKey] = rows[rowKey] ?? [];
    rows[rowKey].push(s);
    const col = s.column_number ?? rows[rowKey].length;
    if (col > cols) cols = col;
  }
  const rowKeys = Object.keys(rows).sort();
  const gridCols = Math.min(maxCols, Math.max(1, cols));
  const rowGap = gap;
  const w = gridCols * cell + (gridCols - 1) * gap;
  const h = rowKeys.length * cell + Math.max(0, rowKeys.length - 1) * rowGap;

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className={`overflow-visible ${className}`}
      aria-label="Seat layout"
    >
      {rowKeys.map((rk, ri) => {
        const seatsInRow = rows[rk];
        return seatsInRow.map((s, ci) => {
          const x = ci * (cell + gap);
          const y = ri * (cell + rowGap);
          const color = STATUS_COLOR[s.status] ?? "var(--ink-3)";
          return (
            <rect
              key={s.id}
              x={x}
              y={y}
              width={cell}
              height={cell}
              rx={2}
              fill={color}
              strokeWidth={0.5}
              stroke="var(--surface-hover)"
            />
          );
        });
      })}
    </svg>
  );
}
