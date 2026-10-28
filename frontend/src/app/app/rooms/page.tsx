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
  LayoutGrid,
  List,
  Armchair,
} from "lucide-react";
import { getRooms, getRoomSeats, type Room, type Seat } from "@/lib/api/rooms";
import {
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
  PageContainer,
  PageHeader,
} from "@/components";
import { PageTransition } from "@/components/page-transition";
import { useAuth } from "@/lib/auth/context";
import { formatNumber, plural } from "@/lib/format";
import { cn } from "@/lib/utils";

type Occupancy = { assigned: number; total: number; pct: number };
type View = "grid" | "table";

const ALL_BUILDINGS = "__all__";

export default function RoomsPage() {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [seatMap, setSeatMap] = useState<Record<string, Seat[]>>({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [building, setBuilding] = useState(ALL_BUILDINGS);
  const [showInactive, setShowInactive] = useState(false);
  const [view, setView] = useState<View>("grid");

  useEffect(() => {
    Promise.all([getRooms(1, 100), fetchSeats()])
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

  // Occupancy derived from fetched seat assignments.
  const occupancy = useMemo(() => {
    const map: Record<string, Occupancy> = {};
    for (const r of rooms) {
      const seats = seatMap[r.id] ?? [];
      const assigned = seats.filter((s) => s.status === "ASSIGNED").length;
      const total = seats.length;
      const pct = total > 0 ? Math.round((assigned / total) * 100) : 0;
      map[r.id] = { assigned, total, pct };
    }
    return map;
  }, [rooms, seatMap]);

  const stats = useMemo(() => {
    const active = rooms.filter((r) => r.is_active);
    const totalCapacity = active.reduce((acc, r) => acc + (r.capacity || 0), 0);
    const buildings = new Set(rooms.map((r) => r.building)).size;
    let assigned = 0;
    let seats = 0;
    for (const r of active) {
      assigned += occupancy[r.id]?.assigned ?? 0;
      seats += occupancy[r.id]?.total ?? 0;
    }
    return {
      activeCount: active.length,
      inactiveCount: rooms.length - active.length,
      totalCapacity,
      buildings,
      assigned,
      seats,
    };
  }, [rooms, occupancy]);

  // Building options, most rooms first, then alphabetical.
  const buildingOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rooms) counts.set(r.building, (counts.get(r.building) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [rooms]);

  const filteredRooms = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return rooms
      .filter((room) => {
        const matchesSearch =
          q.length === 0 ||
          room.building.toLowerCase().includes(q) ||
          String(room.room_number).toLowerCase().includes(q) ||
          `${room.building} ${room.room_number}`.toLowerCase().includes(q);
        const matchesBuilding = building === ALL_BUILDINGS || room.building === building;
        const matchesStatus = showInactive || room.is_active;
        return matchesSearch && matchesBuilding && matchesStatus;
      })
      .sort(
        (a, b) =>
          a.building.localeCompare(b.building) ||
          String(a.room_number).localeCompare(String(b.room_number), undefined, { numeric: true })
      );
  }, [rooms, searchQuery, building, showInactive]);

  const hasFilters = searchQuery.trim() !== "" || building !== ALL_BUILDINGS;

  const createButton = canCreate ? (
    <Link href="/app/rooms/new">
      <Button>
        <Plus /> New room
      </Button>
    </Link>
  ) : undefined;

  return (
    <PageTransition>
      <PageContainer className="space-y-6">
        <PageHeader
          title="Rooms"
          meta={
            !loading && rooms.length > 0 ? (
              <span className="tnum rounded-md border border-line bg-surface-2 px-1.5 py-0.5 text-xs font-medium text-ink-2">
                {formatNumber(total)}
              </span>
            ) : undefined
          }
          description="Examination rooms, their capacity and current seat assignments."
          actions={createButton}
        />

        {loading ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-[104px] w-full rounded-xl" />
              ))}
            </div>
            <Skeleton className="h-9 w-full rounded-lg" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-[120px] w-full rounded-xl" />
              ))}
            </div>
          </div>
        ) : rooms.length === 0 ? (
          <div className="surface-card">
            <EmptyState
              icon={<DoorOpen className="h-5 w-5 text-ink-3" />}
              title="No rooms yet"
              description="Add an examination room to start planning seating."
              action={createButton}
            />
          </div>
        ) : (
          <>
            {/* KPI tiles */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard
                icon={DoorOpen}
                label="Rooms"
                value={rooms.length}
                color="accent"
                hint={plural(stats.inactiveCount, "inactive room")}
              />
              <StatCard
                icon={CheckCircle2}
                label="Active"
                value={stats.activeCount}
                color="success"
                hint={`${Math.round((stats.activeCount / Math.max(1, rooms.length)) * 100)}% of all rooms`}
                progress={stats.activeCount / Math.max(1, rooms.length)}
              />
              <StatCard
                icon={Building2}
                label="Buildings"
                value={stats.buildings}
                color="violet"
                hint="With at least one room"
              />
              <StatCard
                icon={Users}
                label="Active capacity"
                value={formatNumber(stats.totalCapacity)}
                hint={
                  stats.seats > 0
                    ? `${formatNumber(stats.assigned)} of ${plural(stats.seats, "seat")} assigned`
                    : "No seats assigned yet"
                }
              />
            </div>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
                <input
                  type="search"
                  aria-label="Search rooms"
                  placeholder="Search building or room…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 w-full rounded-lg border border-line-strong bg-surface pl-8 pr-3 text-sm text-ink shadow-[var(--shadow-sm)] placeholder:text-ink-3 hover:border-ink-3/50 focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15"
                />
              </div>
              <select
                aria-label="Filter by building"
                value={building}
                onChange={(e) => setBuilding(e.target.value)}
                className="h-9 max-w-[14rem] rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink shadow-[var(--shadow-sm)] hover:border-ink-3/50 focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15 [&>option]:bg-surface"
              >
                <option value={ALL_BUILDINGS}>All buildings</option>
                {buildingOptions.map(([name, count]) => (
                  <option key={name} value={name}>
                    {name} ({count})
                  </option>
                ))}
              </select>
              <label className="inline-flex h-9 cursor-pointer select-none items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink-2 shadow-[var(--shadow-sm)] hover:bg-surface-hover">
                <input
                  type="checkbox"
                  checked={showInactive}
                  onChange={(e) => setShowInactive(e.target.checked)}
                  className="h-3.5 w-3.5 accent-[var(--accent)]"
                />
                Show inactive
                {stats.inactiveCount > 0 && (
                  <span className="tnum text-xs text-ink-3">{stats.inactiveCount}</span>
                )}
              </label>

              <div className="ml-auto flex items-center gap-3">
                <span className="tnum hidden text-xs text-ink-3 sm:inline">
                  {formatNumber(filteredRooms.length)} of {formatNumber(rooms.length)}
                </span>
                <SegmentedView value={view} onChange={setView} />
              </div>
            </div>

            {filteredRooms.length === 0 ? (
              <div className="surface-card">
                <EmptyState
                  icon={<Search className="h-5 w-5 text-ink-3" />}
                  title="No rooms match these filters"
                  description="Try a different search term or building."
                  action={
                    hasFilters ? (
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setSearchQuery("");
                          setBuilding(ALL_BUILDINGS);
                        }}
                      >
                        Clear filters
                      </Button>
                    ) : undefined
                  }
                />
              </div>
            ) : view === "grid" ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {filteredRooms.map((room) => (
                  <RoomGridCard key={room.id} room={room} occ={occupancy[room.id]} />
                ))}
              </div>
            ) : (
              <div className="surface-card overflow-hidden">
                <Table>
                  <TableHead>
                    <Th>Room</Th>
                    <Th>Building</Th>
                    <Th>Capacity</Th>
                    <Th>Seats assigned</Th>
                    <Th>Status</Th>
                  </TableHead>
                  <TableBody>
                    {filteredRooms.map((room) => {
                      const occ = occupancy[room.id];
                      return (
                        <tr key={room.id}>
                          <Td>
                            <span className="font-mono text-xs font-medium text-ink">
                              {room.room_number}
                            </span>
                          </Td>
                          <Td>
                            <span className="text-ink-2">{room.building}</span>
                          </Td>
                          <Td>
                            <span className="tnum text-ink">{formatNumber(room.capacity)}</span>
                          </Td>
                          <Td>
                            <div className="flex items-center gap-2.5">
                              <UtilisationBar occ={occ} className="w-24" />
                              <span className="tnum text-xs text-ink-2">
                                {occ && occ.total > 0
                                  ? `${formatNumber(occ.assigned)}/${formatNumber(occ.total)}`
                                  : "—"}
                              </span>
                            </div>
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
              </div>
            )}
          </>
        )}
      </PageContainer>
    </PageTransition>
  );
}

/* ── Grid / Table segmented control ── */
function SegmentedView({ value, onChange }: { value: View; onChange: (v: View) => void }) {
  const options: { value: View; label: string; icon: typeof List }[] = [
    { value: "grid", label: "Grid", icon: LayoutGrid },
    { value: "table", label: "Table", icon: List },
  ];
  return (
    <div
      role="radiogroup"
      aria-label="View"
      className="inline-flex h-9 items-center rounded-lg border border-line-strong bg-surface-2 p-0.5"
    >
      {options.map((o) => {
        const active = value === o.value;
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex h-full items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors",
              active
                ? "bg-surface text-ink shadow-[var(--shadow-sm)] ring-1 ring-line"
                : "text-ink-3 hover:text-ink"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ── Slim utilisation bar; neutral track when nothing is assigned ── */
function UtilisationBar({ occ, className }: { occ?: Occupancy; className?: string }) {
  const pct = occ && occ.total > 0 ? occ.pct : 0;
  const colour = pct >= 100 ? "bg-danger" : pct >= 80 ? "bg-warning" : "bg-accent";
  return (
    <div
      className={cn("h-1.5 overflow-hidden rounded-full bg-surface-hover", className)}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-label="Seat utilisation"
    >
      {pct > 0 && (
        <div
          className={cn("h-full rounded-full transition-[width] duration-500", colour)}
          style={{ width: `${Math.max(4, Math.min(100, pct))}%` }}
        />
      )}
    </div>
  );
}

/* ── Compact room card ── */
function RoomGridCard({ room, occ }: { room: Room; occ?: Occupancy }) {
  const hasSeats = !!occ && occ.total > 0;
  return (
    <div className={cn("surface-card flex flex-col p-4", !room.is_active && "opacity-70")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-mono text-sm font-semibold text-ink">{room.room_number}</p>
          <p className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-ink-2">
            <Building2 className="h-3 w-3 shrink-0 text-ink-3" />
            <span className="truncate">{room.building}</span>
          </p>
        </div>
        {room.is_active ? (
          <span className="inline-flex shrink-0 items-center gap-1.5 text-[11px] font-medium text-ink-2">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            Active
          </span>
        ) : (
          <Badge>Inactive</Badge>
        )}
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div className="flex items-center gap-1.5 text-xs text-ink-3">
          <Armchair className="h-3.5 w-3.5" />
          <span className="tnum font-medium text-ink">{formatNumber(room.capacity)}</span>
          {room.capacity === 1 ? "seat" : "seats"}
        </div>
        <span className="tnum text-[11px] text-ink-3">
          {hasSeats && occ.assigned > 0 ? `${occ.pct}% assigned` : "Unassigned"}
        </span>
      </div>
      <UtilisationBar occ={occ} className="mt-2 w-full" />
    </div>
  );
}
