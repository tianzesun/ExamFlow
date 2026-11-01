"use client";

import { useEffect, useRef } from "react";
import { Lock } from "lucide-react";
import { rowLabel } from "@/lib/api/rooms";
import { cn } from "@/lib/utils";

/** When previewing a room for an exam: "spaced" is a seat the exam's spacing rule keeps empty, and
 * "taken" a seat another exam uses at the same time. */
export type CellState = "seat" | "blocked" | "missing" | "spaced" | "taken";

export const cellKey = (row: number, col: number) => `${row}-${col}`;

/** Seat tiles shrink as rooms get wider so a whole lecture hall fits on screen; compact fits a dialog. */
function cellSize(columns: number, compact = false) {
  if (compact) return columns <= 12 ? 30 : columns <= 20 ? 24 : columns <= 30 ? 19 : 15;
  if (columns <= 12) return 40;
  if (columns <= 20) return 34;
  if (columns <= 30) return 28;
  return 22;
}

export function FloorPlan({
  rows,
  columns,
  aisles,
  stateOf,
  lockOf,
  onPaintStart,
  onPaint,
  onRow,
  onColumn,
  onToggleAisle,
  compact = false,
  highlightSeats = false,
}: {
  rows: number;
  columns: number;
  aisles: Set<number>;
  stateOf: (row: number, col: number) => CellState;
  /** Why a seat can't be changed freely, shown on hover. */
  lockOf?: (row: number, col: number) => string | null;
  /** Leave out the editing handlers for a read-only plan. */
  onPaintStart?: (row: number, col: number) => void;
  onPaint?: (row: number, col: number) => void;
  onRow?: (row: number) => void;
  onColumn?: (col: number) => void;
  onToggleAisle?: (afterCol: number) => void;
  /** Smaller tiles, for previewing a room inside a dialog. */
  compact?: boolean;
  /** Tint the seats students can use, so they stand out from spaced, unused and missing ones. */
  highlightSeats?: boolean;
}) {
  const editable = !!onPaintStart;
  const painting = useRef(false);
  const size = cellSize(columns, compact);
  const showCodes = size >= 34;

  useEffect(() => {
    const stop = () => (painting.current = false);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => {
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
  }, []);

  const cols = Array.from({ length: columns }, (_, i) => i + 1);
  const gapBefore = (col: number) => (aisles.has(col - 1) ? "ml-6" : col > 1 ? "ml-1" : "");

  return (
    <div className="mx-auto w-fit select-none" style={{ touchAction: editable ? "none" : undefined }}>
      {/* Front of the room: where the invigilator stands. */}
      <div className="mb-5 flex justify-center pl-7 pr-7">
        <div className="relative w-3/4 min-w-40 rounded-b-2xl rounded-t-md border border-line bg-surface py-2 text-center shadow-[var(--shadow-sm)]">
          <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-ink-3">Front of room</span>
          <span className="absolute inset-x-1/3 -bottom-px h-0.5 rounded-full bg-accent/60" />
        </div>
      </div>

      {/* Seat numbers, with the aisle toggles between them. */}
      <div className="mb-1.5 flex items-end pl-7">
        {cols.map((col) => (
          <div key={col} className={cn("relative flex justify-center", gapBefore(col))} style={{ width: size }}>
            {onToggleAisle && col > 1 && (
              <button
                type="button"
                onClick={() => onToggleAisle(col - 1)}
                title={aisles.has(col - 1) ? `Remove the aisle after seat ${col - 1}` : `Add an aisle after seat ${col - 1}`}
                aria-label={aisles.has(col - 1) ? `Remove the aisle after seat ${col - 1}` : `Add an aisle after seat ${col - 1}`}
                aria-pressed={aisles.has(col - 1)}
                className={cn(
                  "group absolute bottom-0 top-0 z-10 flex items-center justify-center",
                  aisles.has(col - 1) ? "-left-6 w-6" : "-left-1 w-1",
                )}
              >
                <span
                  className={cn(
                    "rounded-full transition-all",
                    aisles.has(col - 1)
                      ? "h-4 w-1 bg-accent/50 group-hover:bg-danger/60"
                      : "h-3 w-px bg-transparent group-hover:h-4 group-hover:w-1 group-hover:bg-accent",
                  )}
                />
              </button>
            )}
            {onColumn ? (
              <button
                type="button"
                onClick={() => onColumn(col)}
                title={`Apply to every seat ${col}`}
                className="tnum w-full rounded text-[10px] font-semibold text-ink-3 hover:bg-accent-subtle hover:text-accent"
              >
                {col}
              </button>
            ) : (
              <span className="tnum text-[10px] font-semibold text-ink-3">{col}</span>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-1">
        {Array.from({ length: rows }, (_, i) => i + 1).map((row) => {
          const label = rowLabel(row);
          const RowLabel = onRow ? "button" : "span";
          return (
            <div key={row} className="flex items-center">
              <RowLabel
                {...(onRow ? { type: "button" as const, onClick: () => onRow(row), title: `Apply to all of row ${label}` } : {})}
                className={cn(
                  "tnum mr-1.5 w-5.5 shrink-0 rounded text-right text-[11px] font-semibold text-ink-3",
                  onRow && "hover:bg-accent-subtle hover:text-accent",
                )}
              >
                {label}
              </RowLabel>
              {cols.map((col) => {
                const state = stateOf(row, col);
                const lock = lockOf?.(row, col) ?? null;
                const code = `${label}${String(col).padStart(2, "0")}`;
                const desc =
                  state === "missing" ? `${code}: no seat`
                    : state === "blocked" ? `${code}: not in use`
                    : state === "spaced" ? `${code}: kept empty by the seating rules`
                    : state === "taken" ? `${code}: used by another exam at the same time`
                    : `${code}: seat`;
                return (
                  <div key={col} className={gapBefore(col)}>
                    <button
                      type="button"
                      tabIndex={editable ? 0 : -1}
                      disabled={!editable}
                      title={lock ? `${desc}. ${lock}` : desc}
                      aria-label={lock ? `${desc}. ${lock}` : desc}
                      onPointerDown={(e) => {
                        if (!editable || e.button !== 0) return;
                        (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
                        painting.current = true;
                        onPaintStart(row, col);
                      }}
                      onPointerEnter={() => painting.current && onPaint?.(row, col)}
                      onKeyDown={(e) => {
                        if (editable && (e.key === "Enter" || e.key === " ")) {
                          e.preventDefault();
                          onPaintStart(row, col);
                        }
                      }}
                      style={{ width: size, height: size }}
                      className={cn(
                        "relative flex items-center justify-center rounded-md text-[9px] font-medium transition-colors duration-100",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                        editable && "cursor-crosshair",
                        state === "seat" && !highlightSeats &&
                          "border border-line-strong bg-surface text-ink-3 shadow-[inset_0_-3px_0_var(--surface-hover)] hover:border-accent",
                        state === "seat" && highlightSeats &&
                          "border border-accent/45 bg-accent-subtle text-accent shadow-[inset_0_-3px_0_color-mix(in_oklab,var(--accent)_22%,transparent)]",
                        state === "blocked" && "seat-blocked border border-line text-ink-3 hover:border-warning",
                        state === "spaced" && "border border-line bg-surface-2/60 text-ink-3/50",
                        state === "taken" && "border border-warning/40 bg-warning/15 text-warning",
                        state === "missing" &&
                          "border border-dashed border-line/70 bg-transparent text-transparent hover:border-accent/60",
                      )}
                    >
                      {showCodes && state !== "missing" && <span className="tnum font-mono">{code}</span>}
                      {lock && (
                        <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-violet text-white ring-2 ring-surface-2">
                          <Lock className="h-2 w-2" />
                        </span>
                      )}
                    </button>
                  </div>
                );
              })}
              <span className="tnum ml-1.5 w-5.5 shrink-0 text-[11px] font-semibold text-ink-3">{label}</span>
            </div>
          );
        })}
      </div>

      <p className="mt-5 pl-7 text-center text-[11px] text-ink-3">Back of room</p>
    </div>
  );
}

export function FloorPlanLegend({ spacing = false, seated = true, highlightSeats = false, taken = false }: {
  spacing?: boolean; seated?: boolean; highlightSeats?: boolean; taken?: boolean;
}) {
  const items = [
    {
      cls: highlightSeats ? "border-accent/45 bg-accent-subtle" : "border-line-strong bg-surface",
      label: spacing ? "Seat a student can use" : "Seat",
    },
    ...(spacing ? [{ cls: "border-line bg-surface-2/60", label: "Kept empty by the rules" }] : []),
    ...(taken ? [{ cls: "border-warning/40 bg-warning/15", label: "Another exam at the same time" }] : []),
    { cls: "seat-blocked border-line", label: "Not in use" },
    { cls: "border-dashed border-line", label: "No seat" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-ink-3">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <span className={cn("h-3 w-3 rounded-[4px] border", i.cls)} />
          {i.label}
        </span>
      ))}
      {seated && (
        <span className="inline-flex items-center gap-1.5">
          <span className="flex h-3 w-3 items-center justify-center rounded-full bg-violet text-white">
            <Lock className="h-[7px] w-[7px]" />
          </span>
          Students seated
        </span>
      )}
    </div>
  );
}
