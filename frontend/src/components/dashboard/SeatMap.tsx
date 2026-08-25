"use client";

interface Seat {
  id: string;
  seat_code: string;
  row_number: number | null;
  column_number: number | null;
  status: string;
  student_name?: string;
  student_number?: string;
}

interface SeatMapProps {
  seats: Seat[];
  maxColumns?: number;
  onSeatClick?: (seat: Seat) => void;
  selectedSeatId?: string | null;
}

export function SeatMap({
  seats,
  maxColumns = 10,
  onSeatClick,
  selectedSeatId,
}: SeatMapProps) {
  if (seats.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-md border border-dashed border-line bg-surface-2">
        <p className="text-sm text-ink-2">
          No seats configured for this room
        </p>
      </div>
    );
  }

  // Sort seats by row then column
  const sortedSeats = [...seats].sort((a, b) => {
    const rowA = a.row_number ?? 0;
    const rowB = b.row_number ?? 0;
    const colA = a.column_number ?? 0;
    const colB = b.column_number ?? 0;
    if (rowA !== rowB) return rowA - rowB;
    return colA - colB;
  });

  // Group by rows
  const rows: Seat[][] = [];
  let currentRow: Seat[] = [];
  let currentRowNum: number | null = null;

  sortedSeats.forEach((seat) => {
    const rowNum = seat.row_number ?? 0;
    if (rowNum !== currentRowNum || currentRow.length >= maxColumns) {
      if (currentRow.length > 0) rows.push(currentRow);
      currentRow = [seat];
      currentRowNum = rowNum;
    } else {
      currentRow.push(seat);
    }
  });
  if (currentRow.length > 0) rows.push(currentRow);

  const getSeatColor = (seat: Seat) => {
    if (seat.id === selectedSeatId) {
      return "bg-accent text-white ring-2 ring-accent/30";
    }
    if (seat.status === "BLOCKED") {
      return "bg-danger/10 text-danger";
    }
    if (seat.student_name) {
      return "bg-success/10 text-success";
    }
    return "bg-surface-2 text-ink-2 ring-1 ring-line hover:bg-surface-hover";
  };

  const getSeatTooltip = (seat: Seat) => {
    if (seat.student_name) {
      return `${seat.seat_code} — ${seat.student_name} (${seat.student_number})`;
    }
    return `${seat.seat_code} — Empty`;
  };

  return (
    <div className="space-y-3">
      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-ink-2">
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-sm bg-success/60" />
          Assigned
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-sm bg-surface-hover ring-1 ring-line" />
          Available
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-sm bg-danger/60" />
          Blocked
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-sm bg-accent" />
          Selected
        </div>
      </div>

      {/* Stage/Front indicator */}
      <div className="flex justify-center">
        <div className="rounded border border-line bg-surface-2 px-8 py-0.5 text-[11px] font-medium uppercase tracking-wider text-ink-3">
          Front
        </div>
      </div>

      {/* Seat Grid */}
      <div className="overflow-x-auto rounded-md border border-line bg-surface p-4">
        <div className="flex flex-col items-center gap-2">
          {rows.map((row, rowIndex) => (
            <div key={rowIndex} className="flex items-center gap-2">
              <span className="tnum w-6 text-right text-xs text-ink-3">
                {row[0]?.row_number ?? rowIndex + 1}
              </span>
              <div className="flex gap-1.5">
                {row.map((seat) => (
                  <button
                    key={seat.id}
                    onClick={() => onSeatClick?.(seat)}
                    title={getSeatTooltip(seat)}
                    className={`flex h-9 w-9 items-center justify-center rounded-md text-xs font-medium transition-colors ${getSeatColor(
                      seat
                    )}`}
                  >
                    {seat.seat_code}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="tnum flex gap-4 text-xs text-ink-2">
        <span>{seats.filter((s) => s.student_name).length} assigned</span>
        <span>{seats.filter((s) => !s.student_name && s.status !== "BLOCKED").length} available</span>
        <span>{seats.filter((s) => s.status === "BLOCKED").length} blocked</span>
      </div>
    </div>
  );
}