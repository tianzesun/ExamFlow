"use client";

import { errorMessage } from "@/lib/api/client";
import { useCallback, useEffect, useMemo, useState, type DragEvent } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeftRight,
  Armchair,
  CheckCircle2,
  DoorOpen,
  GripVertical,
  MousePointerClick,
  Move,
  Printer,
  Search,
  Settings2,
  UserMinus,
  UserX,
  Users,
  X,
} from "lucide-react";
import { getExam } from "@/lib/api/exams";
import {
  getSeatMap,
  getUnassignedStudents,
  moveStudent,
  removeAssignment,
  type SeatMapRoom,
  type SeatMapSeat,
  type UnassignedStudent,
} from "@/lib/api/assignments";
import { Exam } from "@/lib/types";
import { useAuth } from "@/lib/auth/context";
import { Badge, Button, Card, EmptyState, Skeleton, StatCard } from "@/components";
import { PageTransition } from "@/components/page-transition";
import { cn } from "@/lib/utils";
import { formatDateLong, formatTime, plural } from "@/lib/format";

import { notifyExamChanged } from "@/components/exam/workspace";
const DRAG_TYPE = "application/x-examflow-student";

/** A student "in hand": picked from a seat or from the unassigned list. */
type Carry = { studentId: string; name: string; fromSeatId: string | null };

const roomLabel = (room: Pick<SeatMapRoom, "building" | "room_number">) =>
  `${room.building} ${room.room_number}`.trim();

const buildingInitials = (name: string) =>
  name
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const initials = (fullName: string) =>
  fullName
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

/** "Ada Lovelace" -> "Ada L." so names fit inside a seat tile. */
function shortName(fullName: string) {
  const parts = fullName.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return fullName;
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

const rowLabel = (seatCode: string) => seatCode.replace(/\d+$/, "");

function fillTone(pct: number) {
  return pct >= 100 ? "bg-success" : "bg-accent";
}

export default function SeatMapPage() {
  const params = useParams();
  const { user } = useAuth();
  const examId = params.id as string;
  const [exam, setExam] = useState<Exam | null>(null);
  // Archived exams are final; the server refuses every change, so don't offer any.
  const canEdit = (user?.role === "ADMIN" || user?.role === "STAFF") && exam?.status !== "ARCHIVED";
  const [rooms, setRooms] = useState<SeatMapRoom[]>([]);
  const [unassigned, setUnassigned] = useState<UnassignedStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [selectedSeatId, setSelectedSeatId] = useState<string | null>(null);
  const [highlightSeatId, setHighlightSeatId] = useState<string | null>(null);
  const [carry, setCarry] = useState<Carry | null>(null);
  const [dragOverSeatId, setDragOverSeatId] = useState<string | null>(null);
  const [dragOverUnassigned, setDragOverUnassigned] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [unassignedQuery, setUnassignedQuery] = useState("");

  const refresh = useCallback(async () => {
    const [map, un] = await Promise.all([getSeatMap(examId), getUnassignedStudents(examId)]);
    setRooms(map.rooms);
    setUnassigned(un.students);
    setActiveRoomId((current) =>
      current && map.rooms.some((r) => r.id === current) ? current : map.rooms[0]?.id ?? null,
    );
  }, [examId]);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve()
      .then(() => Promise.all([getExam(examId), refresh()]))
      .then(([e]) => {
        if (!cancelled) setExam(e);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err, "The seat map could not be loaded. Try again in a moment."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [examId, refresh]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Escape in the find or filter box belongs to that box.
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable]")) return;
      if (e.key === "Escape") {
        setCarry(null);
        setSelectedSeatId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!highlightSeatId) return;
    const t = setTimeout(() => setHighlightSeatId(null), 2400);
    return () => clearTimeout(t);
  }, [highlightSeatId]);

  const seatIndex = useMemo(() => {
    const map = new Map<string, { seat: SeatMapSeat; room: SeatMapRoom }>();
    for (const room of rooms) for (const seat of room.seats) map.set(seat.id, { seat, room });
    return map;
  }, [rooms]);

  const activeRoom = rooms.find((r) => r.id === activeRoomId) ?? null;
  const selected = selectedSeatId ? seatIndex.get(selectedSeatId) ?? null : null;

  const totals = useMemo(() => {
    const seated = rooms.reduce((n, r) => n + r.occupied_seats, 0);
    const usable = rooms.reduce((n, r) => n + r.usable_seats, 0);
    return { seated, usable, free: usable - seated, registered: seated + unassigned.length };
  }, [rooms, unassigned]);

  const findResults = useMemo(() => {
    const q = findQuery.trim().toLowerCase();
    if (!q) return [];
    const hits: { key: string; name: string; number: string; where: string; seatId: string | null; roomId: string | null }[] = [];
    for (const room of rooms) {
      for (const seat of room.seats) {
        const o = seat.occupant;
        if (o && (o.full_name.toLowerCase().includes(q) || o.student_number.includes(q))) {
          hits.push({
            key: seat.id,
            name: o.full_name,
            number: o.student_number,
            where: `${roomLabel(room)} · ${seat.seat_code}`,
            seatId: seat.id,
            roomId: room.id,
          });
        }
      }
    }
    for (const s of unassigned) {
      if (s.full_name.toLowerCase().includes(q) || s.student_number.includes(q)) {
        hits.push({ key: s.student_id, name: s.full_name, number: s.student_number, where: "Unassigned", seatId: null, roomId: null });
      }
    }
    return hits.slice(0, 8);
  }, [findQuery, rooms, unassigned]);

  const filteredUnassigned = useMemo(() => {
    const q = unassignedQuery.trim().toLowerCase();
    if (!q) return unassigned;
    return unassigned.filter((s) => s.full_name.toLowerCase().includes(q) || s.student_number.includes(q));
  }, [unassigned, unassignedQuery]);

  const focusSeat = (seatId: string, roomId: string) => {
    setActiveRoomId(roomId);
    setSelectedSeatId(seatId);
    setHighlightSeatId(seatId);
    requestAnimationFrame(() =>
      document.getElementById(`seat-${seatId}`)?.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" }),
    );
  };

  const commitMove = async (studentId: string, name: string, targetSeatId: string) => {
    const target = seatIndex.get(targetSeatId)?.seat;
    if (!target || !target.is_usable) return;
    if (target.taken_by) {
      toast.error(`${target.seat_code} is used by ${target.taken_by} at the same time. Pick another seat.`);
      setCarry(null);
      return;
    }
    if (target.occupant?.student_id === studentId) {
      setCarry(null);
      return;
    }
    const fromSeat = [...seatIndex.values()].find((e) => e.seat.occupant?.student_id === studentId);
    if (target.occupant && !fromSeat) {
      toast.error(`${target.seat_code} is taken. Pick an empty seat.`);
      return;
    }
    setBusy(true);
    try {
      const res = await moveStudent(examId, studentId, targetSeatId);
      notifyExamChanged();
      if (res.action === "swapped") toast.success(`Swapped ${name} and ${target.occupant?.full_name}`);
      else if (res.action === "moved") toast.success(`Moved ${name} to ${target.seat_code}`);
      else if (res.action === "assigned") toast.success(`Seated ${name} in ${target.seat_code}`);
      setCarry(null);
      setSelectedSeatId(targetSeatId);
      await refresh();
    } catch (err) {
      toast.error(errorMessage(err, "The student couldn't be moved. Try again in a moment."));
    } finally {
      setBusy(false);
    }
  };

  const unassign = async (seat: SeatMapSeat) => {
    if (!seat.occupant) return;
    const { full_name, assignment_id } = seat.occupant;
    setBusy(true);
    try {
      await removeAssignment(examId, assignment_id);
      notifyExamChanged();
      toast.success(`${full_name} removed from ${seat.seat_code}`);
      setCarry(null);
      await refresh();
    } catch (err) {
      toast.error(errorMessage(err, "The student couldn't be unseated. Try again in a moment."));
    } finally {
      setBusy(false);
    }
  };

  const handleSeatClick = (seat: SeatMapSeat) => {
    if (carry && canEdit) {
      void commitMove(carry.studentId, carry.name, seat.id);
      return;
    }
    setSelectedSeatId((cur) => (cur === seat.id ? null : seat.id));
  };

  const readDrag = (e: DragEvent): Carry | null => {
    try {
      return JSON.parse(e.dataTransfer.getData(DRAG_TYPE)) as Carry;
    } catch {
      return null;
    }
  };

  const startDrag = (e: DragEvent, payload: Carry) => {
    e.dataTransfer.setData(DRAG_TYPE, JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "move";
    setCarry(payload);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-72" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-22 w-full" />
          ))}
        </div>
        <Skeleton className="h-[520px] w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>
    );
  }

  return (
    <PageTransition>
      <div className="animate-fade-in space-y-6 print:hidden">
        {/* Toolbar */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-ink">Seat map</h2>
            <p className="text-sm text-ink-2">
              {canEdit
                ? "Drag students between seats, or click a seat to inspect and move it."
                : "Room layouts with each student's assigned seat."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <FindStudent
              query={findQuery}
              onQuery={setFindQuery}
              results={findResults}
              onPick={(hit) => {
                setFindQuery("");
                if (hit.seatId && hit.roomId) focusSeat(hit.seatId, hit.roomId);
                else {
                  setUnassignedQuery(hit.number);
                  toast(`${hit.name} has no seat yet`);
                }
              }}
            />
            <Button variant="secondary" onClick={() => window.print()} disabled={!activeRoom}>
              <Printer className="h-4 w-4" /> Print room
            </Button>
            <Link href={`/app/exams/${examId}/seating`}>
              <Button variant="secondary">
                <Settings2 className="h-4 w-4" /> Seating setup
              </Button>
            </Link>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard icon={Users} label="Registered" value={totals.registered} color="accent" />
          <StatCard icon={CheckCircle2} label="Seated" value={totals.seated} color="success" />
          <StatCard
            icon={UserX}
            label="Unassigned"
            value={unassigned.length}
            color={unassigned.length > 0 ? "warning" : "neutral"}
          />
          <StatCard icon={Armchair} label="Free seats" value={totals.free} color="violet" />
        </div>

        {rooms.length === 0 ? (
          <Card className="p-10">
            <EmptyState
              icon={<DoorOpen className="h-6 w-6 text-ink-3" />}
              title="No rooms selected for this exam"
              description="Add rooms in seating setup, then generate seating or place students by hand."
              action={
                <Link href={`/app/exams/${examId}/seating`}>
                  <Button>
                    <Settings2 className="h-4 w-4" /> Open seating setup
                  </Button>
                </Link>
              }
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-6 items-start xl:grid-cols-[minmax(0,1fr)_300px] 2xl:grid-cols-[220px_minmax(0,1fr)_300px]">
            <RoomRail rooms={rooms} activeRoomId={activeRoomId} onSelect={(id) => { setActiveRoomId(id); setSelectedSeatId(null); }} />

            {activeRoom && (
              <RoomCanvas
                room={activeRoom}
                canEdit={canEdit}
                busy={busy}
                carry={carry}
                selectedSeatId={selectedSeatId}
                highlightSeatId={highlightSeatId}
                dragOverSeatId={dragOverSeatId}
                onCancelCarry={() => setCarry(null)}
                onSeatClick={handleSeatClick}
                onSeatDragStart={(e, seat) =>
                  seat.occupant &&
                  startDrag(e, { studentId: seat.occupant.student_id, name: seat.occupant.full_name, fromSeatId: seat.id })
                }
                onDragEnd={() => {
                  setCarry(null);
                  setDragOverSeatId(null);
                  setDragOverUnassigned(false);
                }}
                onSeatDragOver={(e, seat) => {
                  if (!seat.is_usable || seat.taken_by) return;
                  e.preventDefault();
                  setDragOverSeatId(seat.id);
                }}
                onSeatDrop={(e, seat) => {
                  e.preventDefault();
                  setDragOverSeatId(null);
                  const payload = readDrag(e);
                  if (payload) void commitMove(payload.studentId, payload.name, seat.id);
                }}
              />
            )}

            <div className="space-y-6">
              <Inspector
                entry={selected}
                canEdit={canEdit}
                busy={busy}
                carry={carry}
                unassigned={unassigned}
                onMove={(seat) =>
                  seat.occupant &&
                  setCarry({ studentId: seat.occupant.student_id, name: seat.occupant.full_name, fromSeatId: seat.id })
                }
                onUnassign={unassign}
                onAssign={(student, seat) => commitMove(student.student_id, student.full_name, seat.id)}
                onClose={() => setSelectedSeatId(null)}
              />
              <UnassignedPanel
                students={filteredUnassigned}
                total={unassigned.length}
                query={unassignedQuery}
                onQuery={setUnassignedQuery}
                canEdit={canEdit}
                carry={carry}
                dragOver={dragOverUnassigned}
                onPick={(s) =>
                  setCarry((cur) =>
                    cur?.studentId === s.student_id ? null : { studentId: s.student_id, name: s.full_name, fromSeatId: null },
                  )
                }
                onDragStart={(e, s) => startDrag(e, { studentId: s.student_id, name: s.full_name, fromSeatId: null })}
                onDragEnd={() => {
                  setCarry(null);
                  setDragOverSeatId(null);
                }}
                onDragOver={(e) => {
                  if (!carry?.fromSeatId) return;
                  e.preventDefault();
                  setDragOverUnassigned(true);
                }}
                onDragLeave={() => setDragOverUnassigned(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverUnassigned(false);
                  const payload = readDrag(e);
                  const seat = payload?.fromSeatId ? seatIndex.get(payload.fromSeatId)?.seat : null;
                  if (seat) void unassign(seat);
                }}
              />
            </div>
          </div>
        )}
      </div>

      {activeRoom && exam && <PrintSheet exam={exam} room={activeRoom} />}
    </PageTransition>
  );
}

/* ── Find a student anywhere in the exam ── */
function FindStudent({
  query,
  onQuery,
  results,
  onPick,
}: {
  query: string;
  onQuery: (q: string) => void;
  results: { key: string; name: string; number: string; where: string; seatId: string | null; roomId: string | null }[];
  onPick: (hit: { name: string; number: string; seatId: string | null; roomId: string | null }) => void;
}) {
  return (
    <div className="relative w-full sm:w-72">
      <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
      <input
        type="text"
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && results[0]) onPick(results[0]);
        }}
        placeholder="Find a student by name or number…"
        aria-label="Find a student"
        className="w-full rounded-md border border-line bg-surface px-3 py-2 pl-8 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
      />
      {query.trim() && (
        <div className="absolute right-0 left-0 z-30 mt-1 overflow-hidden rounded-lg border border-line bg-surface shadow-lg">
          {results.length === 0 ? (
            <p className="px-3 py-3 text-sm text-ink-3">No matching students</p>
          ) : (
            results.map((hit) => (
              <button
                key={hit.key}
                onClick={() => onPick(hit)}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-surface-hover"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-ink">{hit.name}</span>
                  <span className="tnum block text-xs text-ink-3">{hit.number}</span>
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
                    hit.seatId ? "bg-accent-subtle text-accent-strong" : "bg-warning/10 text-warning",
                  )}
                >
                  {hit.where}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ── Left rail: rooms used by this exam ── */
function RoomRail({
  rooms,
  activeRoomId,
  onSelect,
}: {
  rooms: SeatMapRoom[];
  activeRoomId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <Card className="h-fit p-2 xl:col-span-2 2xl:col-span-1">
      <p className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-3">
        Rooms · {rooms.length}
      </p>
      <div className="flex gap-2 overflow-x-auto 2xl:flex-col 2xl:overflow-visible">
        {rooms.map((room) => {
          const pct = room.usable_seats ? Math.round((room.occupied_seats / room.usable_seats) * 100) : 0;
          const active = room.id === activeRoomId;
          return (
            <button
              key={room.id}
              onClick={() => onSelect(room.id)}
              aria-current={active}
              className={cn(
                "min-w-[220px] rounded-lg border px-3 py-2.5 text-left transition-colors 2xl:min-w-0",
                active ? "border-accent/40 bg-accent-subtle" : "border-transparent hover:bg-surface-hover",
              )}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border text-[10px] font-bold uppercase tracking-wide",
                    active ? "border-accent/40 bg-surface text-accent" : "border-line bg-surface-2 text-accent",
                  )}
                >
                  {buildingInitials(room.building)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{room.room_number}</p>
                  <p className="truncate text-xs text-ink-3">{room.building}</p>
                </div>
                <span className="tnum text-xs font-medium text-ink-2">{pct}%</span>
              </div>
              <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-surface-hover">
                <div className={cn("h-full rounded-full transition-[width] duration-500", fillTone(pct))} style={{ width: `${pct}%` }} />
              </div>
              <p className="tnum mt-1.5 text-[11px] text-ink-3">
                {room.occupied_seats} of {room.usable_seats} seats filled
              </p>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

/* ── Center: the room floor plan ── */
function RoomCanvas({
  room,
  canEdit,
  busy,
  carry,
  selectedSeatId,
  highlightSeatId,
  dragOverSeatId,
  onCancelCarry,
  onSeatClick,
  onSeatDragStart,
  onDragEnd,
  onSeatDragOver,
  onSeatDrop,
}: {
  room: SeatMapRoom;
  canEdit: boolean;
  busy: boolean;
  carry: Carry | null;
  selectedSeatId: string | null;
  highlightSeatId: string | null;
  dragOverSeatId: string | null;
  onCancelCarry: () => void;
  onSeatClick: (seat: SeatMapSeat) => void;
  onSeatDragStart: (e: DragEvent, seat: SeatMapSeat) => void;
  onDragEnd: () => void;
  onSeatDragOver: (e: DragEvent, seat: SeatMapSeat) => void;
  onSeatDrop: (e: DragEvent, seat: SeatMapSeat) => void;
}) {
  // Paper versions are only worth showing when the room actually mixes them.
  const showVersion = room.seats.some((s) => s.occupant && s.occupant.paper_version !== "A");
  const grid = useMemo(() => {
    const byRow = new Map<number, SeatMapSeat[]>();
    for (const seat of room.seats) {
      const r = seat.row_number ?? 0;
      if (!byRow.has(r)) byRow.set(r, []);
      byRow.get(r)!.push(seat);
    }
    return [...byRow.entries()]
      .sort(([a], [b]) => a - b)
      .map(([row, seats]) => {
        const cells: (SeatMapSeat | null)[] = Array.from({ length: room.columns }, () => null);
        for (const s of seats) if (s.column_number) cells[s.column_number - 1] = s;
        return { row, label: rowLabel(seats[0].seat_code), cells };
      });
  }, [room]);

  // Aisles come from the room's layout, so the map matches the real floor.
  const aisles = new Set(room.aisles_after ?? []);
  const pct = room.usable_seats ? Math.round((room.occupied_seats / room.usable_seats) * 100) : 0;

  return (
    <Card className="h-fit min-w-0 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-ink">{roomLabel(room)}</h2>
          <p className="tnum mt-0.5 text-xs text-ink-3">
            {room.occupied_seats} seated · {room.usable_seats - room.occupied_seats} free · {pct}% full
          </p>
        </div>
        <Legend />
      </div>

      {carry && canEdit && (
        <div className="flex items-center justify-between gap-3 border-b border-accent/30 bg-accent-subtle px-5 py-2.5 text-sm">
          <span className="flex items-center gap-2 text-ink">
            <MousePointerClick className="h-4 w-4 text-accent" />
            <span>
              Placing <span className="font-semibold">{carry.name}</span>.{" "}
              {carry.fromSeatId
                ? "Click an empty seat to move, or an occupied seat to swap."
                : "Click an empty seat."}
            </span>
          </span>
          <button
            onClick={onCancelCarry}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-ink-2 hover:bg-surface hover:text-ink"
          >
            <X className="h-3.5 w-3.5" /> Cancel <kbd className="ml-1 rounded border border-line px-1 text-[10px]">Esc</kbd>
          </button>
        </div>
      )}

      <div className={cn("max-h-[680px] overflow-auto bg-surface-2/60 px-4 py-6", busy && "pointer-events-none opacity-70")}>
        <div className="mx-auto w-fit">
          <div className="mb-6 flex justify-center">
            <div className="w-2/3 min-w-48 rounded-md border border-line bg-surface py-1.5 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-3 shadow-sm">
              Front of room
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {grid.map(({ row, label, cells }) => (
              <div key={row} className="flex items-center gap-2">
                <span className="tnum w-5 shrink-0 text-right text-[11px] font-semibold text-ink-3">{label}</span>
                <div className="flex gap-1">
                  {cells.map((seat, i) => (
                    <div key={seat?.id ?? `gap-${row}-${i}`} className={cn("flex", aisles.has(i) && "ml-4")}>
                      {seat ? (
                        <SeatTile
                          seat={seat}
                          showVersion={showVersion}
                          canEdit={canEdit}
                          carry={carry}
                          selected={seat.id === selectedSeatId}
                          highlighted={seat.id === highlightSeatId}
                          dragOver={seat.id === dragOverSeatId}
                          onClick={() => onSeatClick(seat)}
                          onDragStart={(e) => onSeatDragStart(e, seat)}
                          onDragEnd={onDragEnd}
                          onDragOver={(e) => onSeatDragOver(e, seat)}
                          onDrop={(e) => onSeatDrop(e, seat)}
                        />
                      ) : (
                        <div className="h-[60px] w-[64px]" />
                      )}
                    </div>
                  ))}
                </div>
                <span className="tnum w-5 shrink-0 text-[11px] font-semibold text-ink-3">{label}</span>
              </div>
            ))}
          </div>

          <p className="mt-6 text-center text-[11px] text-ink-3">Back of room</p>
        </div>
      </div>
    </Card>
  );
}

function Legend() {
  const items = [
    { cls: "border-accent/40 bg-accent-subtle", label: "Auto" },
    { cls: "border-violet/40 bg-violet-subtle", label: "Manual" },
    { cls: "border-dashed border-line-strong bg-surface", label: "Empty" },
    { cls: "seat-blocked border-line", label: "Not in use" },
    { cls: "border-warning/40 bg-warning/10", label: "Another exam at the same time" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-ink-3">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <span className={cn("h-3 w-3 rounded-[4px] border", i.cls)} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

function SeatTile({
  seat,
  canEdit,
  carry,
  selected,
  highlighted,
  dragOver,
  onClick,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  showVersion = false,
}: {
  seat: SeatMapSeat;
  showVersion?: boolean;
  canEdit: boolean;
  carry: Carry | null;
  selected: boolean;
  highlighted: boolean;
  dragOver: boolean;
  onClick: () => void;
  onDragStart: (e: DragEvent) => void;
  onDragEnd: () => void;
  onDragOver: (e: DragEvent) => void;
  onDrop: (e: DragEvent) => void;
}) {
  const o = seat.occupant;
  const isSource = carry?.fromSeatId === seat.id;
  // Where the carried student can land: any empty seat, or a filled one to swap when moving from a seat.
  const elsewhere = seat.taken_by;
  const isTarget = !!carry && canEdit && seat.is_usable && !elsewhere && !isSource && (!o || !!carry.fromSeatId);

  const label = !seat.is_usable
    ? `${seat.seat_code}, not in use`
    : o
      ? `${seat.seat_code}, ${o.full_name}, ${o.student_number}${showVersion ? `, version ${o.paper_version}` : ""}`
        + (elsewhere ? `. Clash: ${elsewhere} also uses this seat at the same time` : "")
      : elsewhere
        ? `${seat.seat_code}, used by ${elsewhere} at the same time`
        : `${seat.seat_code}, empty`;

  return (
    <button
      id={`seat-${seat.id}`}
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={selected}
      disabled={!seat.is_usable || (!!elsewhere && !o)}
      draggable={canEdit && !!o}
      onClick={onClick}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={cn(
        "group relative flex h-[60px] w-[64px] flex-col justify-between rounded-lg border px-1 py-1 text-left transition-all duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-2",
        !seat.is_usable && "seat-blocked cursor-not-allowed border-line text-ink-3",
        seat.is_usable && !o && !elsewhere && "border-dashed border-line-strong bg-surface text-ink-3 hover:border-accent hover:bg-accent-subtle",
        seat.is_usable && !o && elsewhere && "cursor-not-allowed border-warning/40 bg-warning/10 text-warning",
        o && o.method === "MANUAL" && "border-violet/40 bg-violet-subtle text-ink hover:border-violet",
        o && o.method !== "MANUAL" && "border-accent/40 bg-accent-subtle text-ink hover:border-accent",
        o && canEdit && "cursor-grab active:cursor-grabbing",
        isTarget && !o && "border-accent bg-accent-subtle",
        isTarget && o && "hover:ring-2 hover:ring-violet/50",
        isSource && "opacity-40",
        dragOver && "scale-105 ring-2 ring-accent",
        selected && "ring-2 ring-accent ring-offset-2 ring-offset-surface-2",
        highlighted && "animate-pulse ring-4 ring-warning/60",
        o && elsewhere && "ring-2 ring-danger ring-offset-1 ring-offset-surface-2",
      )}
    >
      <span className="flex items-center justify-between">
        <span className="tnum font-mono text-[10px] font-semibold text-ink-3">{seat.seat_code}</span>
        {isTarget && o && <ArrowLeftRight className="h-3 w-3 text-violet opacity-0 group-hover:opacity-100" />}
        {!(isTarget && o) && o && showVersion && (
          <span className="rounded bg-ink px-1 text-[9px] font-bold leading-[14px] text-surface">{o.paper_version}</span>
        )}
      </span>
      {o ? (
        <span className="min-w-0">
          <span className="block truncate text-[11px] font-semibold leading-tight">{shortName(o.full_name)}</span>
          <span className="tnum block truncate text-[9px] leading-tight tracking-tight text-ink-2">{o.student_number}</span>
        </span>
      ) : (
        <span className="text-[10px] leading-tight">
          {!seat.is_usable ? "—" : elsewhere ? "Other exam" : isTarget ? "Drop here" : "Empty"}
        </span>
      )}
    </button>
  );
}

/* ── Right: details for the selected seat ── */
function Inspector({
  entry,
  canEdit,
  busy,
  carry,
  unassigned,
  onMove,
  onUnassign,
  onAssign,
  onClose,
}: {
  entry: { seat: SeatMapSeat; room: SeatMapRoom } | null;
  canEdit: boolean;
  busy: boolean;
  carry: Carry | null;
  unassigned: UnassignedStudent[];
  onMove: (seat: SeatMapSeat) => void;
  onUnassign: (seat: SeatMapSeat) => void;
  onAssign: (student: UnassignedStudent, seat: SeatMapSeat) => void;
  onClose: () => void;
}) {
  if (!entry) {
    return (
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-ink">How it works</h3>
        <ul className="mt-3 space-y-2.5 text-sm text-ink-2">
          <li className="flex gap-2.5">
            <MousePointerClick className="mt-0.5 h-4 w-4 shrink-0 text-accent" /> Click a seat to see who is sitting there.
          </li>
          {canEdit && (
            <>
              <li className="flex gap-2.5">
                <Move className="mt-0.5 h-4 w-4 shrink-0 text-accent" /> Drag a student to an empty seat to move them.
              </li>
              <li className="flex gap-2.5">
                <ArrowLeftRight className="mt-0.5 h-4 w-4 shrink-0 text-violet" /> Drop them on an occupied seat to swap the two students.
              </li>
              <li className="flex gap-2.5">
                <UserMinus className="mt-0.5 h-4 w-4 shrink-0 text-warning" /> Drop them on the Unassigned list to free the seat.
              </li>
            </>
          )}
        </ul>
      </Card>
    );
  }

  const { seat, room } = entry;
  const o = seat.occupant;

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">Seat</p>
          <p className="text-sm font-semibold text-ink">
            <span className="font-mono">{seat.seat_code}</span> · {roomLabel(room)}
          </p>
        </div>
        <button onClick={onClose} aria-label="Close" className="rounded-md p-1 text-ink-3 hover:bg-surface-hover hover:text-ink">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-5">
        {!seat.is_usable ? (
          <p className="text-sm text-ink-2">This seat is marked as not in use and cannot be assigned.</p>
        ) : seat.taken_by && !o ? (
          <p className="text-sm text-ink-2">
            <b className="font-medium text-ink">{seat.taken_by}</b> has a student in this seat at the same time, so
            it can&apos;t be used for this exam.
          </p>
        ) : o ? (
          <>
            {seat.taken_by && (
              <p className="mb-4 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
                {seat.taken_by} also has a student in this seat at the same time. Move this student to a free seat.
              </p>
            )}
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                  o.method === "MANUAL" ? "bg-violet-subtle text-violet-strong" : "bg-accent-subtle text-accent-strong",
                )}
              >
                {initials(o.full_name)}
              </span>
              <div className="min-w-0">
                <p className="truncate font-semibold text-ink">{o.full_name}</p>
                <p className="tnum font-mono text-sm text-ink-2">{o.student_number}</p>
              </div>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-md bg-surface-2 px-3 py-2">
                <dt className="text-[11px] text-ink-3">Room</dt>
                <dd className="font-medium text-ink">{room.room_number}</dd>
              </div>
              <div className="rounded-md bg-surface-2 px-3 py-2">
                <dt className="text-[11px] text-ink-3">Placed by</dt>
                <dd>
                  <Badge variant={o.method === "MANUAL" ? "violet" : "info"}>
                    {o.method === "MANUAL" ? "Manual" : "Auto"}
                  </Badge>
                </dd>
              </div>
            </dl>
            {canEdit && (
              <div className="mt-4 flex gap-2">
                <Button
                  className="flex-1"
                  variant={carry?.fromSeatId === seat.id ? "primary" : "secondary"}
                  onClick={() => onMove(seat)}
                  disabled={busy}
                >
                  <Move className="h-4 w-4" /> Move
                </Button>
                <Button variant="ghost" onClick={() => onUnassign(seat)} disabled={busy} className="text-danger hover:text-danger">
                  <UserMinus className="h-4 w-4" /> Unassign
                </Button>
              </div>
            )}
          </>
        ) : (
          <>
            <p className="text-sm text-ink-2">This seat is empty.</p>
            {canEdit &&
              (unassigned.length > 0 ? (
                <div className="mt-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">Seat someone here</p>
                  <div className="mt-2 max-h-56 space-y-1 overflow-y-auto">
                    {unassigned.slice(0, 30).map((s) => (
                      <button
                        key={s.student_id}
                        onClick={() => onAssign(s, seat)}
                        disabled={busy}
                        className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-surface-hover"
                      >
                        <span className="truncate text-ink">{s.full_name}</span>
                        <span className="tnum ml-2 shrink-0 text-xs text-ink-3">{s.student_number}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-xs text-ink-3">Every registered student already has a seat.</p>
              ))}
          </>
        )}
      </div>
    </Card>
  );
}

/* ── Right: students without a seat (also a drop zone to unassign) ── */
function UnassignedPanel({
  students,
  total,
  query,
  onQuery,
  canEdit,
  carry,
  dragOver,
  onPick,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  students: UnassignedStudent[];
  total: number;
  query: string;
  onQuery: (q: string) => void;
  canEdit: boolean;
  carry: Carry | null;
  dragOver: boolean;
  onPick: (s: UnassignedStudent) => void;
  onDragStart: (e: DragEvent, s: UnassignedStudent) => void;
  onDragEnd: () => void;
  onDragOver: (e: DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: DragEvent) => void;
}) {
  const acceptsDrop = canEdit && !!carry?.fromSeatId;
  return (
    <Card
      className={cn("overflow-hidden transition-colors", dragOver && "border-warning bg-warning/5")}
    >
      <div onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
            Unassigned
            <span
              className={cn(
                "tnum rounded-full px-2 py-0.5 text-xs font-medium",
                total > 0 ? "bg-warning/10 text-warning" : "bg-success/10 text-success",
              )}
            >
              {total}
            </span>
          </h3>
          {acceptsDrop && <span className="text-[11px] font-medium text-warning">Drop here to unassign</span>}
        </div>

        {total === 0 ? (
          <div className="flex flex-col items-center px-5 py-8 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-success/10">
              <CheckCircle2 className="h-5 w-5 text-success" />
            </span>
            <p className="mt-3 text-sm font-medium text-ink">Everyone has a seat</p>
            <p className="mt-1 text-xs text-ink-3">Students added to the roster later will show up here.</p>
          </div>
        ) : (
          <>
            <div className="px-5 pt-3">
              <input
                type="text"
                value={query}
                onChange={(e) => onQuery(e.target.value)}
                placeholder="Filter…"
                aria-label="Filter unassigned students"
                className="w-full rounded-md border border-line bg-surface px-3 py-1.5 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>
            <ul className="max-h-80 space-y-1 overflow-y-auto p-3">
              {students.map((s) => {
                const active = carry?.studentId === s.student_id;
                return (
                  <li key={s.student_id}>
                    <button
                      draggable={canEdit}
                      disabled={!canEdit}
                      onClick={() => onPick(s)}
                      onDragStart={(e) => onDragStart(e, s)}
                      onDragEnd={onDragEnd}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md border px-2.5 py-2 text-left text-sm transition-colors",
                        active ? "border-accent bg-accent-subtle" : "border-transparent hover:bg-surface-hover",
                        canEdit && "cursor-grab active:cursor-grabbing",
                      )}
                    >
                      {canEdit && <GripVertical className="h-3.5 w-3.5 shrink-0 text-ink-3" />}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-ink">{s.full_name}</span>
                        <span className="tnum block text-xs text-ink-3">{s.student_number}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
              {students.length === 0 && <li className="px-2 py-3 text-sm text-ink-3">No matches</li>}
            </ul>
          </>
        )}
      </div>
    </Card>
  );
}

/* ── Print-only proctor sheet for the active room ── */
function PrintSheet({ exam, room }: { exam: Exam; room: SeatMapRoom }) {
  const occupied = room.seats.filter((s) => s.occupant);
  return (
    <div className="print-sheet hidden print:block">
      <h1 className="text-xl font-bold">
        {exam.course_code} — {exam.exam_name}
      </h1>
      <p className="text-sm">
        {roomLabel(room)} · {formatDateLong(exam.exam_date)} · {formatTime(exam.start_time)} · {plural(occupied.length, "student")}
      </p>
      <table className="mt-4 w-full border-collapse text-sm">
        <thead>
          <tr>
            {["Seat", "Student #", "Name", "Signature"].map((h) => (
              <th key={h} className="border-b-2 border-black py-1.5 text-left">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {occupied.map((s) => (
            <tr key={s.id}>
              <td className="border-b border-gray-300 py-2 font-mono">{s.seat_code}</td>
              <td className="border-b border-gray-300 py-2">{s.occupant!.student_number}</td>
              <td className="border-b border-gray-300 py-2">{s.occupant!.full_name}</td>
              <td className="w-1/3 border-b border-gray-300 py-2" />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
