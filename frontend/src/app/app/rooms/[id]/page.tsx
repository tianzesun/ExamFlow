"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Armchair, Ban, Eraser, Lock, Minus, Plus, RotateCcw, Save } from "lucide-react";
import {
  getRoom,
  getRoomLayout,
  saveRoomLayout,
  updateRoom,
  rowLabel,
  type LayoutSeat,
  type Room,
  type RoomLayout,
} from "@/lib/api/rooms";
import { ApiError, errorReference } from "@/lib/api/client";
import { Button, Card, Input, PageContainer, PageHeader, Skeleton } from "@/components";
import { Switch } from "@/components/ui/switch";
import { FloorPlan, FloorPlanLegend, cellKey, type CellState } from "@/components/rooms/FloorPlan";
import { useAuth } from "@/lib/auth/context";
import { formatNumber, plural } from "@/lib/format";
import { cn } from "@/lib/utils";

const MAX_ROWS = 52;
const MAX_COLUMNS = 60;

type Shape = { rows: number; columns: number; aisles: Set<number>; missing: Set<string>; blocked: Set<string> };

function shapeFrom(layout: RoomLayout): Shape {
  const present = new Set(layout.seats.map((s) => cellKey(s.row, s.column)));
  const missing = new Set<string>();
  for (let r = 1; r <= layout.rows; r++)
    for (let c = 1; c <= layout.columns; c++) if (!present.has(cellKey(r, c))) missing.add(cellKey(r, c));
  return {
    rows: layout.rows,
    columns: layout.columns,
    aisles: new Set(layout.aisles_after),
    missing,
    blocked: new Set(layout.seats.filter((s) => !s.is_usable).map((s) => cellKey(s.row, s.column))),
  };
}

const inGrid = (key: string, rows: number, columns: number) => {
  const [r, c] = key.split("-").map(Number);
  return r <= rows && c <= columns;
};

function sameShape(a: Shape, b: Shape) {
  const eq = (x: Set<string | number>, y: Set<string | number>) => x.size === y.size && [...x].every((v) => y.has(v));
  const trim = (s: Shape, set: Set<string>) => new Set([...set].filter((k) => inGrid(k, s.rows, s.columns)));
  return (
    a.rows === b.rows &&
    a.columns === b.columns &&
    eq(a.aisles, b.aisles) &&
    eq(trim(a, a.missing), trim(b, b.missing)) &&
    eq(trim(a, a.blocked), trim(b, b.blocked))
  );
}

const TOOLS: { value: CellState; label: string; hint: string; icon: typeof Armchair }[] = [
  { value: "seat", label: "Seat", hint: "A seat students can be given", icon: Armchair },
  { value: "blocked", label: "Not in use", hint: "Broken, reserved or kept empty", icon: Ban },
  { value: "missing", label: "No seat", hint: "A pillar, the lectern or a short row", icon: Eraser },
];

export default function RoomLayoutPage() {
  const params = useParams();
  const roomId = params.id as string;
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN";

  const [room, setRoom] = useState<Room | null>(null);
  const [details, setDetails] = useState({ building: "", room_number: "", is_active: true });
  const [saved, setSaved] = useState<Shape | null>(null);
  const [shape, setShape] = useState<Shape | null>(null);
  const [seats, setSeats] = useState<Map<string, LayoutSeat>>(new Map());
  const [tool, setTool] = useState<CellState>("seat");
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);
  // What one press-and-drag paints: set by the first seat, so dragging over a filled row toggles it back.
  const stroke = useRef<CellState>("seat");
  const warned = useRef(false);

  const applyLayout = useCallback((layout: RoomLayout) => {
    const s = shapeFrom(layout);
    setSaved(s);
    setShape(s);
    setSeats(new Map(layout.seats.map((seat) => [cellKey(seat.row, seat.column), seat])));
  }, []);

  useEffect(() => {
    Promise.all([getRoom(roomId), getRoomLayout(roomId)])
      .then(([r, layout]) => {
        setRoom(r);
        setDetails({ building: r.building, room_number: r.room_number, is_active: r.is_active });
        applyLayout(layout);
      })
      .catch(() => setLoadError(true));
  }, [roomId, applyLayout]);

  const stateOf = useCallback(
    (row: number, col: number): CellState => {
      if (!shape) return "seat";
      const key = cellKey(row, col);
      return shape.missing.has(key) ? "missing" : shape.blocked.has(key) ? "blocked" : "seat";
    },
    [shape],
  );

  const lockOf = useCallback(
    (row: number, col: number) => {
      const seat = seats.get(cellKey(row, col));
      if (!seat?.exams) return null;
      return seat.upcoming
        ? `Students are seated here for ${plural(seat.upcoming, "upcoming exam")}`
        : `Used for ${plural(seat.exams, "past exam")}`;
    },
    [seats],
  );

  // A seat with students booked can't be taken away; one used only in the past can be marked not in use.
  const allowed = useCallback(
    (key: string, to: CellState) => {
      const seat = seats.get(key);
      if (!seat?.exams || to === "seat") return true;
      return to === "blocked" && !seat.upcoming;
    },
    [seats],
  );

  const paint = useCallback(
    (keys: string[], to: CellState) => {
      let skipped = 0;
      setShape((s) => {
        if (!s) return s;
        const missing = new Set(s.missing);
        const blocked = new Set(s.blocked);
        for (const key of keys) {
          if (!allowed(key, to)) {
            skipped++;
            continue;
          }
          missing.delete(key);
          blocked.delete(key);
          if (to === "missing") missing.add(key);
          if (to === "blocked") blocked.add(key);
        }
        return { ...s, missing, blocked };
      });
      if (skipped && !warned.current) {
        warned.current = true;
        toast.info(
          to === "missing"
            ? "Seats that have been used for an exam can't be removed. Mark them as not in use instead."
            : "Seats with students seated for an upcoming exam stay in use. Move those students first.",
        );
      }
    },
    [allowed],
  );

  /** The tool, or back to a plain seat when every target already has it. */
  const target = (keys: string[]) => {
    const all = keys.every((k) => {
      const [r, c] = k.split("-").map(Number);
      return stateOf(r, c) === tool;
    });
    return all && tool !== "seat" ? "seat" : tool;
  };

  const onPaintStart = (row: number, col: number) => {
    warned.current = false;
    stroke.current = target([cellKey(row, col)]);
    paint([cellKey(row, col)], stroke.current);
  };

  const lineOf = (kind: "row" | "column", n: number) => {
    if (!shape) return [];
    return kind === "row"
      ? Array.from({ length: shape.columns }, (_, i) => cellKey(n, i + 1))
      : Array.from({ length: shape.rows }, (_, i) => cellKey(i + 1, n));
  };

  const paintLine = (kind: "row" | "column", n: number) => {
    warned.current = false;
    const keys = lineOf(kind, n);
    paint(keys, target(keys));
  };

  const setSize = (patch: Partial<Pick<Shape, "rows" | "columns">>) =>
    setShape((s) => {
      if (!s) return s;
      const rows = Math.min(MAX_ROWS, Math.max(1, patch.rows ?? s.rows));
      const columns = Math.min(MAX_COLUMNS, Math.max(1, patch.columns ?? s.columns));
      return { ...s, rows, columns, aisles: new Set([...s.aisles].filter((a) => a < columns)) };
    });

  const setAisles = (aisles: number[]) => setShape((s) => (s ? { ...s, aisles: new Set(aisles) } : s));
  const toggleAisle = (after: number) =>
    setShape((s) => {
      if (!s) return s;
      const aisles = new Set(s.aisles);
      if (aisles.has(after)) aisles.delete(after);
      else aisles.add(after);
      return { ...s, aisles };
    });

  const counts = useMemo(() => {
    if (!shape) return { inUse: 0, blocked: 0, missing: 0 };
    const missing = [...shape.missing].filter((k) => inGrid(k, shape.rows, shape.columns)).length;
    const blocked = [...shape.blocked].filter((k) => inGrid(k, shape.rows, shape.columns) && !shape.missing.has(k)).length;
    return { inUse: shape.rows * shape.columns - missing - blocked, blocked, missing };
  }, [shape]);

  // Seats with students that the new size would cut off.
  const conflicts = useMemo(() => {
    if (!shape) return [];
    return [...seats.entries()]
      .filter(([key, seat]) => seat.exams > 0 && (!inGrid(key, shape.rows, shape.columns) || shape.missing.has(key)))
      .map(([, seat]) => seat.seat_code)
      .sort();
  }, [seats, shape]);

  const layoutDirty = !!shape && !!saved && !sameShape(shape, saved);
  const detailsDirty =
    !!room &&
    (details.building.trim() !== room.building ||
      details.room_number.trim() !== room.room_number ||
      details.is_active !== room.is_active);
  const dirty = layoutDirty || detailsDirty;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const save = async () => {
    if (!shape || !room) return;
    if (!details.building.trim() || !details.room_number.trim()) {
      toast.error("The room needs a building and a room number.");
      return;
    }
    setSaving(true);
    try {
      if (detailsDirty) {
        const updated = await updateRoom(roomId, {
          building: details.building.trim(),
          room_number: details.room_number.trim(),
          is_active: details.is_active,
        });
        setRoom(updated);
      }
      if (layoutDirty) {
        const pairs = (set: Set<string>) =>
          [...set]
            .filter((k) => inGrid(k, shape.rows, shape.columns))
            .map((k) => k.split("-").map(Number) as [number, number]);
        const layout = await saveRoomLayout(roomId, {
          rows: shape.rows,
          columns: shape.columns,
          aisles_after: [...shape.aisles],
          missing: pairs(shape.missing),
          blocked: pairs(new Set([...shape.blocked].filter((k) => !shape.missing.has(k)))),
        });
        applyLayout(layout);
        setRoom((r) => (r ? { ...r, capacity: counts.inUse } : r));
      }
      toast.success("Room saved");
    } catch (err) {
      toast.error(
        err instanceof ApiError && err.status === 409
          ? err.message
          : `The room couldn't be saved. Try again.${errorReference(err)}`,
      );
    } finally {
      setSaving(false);
    }
  };

  if (loadError) {
    return (
      <PageContainer>
        <PageHeader eyebrow="Rooms" title="Room not found" description="It may have been deleted." />
        <Link href="/app/rooms" className="mt-4 inline-block text-sm text-accent hover:underline">
          Back to rooms
        </Link>
      </PageContainer>
    );
  }

  if (!room || !shape || !saved) {
    return (
      <PageContainer className="space-y-6">
        <Skeleton className="h-14 w-72 rounded-lg" />
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <Skeleton className="h-[520px] w-full rounded-xl" />
          <Skeleton className="h-[520px] w-full rounded-xl" />
        </div>
      </PageContainer>
    );
  }

  const change = counts.inUse - room.capacity;
  const centre = Math.ceil(shape.columns / 2);
  const everyN = (n: number) => Array.from({ length: Math.floor((shape.columns - 1) / n) }, (_, i) => (i + 1) * n);
  const aislePresets = [
    { label: "None", aisles: [] as number[] },
    ...(shape.columns >= 4 ? [{ label: "Centre", aisles: [centre] }] : []),
    ...(shape.columns >= 9 ? [{ label: "Every 3", aisles: everyN(3) }] : []),
    ...(shape.columns >= 9 ? [{ label: "Every 4", aisles: everyN(4) }] : []),
  ];
  const activePreset = aislePresets.find(
    (p) => p.aisles.length === shape.aisles.size && p.aisles.every((a) => shape.aisles.has(a)),
  )?.label;

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        eyebrow={
          <Link href="/app/rooms" className="hover:text-ink">
            Rooms
          </Link>
        }
        title={`${room.building} ${room.room_number}`}
        description={
          canEdit
            ? "Shape the room to match the real floor. Seating uses only the seats marked as in use."
            : "The room's seating layout."
        }
        actions={
          canEdit ? (
            <>
              <Button
                variant="secondary"
                disabled={!dirty || saving}
                onClick={() => {
                  setShape(saved);
                  setDetails({ building: room.building, room_number: room.room_number, is_active: room.is_active });
                }}
              >
                <RotateCcw /> Discard
              </Button>
              <Button onClick={save} loading={saving} disabled={!dirty || conflicts.length > 0}>
                <Save /> Save changes
              </Button>
            </>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="min-w-0 overflow-hidden">
          {canEdit && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
              <div role="radiogroup" aria-label="Paint" className="inline-flex rounded-lg border border-line-strong bg-surface-2 p-0.5">
                {TOOLS.map((t) => {
                  const Icon = t.icon;
                  const active = tool === t.value;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      title={t.hint}
                      onClick={() => setTool(t.value)}
                      className={cn(
                        "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors",
                        active ? "bg-surface text-ink shadow-[var(--shadow-sm)] ring-1 ring-line" : "text-ink-3 hover:text-ink",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {t.label}
                    </button>
                  );
                })}
              </div>
              <FloorPlanLegend />
            </div>
          )}
          {canEdit && (
            <p className="border-b border-line bg-surface-2/50 px-5 py-2 text-xs text-ink-3">
              Click or drag across seats to paint them. Click a row letter or seat number to paint the whole line, and
              the space between two seat numbers to add or remove an aisle.
            </p>
          )}
          <div className="max-h-[720px] overflow-auto bg-surface-2/60 px-4 py-8">
            <FloorPlan
              rows={shape.rows}
              columns={shape.columns}
              aisles={shape.aisles}
              stateOf={stateOf}
              lockOf={lockOf}
              {...(canEdit
                ? {
                    onPaintStart,
                    onPaint: (r: number, c: number) => paint([cellKey(r, c)], stroke.current),
                    onRow: (r: number) => paintLine("row", r),
                    onColumn: (c: number) => paintLine("column", c),
                    onToggleAisle: toggleAisle,
                  }
                : {})}
            />
          </div>
        </Card>

        <aside className="space-y-4 xl:sticky xl:top-6">
          <div className="hero-panel px-5 py-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">Seats for exams</p>
            <p className="tnum mt-2 text-4xl font-semibold tracking-tight">{formatNumber(counts.inUse)}</p>
            <p className="tnum mt-1 text-sm text-white/70">
              {shape.rows} rows × {shape.columns} seats
              {shape.aisles.size > 0 && ` · ${plural(shape.aisles.size, "aisle")}`}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-white/10 px-3 py-2">
                <p className="tnum text-base font-semibold">{counts.blocked}</p>
                <p className="text-white/70">Not in use</p>
              </div>
              <div className="rounded-lg bg-white/10 px-3 py-2">
                <p className="tnum text-base font-semibold">{counts.missing}</p>
                <p className="text-white/70">No seat</p>
              </div>
            </div>
            {layoutDirty && change !== 0 && (
              <p className="tnum mt-3 text-xs text-white/80">
                {change > 0 ? `+${change}` : change} from the saved {formatNumber(room.capacity)} seats
              </p>
            )}
          </div>

          {conflicts.length > 0 && (
            <div className="flex gap-2.5 rounded-xl border border-danger/25 bg-danger/5 p-3.5 text-sm text-danger">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                {conflicts.length === 1 ? "Seat" : "Seats"} {conflicts.slice(0, 6).join(", ")}
                {conflicts.length > 6 && ` and ${conflicts.length - 6} more`} {conflicts.length === 1 ? "has" : "have"} been
                used for an exam and can&apos;t be removed. Make the room bigger again, or mark them as not in use.
              </p>
            </div>
          )}

          {canEdit && (
            <Card className="divide-y divide-line">
              <section className="space-y-4 px-5 py-4">
                <h2 className="text-sm font-semibold text-ink">Size</h2>
                <Stepper label="Rows" value={shape.rows} max={MAX_ROWS} onChange={(rows) => setSize({ rows })} hint={`A to ${rowLabel(shape.rows)}`} />
                <Stepper
                  label="Seats per row"
                  value={shape.columns}
                  max={MAX_COLUMNS}
                  onChange={(columns) => setSize({ columns })}
                />
              </section>
              <section className="space-y-2.5 px-5 py-4">
                <h2 className="text-sm font-semibold text-ink">Aisles</h2>
                <div className="flex flex-wrap gap-1.5">
                  {aislePresets.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setAisles(p.aisles)}
                      className={cn(
                        "h-8 rounded-lg border px-3 text-xs font-medium transition-colors",
                        activePreset === p.label
                          ? "border-accent bg-accent-subtle text-accent"
                          : "border-line-strong bg-surface text-ink-2 hover:bg-surface-hover",
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-ink-3">
                  {shape.aisles.size > 0
                    ? `After seat ${[...shape.aisles].sort((a, b) => a - b).join(", ")}.`
                    : "No aisles."}{" "}
                  Aisles show on the seat map and the printed seating map.
                </p>
              </section>
              <section className="space-y-4 px-5 py-4">
                <h2 className="text-sm font-semibold text-ink">Details</h2>
                <Input
                  label="Building"
                  id="room-building"
                  value={details.building}
                  onChange={(e) => setDetails({ ...details, building: e.target.value })}
                />
                <Input
                  label="Room number"
                  id="room-number"
                  value={details.room_number}
                  onChange={(e) => setDetails({ ...details, room_number: e.target.value })}
                />
                <label className="flex cursor-pointer items-start justify-between gap-4">
                  <span>
                    <span className="block text-sm font-medium text-ink">Available for exams</span>
                    <span className="block text-xs text-ink-3">Inactive rooms can&apos;t be added to new exams.</span>
                  </span>
                  <Switch
                    checked={details.is_active}
                    onCheckedChange={(checked) => setDetails({ ...details, is_active: checked })}
                    className="mt-0.5"
                  />
                </label>
              </section>
            </Card>
          )}

          {[...seats.values()].some((s) => s.upcoming) && (
            <p className="flex gap-2 px-1 text-xs text-ink-3">
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet" />
              Seats with a lock have students seated in them. They stay in place when you change the room, so planned
              seating and printed papers aren&apos;t affected.
            </p>
          )}
        </aside>
      </div>
    </PageContainer>
  );
}

function Stepper({
  label,
  value,
  max,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  max: number;
  onChange: (v: number) => void;
  hint?: string;
}) {
  const id = `stepper-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div className="flex items-center justify-between gap-3">
      <label htmlFor={id} className="min-w-0">
        <span className="block text-sm text-ink">{label}</span>
        {hint && <span className="tnum block text-xs text-ink-3">{hint}</span>}
      </label>
      <div className="flex items-center rounded-lg border border-line-strong bg-surface shadow-[var(--shadow-sm)]">
        <button
          type="button"
          aria-label={`Fewer ${label.toLowerCase()}`}
          disabled={value <= 1}
          onClick={() => onChange(value - 1)}
          className="flex h-8 w-8 items-center justify-center text-ink-2 hover:text-ink disabled:opacity-40"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <input
          id={id}
          type="number"
          min={1}
          max={max}
          value={value}
          onChange={(e) => {
            const n = parseInt(e.target.value, 10);
            if (!Number.isNaN(n)) onChange(n);
          }}
          className="tnum h-8 w-12 border-x border-line bg-transparent text-center text-sm text-ink focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
        />
        <button
          type="button"
          aria-label={`More ${label.toLowerCase()}`}
          disabled={value >= max}
          onClick={() => onChange(value + 1)}
          className="flex h-8 w-8 items-center justify-center text-ink-2 hover:text-ink disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
