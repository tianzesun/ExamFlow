"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Plus,
  DoorOpen,
  Search,
  Building2,
  Users,
  MapPin,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { getRooms } from "@/lib/api/rooms";
import {
  Card,
  Badge,
  Button,
  Table,
  TableHead,
  TableBody,
  Th,
  Td,
  PageLoader,
  EmptyState,
  StatCard,
} from "@/components";
import { useAuth } from "@/lib/auth/context";

/* =============================== Types =============================== */
interface Room {
  id: string;
  building: string;
  room_number: string | number;
  capacity: number;
  is_active: boolean;
  note?: string | null;
}

/* ============================= Helpers ============================= */
const buildingInitials = (name: string) =>
  name
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const roomLabel = (room: Room) => `${room.building} ${room.room_number}`.trim();

/* ============================== Page ============================== */
export default function RoomsPage() {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showInactive, setShowInactive] = useState(true);

  useEffect(() => {
    getRooms(1, 100)
      .then((d) => {
        setRooms(d.rooms ?? []);
        setTotal(d.total ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const canCreate = user?.role === "ADMIN";

  /* Derived stats */
  const stats = useMemo(() => {
    const active = rooms.filter((r) => r.is_active);
    const totalCapacity = active.reduce((acc, r) => acc + (r.capacity || 0), 0);
    return {
      activeCount: active.length,
      inactiveCount: rooms.length - active.length,
      totalCapacity,
    };
  }, [rooms]);

  const filteredRooms = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return rooms.filter((room) => {
      const matchesSearch =
        q.length === 0 ||
        room.building.toLowerCase().includes(q) ||
        String(room.room_number).toLowerCase().includes(q);
      const matchesStatus = showInactive || !room.is_active === false;
      return matchesSearch;
    });
  }, [rooms, searchQuery, showInactive]);

  const capacityColor = (cap: number) =>
    cap >= 100 ? "success" : cap >= 50 ? "accent" : "default";

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
        {canCreate && (
          <Link href="/app/rooms/new">
            <Button>
              <Plus className="h-4 w-4" /> Create Room
            </Button>
          </Link>
        )}
      </div>

      {loading ? (
        <PageLoader />
      ) : rooms.length === 0 ? (
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

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
              <input
                type="text"
                placeholder="Search rooms..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-md border border-line bg-surface px-3 py-1.5 pl-8 text-sm text-ink transition-shadow placeholder:text-ink-3 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
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
              Active only
            </button>
            <span className="tnum ml-auto text-xs text-ink-3">
              {filteredRooms.length} of {rooms.length}
            </span>
          </div>

          {/* Rooms table */}
          <Card>
            <Table>
              <TableHead>
                <Th>Room</Th>
                <Th>Building</Th>
                <Th>Capacity</Th>
                <Th>Status</Th>
              </TableHead>
              <TableBody>
                {filteredRooms.length === 0 ? (
                  <tr>
                    <Td colSpan={4} className="py-12 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <Search className="h-5 w-5 text-ink-3" />
                        <p className="text-sm text-ink-2">
                          No rooms match your search
                        </p>
                      </div>
                    </Td>
                  </tr>
                ) : (
                  filteredRooms.map((room) => (
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
                            <p className="text-xs text-ink-2">{room.building}</p>
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
                        <span className="tnum inline-flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5 text-ink-3" />
                          <span className="font-medium text-ink">
                            {room.capacity}
                          </span>
                          <span className="text-xs text-ink-3">seats</span>
                        </span>
                      </Td>
                      <Td>
                        <Badge
                          variant={room.is_active ? "success" : "default"}
                        >
                          {room.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </Td>
                    </tr>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
}
