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
  capacity?: number;
  rows?: number;
  columns?: number;
  aisles_after?: number[];
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

export async function getRoom(roomId: string): Promise<Room> {
  return fetchApi(`/api/rooms/${roomId}`);
}

export async function updateRoom(
  roomId: string,
  data: Partial<Pick<Room, "building" | "room_number" | "is_active">>,
): Promise<Room> {
  return fetchApi(`/api/rooms/${roomId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export interface LayoutSeat {
  seat_code: string;
  row: number;
  column: number;
  is_usable: boolean;
  /** Exams with a student seated here, past or upcoming */
  exams: number;
  /** Upcoming exams with a student seated here */
  upcoming: number;
  /** Only when asked for an exam: another exam seats a student here at the same time */
  taken_by?: string | null;
}

export interface RoomLayout {
  rows: number;
  columns: number;
  /** An aisle follows each of these seat numbers */
  aisles_after: number[];
  seats: LayoutSeat[];
}

/** With examId, seats another exam uses at the same time carry taken_by. */
export async function getRoomLayout(roomId: string, examId?: string): Promise<RoomLayout> {
  return fetchApi(`/api/rooms/${roomId}/layout${examId ? `?exam_id=${encodeURIComponent(examId)}` : ""}`);
}

export async function saveRoomLayout(
  roomId: string,
  data: {
    rows: number;
    columns: number;
    aisles_after: number[];
    /** [row, seat] positions with no seat */
    missing: [number, number][];
    /** [row, seat] positions with a seat that isn't used for exams */
    blocked: [number, number][];
  },
): Promise<RoomLayout> {
  return fetchApi(`/api/rooms/${roomId}/layout`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

/** 1 → A, 27 → AA, matching the seat codes the server gives out. */
export function rowLabel(row: number): string {
  let label = "";
  while (row > 0) {
    const rem = (row - 1) % 26;
    label = String.fromCharCode(65 + rem) + label;
    row = Math.floor((row - 1) / 26);
  }
  return label;
}
