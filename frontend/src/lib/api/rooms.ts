import { fetchApi } from "./client";

export interface Room {
  id: string;
  building: string;
  room_number: string;
  capacity: number;
  is_active: boolean;
}

export interface Seat {
  id: string;
  seat_code: string;
  row_number: number | null;
  column_number: number | null;
  status: string;
}

export async function getRooms(page = 1, pageSize = 50): Promise<{ rooms: Room[]; total: number }> {
  return fetchApi(`/api/rooms?page=${page}&page_size=${pageSize}`);
}

/** Every room, fetched page by page (the API caps pages at 100). */
export async function getAllRooms(): Promise<{ rooms: Room[]; total: number }> {
  const first = await getRooms(1, 100);
  const pages = Math.ceil(first.total / 100);
  const rest = await Promise.all(Array.from({ length: Math.max(0, pages - 1) }, (_, i) => getRooms(i + 2, 100)));
  return { rooms: [first, ...rest].flatMap((r) => r.rooms), total: first.total };
}

export async function createRoom(data: {
  building: string;
  room_number: string;
  capacity: number;
}): Promise<Room> {
  return fetchApi("/api/rooms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function getRoomSeats(roomId: string): Promise<Seat[]> {
  return fetchApi(`/api/rooms/${roomId}/seats`);
}

export async function deleteRoom(roomId: string): Promise<void> {
  return fetchApi(`/api/rooms/${roomId}`, { method: "DELETE" });
}

export interface RoomUsage {
  seats: number;
  blocked: number;
  /** Upcoming exams with students seated in this room */
  upcoming_exams: number;
  /** Most students seated here for any one upcoming exam */
  peak_assigned: number;
}

export async function getRoomUsage(): Promise<Record<string, RoomUsage>> {
  return fetchApi(`/api/rooms/usage`);
}
