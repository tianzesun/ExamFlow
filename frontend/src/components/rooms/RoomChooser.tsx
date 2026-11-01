"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Armchair, Building2, Check, DoorOpen, Search, Users } from "lucide-react";
import { getRoomLayout, type Room, type RoomLayout } from "@/lib/api/rooms";
import { ApiError, errorReference } from "@/lib/api/client";
import { SPACING_OPTIONS, seatAllowed } from "@/lib/seating-options";
import { formatNumber, plural } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button, Skeleton } from "@/components";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FloorPlan, FloorPlanLegend, cellKey, type CellState } from "./FloorPlan";

/**
 * Choose a room for an exam while seeing its floor plan: which seats exist, which aren't
 * in use, and which the exam's spacing rule keeps empty, so staff can tell how many
 * students it really holds before adding it. With moving, it picks the room a room's
 * students move to instead, and only rooms that hold them all can be chosen.
 */
export function RoomChooser({
  open,
  onClose,
  examId,
  rooms,
  spacing,
  frontRowEmpty = false,
  examRoomIds,
  registered,
  onAdd,
  moving,
}: {
  open: boolean;
  onClose: () => void;
  examId: string;
  /** Rooms that can still be added to the exam */
  rooms: Room[];
  spacing: string;
  /** The exam keeps row 1 free, so those seats don't count either. */
  frontRowEmpty?: boolean;
  /** Rooms already in the exam; their seats under the spacing rule count towards the students. */
  examRoomIds: string[];
  /** Students registered for the exam */
  registered: number;
  onAdd: (roomId: string) => Promise<void>;
  /** Choosing where a room's students move: the room they leave and how many there are. */
  moving?: { from: string; students: number };
}) {
  const [query, setQuery] = useState("");
  const [chosen, setChosen] = useState<string | null>(null);
  const [layouts, setLayouts] = useState<Record<string, RoomLayout | "error">>({});
  const [adding, setAdding] = useState(false);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rooms
      .filter((r) => !q || `${r.building} ${r.room_number}`.toLowerCase().includes(q))
      .sort((a, b) => a.building.localeCompare(b.building) || a.room_number.localeCompare(b.room_number, undefined, { numeric: true }));
  }, [rooms, query]);

  // Highlight the first room when the list opens or the search hides the chosen one.
  const current = shown.find((r) => r.id === chosen) ?? shown[0] ?? null;

  useEffect(() => {
    if (!open || !current || layouts[current.id]) return;
    const id = current.id;
    getRoomLayout(id, examId)
      .then((layout) => setLayouts((l) => ({ ...l, [id]: layout })))
      .catch(() => setLayouts((l) => ({ ...l, [id]: "error" })));
  }, [open, current, layouts, examId]);

  // Layouts of the exam's own rooms, to work out how many students still need a seat.
  useEffect(() => {
    if (!open) return;
    for (const id of examRoomIds) {
      if (layouts[id]) continue;
      getRoomLayout(id, examId)
        .then((layout) => setLayouts((l) => ({ ...l, [id]: layout })))
        .catch(() => setLayouts((l) => ({ ...l, [id]: "error" })));
    }
  }, [open, examRoomIds, layouts, examId]);

  const examRoomsLoaded = examRoomIds.every((id) => layouts[id]);
  const seatsInExamRooms = examRoomIds.reduce((n, id) => {
    const l = layouts[id];
    return n + (l && l !== "error" ? planOf(l, spacing, frontRowEmpty).allowed : 0);
  }, 0);
  const studentsNeedingRoom = moving ? moving.students : examRoomsLoaded ? Math.max(0, registered - seatsInExamRooms) : 0;

  const layout = current ? layouts[current.id] : undefined;
  const plan = useMemo(() => (layout && layout !== "error" ? planOf(layout, spacing, frontRowEmpty) : null), [layout, spacing, frontRowEmpty]);
  const spacingLabel = SPACING_OPTIONS.find((o) => o.value === spacing)?.label ?? "Fill every seat";

  const tooSmall = !!moving && !!plan && plan.allowed < moving.students;

  const add = async () => {
    if (!current || tooSmall) return;
    setAdding(true);
    try {
      await onAdd(current.id);
      setChosen(null);
      setQuery("");
      onClose();
    } catch (err) {
      // A refusal (e.g. the room is the accommodation room) explains itself; anything else gets a reference.
      toast.error(err instanceof ApiError && err.status === 400 ? err.message : moving
        ? `The students couldn't be moved to ${current.building} ${current.room_number}. Try again.${errorReference(err)}`
        : `${current.building} ${current.room_number} couldn't be added. Try again.${errorReference(err)}`);
    } finally {
      setAdding(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-6xl">
        <DialogHeader className="border-b border-line px-5 py-4">
          <DialogTitle className="text-base font-semibold text-ink">
            {moving ? `Move students from ${moving.from}` : "Add a room"}
          </DialogTitle>
          <DialogDescription className="text-xs text-ink-3">
            {moving && <>Pick the room the {plural(moving.students, "student")} move to. They keep their order, front row first; nobody else moves, and {moving.from} leaves this exam. </>}
            Pick a room to see its seats. Seating follows this exam&apos;s spacing rule: <b className="font-medium text-ink-2">{spacingLabel}</b>{frontRowEmpty && <>, with the front row empty</>}.
            {!moving && studentsNeedingRoom > 0 && <> {plural(studentsNeedingRoom, "student")} still need a room.</>}
          </DialogDescription>
        </DialogHeader>

        <div className="grid h-[min(70vh,640px)] grid-cols-1 md:grid-cols-[280px_minmax(0,1fr)]">
          {/* Room list */}
          <div className="flex min-h-0 flex-col border-b border-line md:border-b-0 md:border-r">
            <div className="relative p-3">
              <Search className="pointer-events-none absolute left-5.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search building or room"
                aria-label="Search rooms"
                className="h-9 w-full rounded-lg border border-line-strong bg-surface pl-8 pr-3 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15"
              />
            </div>
            <ul className="min-h-0 flex-1 overflow-y-auto px-2 pb-2" role="listbox" aria-label="Rooms">
              {shown.length === 0 && (
                <li className="px-3 py-8 text-center text-xs text-ink-3">
                  {rooms.length === 0 ? "Every active room is already in this exam." : "No room matches that search."}
                </li>
              )}
              {shown.map((r) => {
                const selected = current?.id === r.id;
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => setChosen(r.id)}
                      onDoubleClick={add}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                        selected ? "bg-accent-subtle ring-1 ring-accent/30" : "hover:bg-surface-hover",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                          selected ? "bg-accent text-white" : "bg-surface-2 text-ink-3",
                        )}
                      >
                        <DoorOpen className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink">
                          {r.building} <span className="font-mono text-xs text-ink-2">{r.room_number}</span>
                        </span>
                        <span className="tnum block text-xs text-ink-3">{plural(r.capacity, "seat")}</span>
                      </span>
                      {selected && <Check className="h-4 w-4 shrink-0 text-accent" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Floor plan of the highlighted room */}
          <div className="flex min-h-0 flex-col bg-surface-2/40">
            {!current ? (
              <div className="flex flex-1 items-center justify-center text-sm text-ink-3">No room to show.</div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-line bg-surface px-5 py-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-xs text-ink-3"><Building2 className="h-3.5 w-3.5" /> {current.building}</p>
                    <p className="text-lg font-semibold text-ink">Room {current.room_number}</p>
                  </div>
                  {plan && (
                    <div className="flex flex-wrap gap-2">
                      <Stat icon={Armchair} label="Seats" value={plan.usable} />
                      {(spacing !== "none" || frontRowEmpty) && <Stat icon={Users} label="Students with spacing" value={plan.allowed} strong />}
                      {plan.blocked > 0 && <Stat label="Not in use" value={plan.blocked} />}
                      {plan.taken > 0 && <Stat label="Used by another exam" value={plan.taken} />}
                      <Stat label="Rows × seats" text={`${plan.rows} × ${plan.columns}`} />
                    </div>
                  )}
                </div>
                {plan && plan.taken > 0 && (
                  <p className="border-b border-warning/20 bg-warning/10 px-5 py-2 text-xs text-warning">
                    {plan.others.join(", ")} {plan.others.length === 1 ? "uses" : "use"} {plural(plan.taken, "seat")} here
                    at the same time. Those seats are left out; this exam can share the rest of the room.
                  </p>
                )}
                {plan && studentsNeedingRoom > 0 && (
                  <p
                    className={cn(
                      "border-b px-5 py-2 text-xs",
                      plan.allowed >= studentsNeedingRoom
                        ? "border-success/20 bg-success/10 text-success"
                        : "border-warning/20 bg-warning/10 text-warning",
                    )}
                  >
                    {moving
                      ? plan.allowed >= studentsNeedingRoom
                        ? `Room for all ${plural(studentsNeedingRoom, "student")} from ${moving.from}.`
                        : `Holds ${formatNumber(plan.allowed)} of the ${plural(studentsNeedingRoom, "student")} from ${moving.from}; choose a larger room.`
                      : plan.allowed >= studentsNeedingRoom
                      ? `Enough room for the ${plural(studentsNeedingRoom, "student")} still without one.`
                      : `Holds ${formatNumber(plan.allowed)} of the ${plural(studentsNeedingRoom, "student")} still without a room; you'll need another room too.`}
                  </p>
                )}
                <div className="min-h-0 flex-1 overflow-auto p-6">
                  {layout === "error" ? (
                    <p className="py-10 text-center text-sm text-danger">
                      This room&apos;s layout couldn&apos;t be loaded. You can still add it.
                    </p>
                  ) : !plan ? (
                    <Skeleton className="mx-auto h-72 w-full max-w-xl" />
                  ) : plan.rows === 0 ? (
                    <p className="py-10 text-center text-sm text-ink-3">This room has no seat layout yet. Set one up on the Rooms page.</p>
                  ) : (
                    <FloorPlan
                      compact
                      highlightSeats
                      rows={plan.rows}
                      columns={plan.columns}
                      aisles={plan.aisles}
                      stateOf={(row, col) => plan.cells.get(cellKey(row, col)) ?? "missing"}
                    />
                  )}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface px-5 py-3">
                  <FloorPlanLegend spacing={spacing !== "none" || frontRowEmpty} seated={false} highlightSeats taken={!!plan?.taken} />
                  <div className="flex gap-2">
                    <Button variant="ghost" onClick={onClose} disabled={adding}>Cancel</Button>
                    <Button onClick={add} loading={adding} disabled={tooSmall}>
                      {moving ? `Move to ${current.building} ${current.room_number}` : `Add ${current.building} ${current.room_number}`}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ icon: Icon, label, value, text, strong }: {
  icon?: typeof Users; label: string; value?: number; text?: string; strong?: boolean;
}) {
  return (
    <div className={cn("rounded-lg border px-3 py-1.5", strong ? "border-accent/30 bg-accent-subtle" : "border-line bg-surface-2")}>
      <p className="flex items-center gap-1 text-[11px] text-ink-3">{Icon && <Icon className="h-3 w-3" />}{label}</p>
      <p className={cn("tnum text-sm font-semibold", strong ? "text-accent" : "text-ink")}>
        {text ?? formatNumber(value ?? 0)}
      </p>
    </div>
  );
}

/** Each position's state, and the counts shown above the plan. */
function planOf(layout: RoomLayout, spacing: string, frontRowEmpty: boolean) {
  const cells = new Map<string, CellState>();
  let usable = 0, allowed = 0, blocked = 0, taken = 0;
  for (const s of layout.seats) {
    if (s.row == null || s.column == null) continue;
    let state: CellState = "seat";
    if (!s.is_usable) {
      state = "blocked";
      blocked++;
    } else if (s.taken_by) {
      // Automatic seating skips it, so it doesn't count towards the students.
      state = "taken";
      taken++;
    } else {
      usable++;
      if (seatAllowed(s.row, s.column, spacing, frontRowEmpty)) allowed++;
      else state = "spaced";
    }
    cells.set(cellKey(s.row, s.column), state);
  }
  const others = [...new Set(layout.seats.map((s) => s.taken_by).filter((x): x is string => !!x))];
  return {
    rows: layout.rows, columns: layout.columns, aisles: new Set(layout.aisles_after), cells, usable, allowed, blocked,
    taken, others,
  };
}
