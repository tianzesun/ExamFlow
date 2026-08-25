"use client";

import { DoorOpen, Users, Check } from "lucide-react";

interface Room {
  id: string;
  building: string;
  room_number: string;
  capacity: number;
  is_active: boolean;
  used_seats?: number;
  assigned_students?: number;
}

interface RoomCardProps {
  room: Room;
  isSelected?: boolean;
  onSelect?: (room: Room) => void;
  showMiniMap?: boolean;
}

export function RoomCard({
  room,
  isSelected = false,
  onSelect,
}: RoomCardProps) {
  const usedSeats = room.used_seats ?? 0;
  const capacity = room.capacity;
  const fillPercentage = capacity > 0 ? Math.round((usedSeats / capacity) * 100) : 0;

  return (
    <button
      onClick={() => onSelect?.(room)}
      className={`hoverable group relative w-full overflow-hidden rounded-md border p-4 text-left transition-colors ${
        isSelected ? "border-accent bg-accent-subtle" : "border-line bg-surface"
      }`}
    >
      {/* Selected indicator */}
      {isSelected && (
        <div className="absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent">
          <Check className="h-3 w-3 text-white" />
        </div>
      )}

      {/* Room icon */}
      <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-md border border-line bg-surface-2 ${
        isSelected ? "text-accent" : "text-ink-3"
      }`}>
        <DoorOpen className="h-4 w-4" />
      </div>

      {/* Room info */}
      <h3 className="truncate text-sm font-semibold text-ink">
        {room.building} {room.room_number}
      </h3>

      {/* Capacity */}
      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="text-ink-2">
          <Users className="mr-1 inline h-3 w-3 text-ink-3" />
          {usedSeats} / {capacity}
        </span>
        <span className="tnum font-medium text-ink">{fillPercentage}%</span>
      </div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-hover">
        <div
          className={`h-full transition-[width] duration-300 ${
            fillPercentage > 90 ? "bg-danger" : fillPercentage > 70 ? "bg-warning" : "bg-success"
          }`}
          style={{ width: `${fillPercentage}%` }}
        />
      </div>

      {/* Mini seat preview */}
      <div className="mt-3 grid grid-cols-5 gap-1">
        {Array.from({ length: Math.min(10, capacity) }).map((_, i) => (
          <div
            key={i}
            className={`h-1.5 rounded-sm ${
              i < usedSeats ? "bg-success" : "bg-surface-hover"
            }`}
          />
        ))}
      </div>

      {/* Status */}
      <div className="mt-3 flex items-center gap-1.5 text-xs text-ink-2">
        <span className={`h-1.5 w-1.5 rounded-full ${room.is_active ? "bg-success" : "bg-ink-3"}`} />
        {room.is_active ? "Active" : "Inactive"}
      </div>
    </button>
  );
}