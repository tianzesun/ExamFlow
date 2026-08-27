"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Plus,
  DoorOpen,
  Search,
  Building2,
  Users,
  CheckCircle2,
  XCircle,
  LayoutGrid,
  List,
  MapPin,
} from "lucide-react";
import { getRooms, getRoomSeats, type Room, type Seat } from "@/lib/api/rooms";
import {
  Card,
  Badge,
  Button,
  Table,
  TableHead,
  TableBody,
  Th,
  Td,
  EmptyState,
  StatCard,
  Skeleton,
  SkeletonRow,
  SeatMapThumb,
} from "@/components";
import { useAuth } from "@/lib/auth/context";

const buildingInitials = (name: string) =>
  name
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const roomLabel = (room: Room) => `${room.building} ${room.room_number}`.trim();

/* Capacity tier used by the capacity bar + heatmap. */
function capacityTier(cap: number): "low" | "mid" | "high" {
  if (cap >= 120) return "high";
  if (cap >= 60) return "mid";
  return "low";
}

const TIER_BAR: Record<"low" | "mid" | "high", string> = {
  low: "bg-warning",
  mid: "bg-accent",
  high: "bg-violet",
};

function occupancyTier(pct: number): { bg: string; label: string } {
  if (pct >= 100) return { bg: "var(--danger)", label: "Full" };
  if (pct >= 66) return { bg: "var(--violet)", label: "High" };
  if (pct >= 33) return { bg: "var(--accent)", label: "Medium" };
  if (pct > 0) return { bg: "var(--success)", label: "Low" };
  return { bg: "var(--ink-3)", label: "Empty" };
}

export default function RoomsPage() {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [seatMap, setSeatMap] = useState<Record<string, Seat[]>>({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [view, setView] = useState<"grid" | "table">("grid");

  useEffect(() => {
    Promise.all([
      getRooms(1, 100),
      fetchSeats(),
    ])
      .then(([roomsRes, seats]) => {
        setRooms(roomsRes.rooms ?? []);
        setTotal(roomsRes.total ?? 0);
        setSeatMap(seats);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    async function fetchSeats(): Promise<Record<string, Seat[]>> {
      const res = await getRooms(1, 100);
      const list = res.rooms ?? [];
      const entries = await Promise.all(
        list.map((r) =>
          getRoomSeats(r.id)
            .then((s) => [r.id, s] as const)
            .catch(() => [r.id, [] as Seat[]] as const)
        )
      );
      return Object.fromEntries(entries);
    }
  }, []);

  const canCreate = user?.role === "ADMIN";

  const stats = useMemo(() => {
    const active = rooms.filter((r) => r.is_active);
    const totalCapacity = active.reduce(
      (acc, r) => acc + (r.capacity || 0),
      0
    );
    return {
      activeCount: active.length,
      inactiveCount: rooms.length - active.length,
      totalCapacity,
      maxCapacity: Math.max(1, ...rooms.map((r) => r.capacity || 0)),
    };
  }, [rooms]);

  const filteredRooms = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return rooms.filter((room) => {
      const matchesSearch =
        q.length === 0 ||
        room.building.toLowerCase().includes(q) ||
        String(room.room_number).toLowerCase().includes(q);
      const matchesStatus = showInactive || room.is_active;
      return matchesSearch && matchesStatus;
    });
  }, [rooms, searchQuery, showInactive]);

  // Occupancy derived from fetched seat assignments.
  const occupancy = useMemo(() => {
    const map: Record<string, { assigned: number; total: number; pct: number }> =
      {};
    for (const r of rooms) {
      const seats = seatMap[r.id] ?? [];
      const assigned = seats.filter((s) => s.status === "ASSIGNED").length;
      const total = seats.length;
      const pct = total > 0 ? Math.round((assigned / total) * 100) : 0;
      map[r.id] = { assigned, total, pct };
    }
    return map;
  }, [rooms, seatMap]);

  return (
    <div className="animate-fade-in space-y-6">
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-ink">Rooms</h1>
            {!loading && rooms.length > 0 && (
              <span className="tnum rounded-full border border-line bg-surface-2 px-2 py-0.5 text-xs font-medium text-ink-2">
                {total}
              </span>
            )}
          </div>
          <p className="tnum mt-1 text-sm text-ink-2">
            {total} room{total !== 1 ? "s" : ""} in the system
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center rounded-md border border-line bg-surface p-0.5">
            <button
              type="button"
              onClick={() => setView("grid")}
              aria-pressed={view === "grid"}
              className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-sm transition-colors ${
                view === "grid"
                  ? "bg-surface-hover text-ink"
                  : "text-ink-3 hover:text-ink"
              }`}
            >
              <LayoutGrid className="h-4 w-4" /> Grid
            </button>
            <button
              type="button"
              onClick={() => setView("table")}
              aria-pressed={view === "table"}
              className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-sm transition-colors ${
                view === "table"
                  ? "bg-surface-hover text-ink"
                  : "text-ink-3 hover:text-ink"
              }`}
            >
              <List className="h-4 w-4" /> Table
            </button>
          </div>
          {canCreate && (
            <Link href="/app/rooms/new">
              <Button>
                <Plus className="h-4 w-4" /> Create Room
              </Button>
            </Link>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-22 w-full" />
            ))}
          </div>
          <Skeleton className="h-10 w-full" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonRow key={i} lines={3} />
            ))}
          </div>
        </div>
      ) : rooms.length === 0 ? (
        <Card className="p-10">
          <EmptyState
            icon={<DoorOpen className="h-6 w-6 text-ink-3" />}
            title="No rooms yet"
            description="Create your first room to get started"
            action={
              canCreate ? (
                <Link href="/app/rooms/new">
                  <Button>
                    <Plus className="h-4 w-4" /> Create Room
                  </Button>
                </Link>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              icon={DoorOpen}
              label="Total Rooms"
              value={rooms.length}
              color="accent"
            />
            <StatCard
              icon={CheckCircle2}
              label="Active"
              value={stats.activeCount}
              color="success"
            />
            <StatCard
              icon={XCircle}
              label="Inactive"
              value={stats.inactiveCount}
              color={stats.inactiveCount > 0 ? "warning" : "neutral"}
            />
            <StatCard
              icon={Users}
              label="Total Capacity"
              value={stats.totalCapacity}
            />
          </div>

          {/* Occupancy heatmap */}
          <OccupancyHeatmap rooms={filteredRooms} occupancy={occupancy} />

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
              <input
                type="text"
                placeholder="Search rooms..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-md border border-line bg-surface px-3 py-1.5 pl-8 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>
            <button
              onClick={() => setShowInactive((v) => !v)}
              className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors ${
                showInactive
                  ? "border-line bg-surface-2 text-ink"
                  : "border-line bg-surface text-ink-3"
              }`}
            >
              <CheckCircle2 className="h-4 w-4" />
              Inactive
            </button>
            <span className="tnum ml-auto text-xs text-ink-3">
              {filteredRooms.length} of {rooms.length}
            </span>
          </div>

          {filteredRooms.length === 0 ? (
            <Card className="p-10">
              <EmptyState
                icon={<Search className="h-5 w-5 text-ink-3" />}
                title="No rooms match your search"
              />
            </Card>
          ) : view === "grid" ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredRooms.map((room) => (
                <RoomGridCard
                  key={room.id}
                  room={room}
                  seats={seatMap[room.id] ?? []}
                  occ={occupancy[room.id]}
                  maxCapacity={stats.maxCapacity}
                />
              ))}
            </div>
          ) : (
            <Card>
              <Table>
                <TableHead>
                  <Th>Room</Th>
                  <Th>Building</Th>
                  <Th>Capacity</Th>
                  <Th>Occupancy</Th>
                  <Th>Status</Th>
                </TableHead>
                <TableBody>
                  {filteredRooms.map((room) => {
                    const occ = occupancy[room.id];
                    const tier = capacityTier(room.capacity);
                    return (
                      <tr
                        key={room.id}
                        className="group transition-colors hover:bg-surface-hover"
                      >
                        <Td>
                          <div className="flex items-center gap-3">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-line bg-surface-2 text-[10px] font-bold uppercase tracking-wide text-accent">
                              {buildingInitials(room.building)}
                            </span>
                            <div>
                              <p className="font-medium text-ink">
                                {room.room_number}
                              </p>
                              <p className="text-xs text-ink-2">
                                {room.building}
                              </p>
                            </div>
                          </div>
                        </Td>
                        <Td>
                          <span className="inline-flex items-center gap-1.5 text-ink-2">
                            <Building2 className="h-3.5 w-3.5 text-ink-3" />
                            {room.building}
                          </span>
                        </Td>
                        <Td>
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-hover">
                              <div
                                className={`h-full rounded-full ${TIER_BAR[tier]}`}
                                style={{
                                  width: `${Math.round(
                                    (room.capacity / stats.maxCapacity) * 100
                                  )}%`,
                                }}
                              />
                            </div>
                            <span className="tnum text-ink-2">
                              {room.capacity}
                            </span>
                          </div>
                        </Td>
                        <Td>
                          {occ && occ.total > 0 ? (
                            <span className="tnum text-ink-2">
                              {occ.assigned}/{occ.total} ({occ.pct}%)
                            </span>
                          ) : (
                            <span className="text-xs text-ink-3">No seats</span>
                          )}
                        </Td>
                        <Td>
                          <Badge variant={room.is_active ? "success" : "default"}>
                            {room.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </Td>
                      </tr>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

/* ── Occupancy heatmap: each room is a colored cell by utilization ── */
function OccupancyHeatmap({
  rooms,
  occupancy,
}: {
  rooms: Room[];
  occupancy: Record<string, { assigned: number; total: number; pct: number }>;
}) {
  if (rooms.length === 0) return null;
  return (
    <Card>
      <div className="border-b border-line px-6 py-4">
        <h3 className="text-sm font-semibold text-ink">Occupancy heatmap</h3>
        <p className="mt-0.5 text-xs text-ink-3">
          Room utilization based on assigned seats
        </p>
      </div>
      <div className="px-6 py-5">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-8">
          {rooms.map((room) => {
            const occ = occupancy[room.id];
            const pct = occ?.pct ?? 0;
            const tier = occupancyTier(pct);
            return (
             <div
                 key={room.id}
                 title={`${roomLabel(room)} · ${pct}%`}
                 className="flex aspect-square flex-col items-center justify-center rounded-md text-center transition-transform hover:scale-[1.03]"
                 style={{ background: tier.bg }}
               >
               <span
                 className={`tnum text-xs font-semibold ${
                   pct >= 66 ? "text-white" : "text-ink"
                 }`}
               >
                 {pct}%
               </span>
               <span
                 className={`max-w-full truncate px-1 text-[10px] ${
                   pct >= 66 ? "text-white/80" : "text-ink-2"
                 }`}
               >
                 {room.room_number}
               </span>
             </div>
            );
          })}
        </div>
        {/* Legend */}
        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-ink-3">
          {[
            { bg: "var(--success)", label: "Low" },
            { bg: "var(--accent)", label: "Medium" },
            { bg: "var(--violet)", label: "High" },
            { bg: "var(--danger)", label: "Full" },
          ].map((l) => (
            <span key={l.label} className="inline-flex items-center gap-1.5">
              <span
                className="h-3 w-3 rounded"
                style={{ background: l.bg }}
              />
              {l.label}
            </span>
          ))}
        </div>
      </div>
    </Card>
  );
}

/* ── Room grid card with capacity bar + seat thumbnail ── */
function RoomGridCard({
  room,
  seats,
  occ,
  maxCapacity,
}: {
  room: Room;
  seats: Seat[];
  occ?: { assigned: number; total: number; pct: number };
  maxCapacity: number;
}) {
  const tier = capacityTier(room.capacity);
  return (
    <Card className="p-5 transition-shadow duration-200 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-line bg-surface-2 text-[11px] font-bold uppercase tracking-wide text-accent">
            {buildingInitials(room.building)}
          </span>
          <div className="min-w-0">
            <p className="font-medium text-ink">{room.room_number}</p>
            <p className="truncate text-xs text-ink-2">{room.building}</p>
          </div>
        </div>
        <Badge variant={room.is_active ? "success" : "default"}>
          {room.is_active ? "Active" : "Inactive"}
        </Badge>
      </div>

      {/* Capacity bar */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-xs text-ink-3">
          <span>Capacity</span>
          <span className="tnum text-ink-2">{room.capacity} seats</span>
        </div>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-hover">
          <div
            className={`h-full rounded-full transition-[width] duration-500 ${TIER_BAR[tier]}`}
            style={{
              width: `${Math.round((room.capacity / maxCapacity) * 100)}%`,
            }}
          />
        </div>
      </div>

      {/* Occupancy + seat thumbnail */}
      <div className="mt-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-ink-3">Occupancy</p>
          {occ && occ.total > 0 ? (
            <p className="tnum text-sm font-medium text-ink">
              {occ.assigned}/{occ.total}{" "}
              <span className="text-xs font-normal text-ink-3">
                ({occ.pct}%)
              </span>
            </p>
          ) : (
            <p className="text-sm text-ink-3">No seats</p>
          )}
        </div>
        <div className="rounded-md border border-line bg-surface-2 p-2">
          {seats.length > 0 ? (
            <SeatMapThumb seats={seats} maxCols={8} cell={8} gap={1.5} />
          ) : (
            <span className="text-[10px] text-ink-3">—</span>
          )}
        </div>
      </div>

      <Link
        href={`/app/rooms/${room.id}`}
        className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-accent hover:text-accent-strong"
      >
        View details <MapPin className="h-3.5 w-3.5" />
      </Link>
    </Card>
  );
}
