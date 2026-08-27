/**
 * SVG area + axis chart for "Exams Over Time" (or any time series).
 * Lightweight, theme-aware, and renders crisp labels without heavy deps.
 */
export function AreaChart({
  data,
  xKey = "label",
  yKey = "value",
  color = "var(--accent)",
  height = 220,
  className = "",
}: {
  data: Array<Record<string, unknown>>;
  xKey?: string;
  yKey?: string;
  color?: string;
  height?: number;
  className?: string;
}) {
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

  const values = data.map((d) => Number(d[yKey]));
  const max = Math.max(1, ...values);
  const min = Math.min(0, ...values);
  const range = max - min || 1;

  const padLeft = 40;
  const padRight = 16;
  const padTop = 12;
  const padBottom = 24;
  const plotW = 320 - padLeft - padRight;
  const plotH = height - padTop - padBottom;
  const stepX = data.length > 1 ? plotW / (data.length - 1) : plotW;

  const pts = data
    .map((d, i) => {
      const x = padLeft + i * stepX;
      const y = padTop + plotH - ((Number(d[yKey]) - min) / range) * plotH;
      return { x, y, label: String(d[xKey]) };
    });

  const areaPoints =
    pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ") +
    ` ${padLeft + plotW},${padTop + plotH} ${padLeft},${padTop + plotH}`;

  const linePoints = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  // Y axis tick values (4 ticks)
  const ticks = Array.from({ length: 5 }, (_, i) =>
    Math.round(min + (range * i) / 4)
  );

  return (
    <div className={`w-full ${className}`} style={{ height }}>
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 320 ${height}`}
        preserveAspectRatio="none"
        className="overflow-visible"
        role="img"
        aria-label="Exams over time"
      >
        <defs>
          <linearGradient id="area-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity={0.22} />
            <stop offset="1" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>

        {/* Y axis grid + labels */}
        {ticks.map((t, i) => {
          const y = padTop + plotH - (i / 4) * plotH;
          return (
            <g key={i} transform={`translate(0,${y})`}>
              <line
                x1={padLeft}
                x2={padLeft + plotW}
                stroke="var(--line)"
                strokeWidth={1}
              />
              <text
                x={padLeft - 6}
                y={-3}
                textAnchor="end"
                className="fill-ink-3 text-[10px]"
              >
                {t}
              </text>
            </g>
          );
        })}

        {/* Zero baseline */}
        <line
          x1={padLeft}
          x2={padLeft + plotW}
          y1={padTop + plotH}
          stroke="var(--line)"
          strokeWidth={1}
        />

        {/* Area */}
        <polygon points={areaPoints} fill="url(#area-fill)" />

        {/* Line */}
        <polyline
          points={linePoints}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />

        {/* Dots */}
        {pts.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={3}
            fill={color}
            strokeWidth={3}
            stroke="var(--surface)"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>

      {/* X axis labels */}
      <div className="mt-1 flex justify-between gap-2 px-[40px]">
        {pts.map((p) => (
          <span
            key={p.label}
            className="shrink-0 text-[10px] text-ink-3"
            title={p.label}
          >
            {p.label}
          </span>
        ))}
      </div>
    </div>
  );
}
