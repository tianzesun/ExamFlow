const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  if (response.status === 204) return null as T;
  return response.json();
}

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
