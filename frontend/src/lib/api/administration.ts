import { fetchApi, API_BASE } from "./client";

export async function generateQr(examId: string): Promise<{ generated: number }> {
  return fetchApi<{ generated: number }>(`/api/exams/${examId}/qr/generate`, {
    method: "POST",
  });
}

export function getSignatureListUrl(examId: string, roomId: string): string {
  return `${API_BASE}/api/exams/${examId}/signature-list/${roomId}`;
}

/** Every seated student by name with their room and seat, as a printable PDF or a CSV. */
export function getSeatingListUrl(examId: string, format: "pdf" | "csv" = "pdf"): string {
  return `${API_BASE}/api/exams/${examId}/seating-list?format=${format}`;
}

export interface RoomDirection {
  room_id: string;
  room: string;
  students: number;
  accommodation: boolean;
  /** The only room for students without accommodations, so the sign needs no range. */
  everyone: boolean;
  /** Shortest labels that tell this room's students from the next room's, e.g. "A" to "Kim". */
  from: string | null;
  to: string | null;
}

/** Which students write in which room; by is null when rooms don't hold one block of names or numbers. */
export interface RoomDirections {
  by: "name" | "student_number" | null;
  rooms: RoomDirection[];
}

export async function getRoomDirections(examId: string): Promise<RoomDirections> {
  return fetchApi<RoomDirections>(`/api/exams/${examId}/room-directions`);
}

/** An entrance poster listing every room, then a door sign per room. */
export function getRoomSignsUrl(examId: string): string {
  return `${API_BASE}/api/exams/${examId}/room-signs`;
}

/** What a door sign says about who writes in the room. */
export function directionText(by: RoomDirections["by"], r: RoomDirection): string {
  if (r.accommodation) return "Students writing with accommodations";
  if (!r.students) return "No students";
  if (r.everyone) return "All students";
  if (r.from === null || r.to === null) return "Find your seat on the seating list";
  const what = by === "name" ? "Names" : "Student numbers";
  const dots = by === "student_number" ? "…" : "";
  return r.from === r.to ? `${what} ${r.from}${dots}` : `${what} ${r.from}${dots} to ${r.to}${dots}`;
}

export function getSeatingMapUrl(examId: string, roomId: string): string {
  return `${API_BASE}/api/exams/${examId}/seating-map/${roomId}`;
}

export async function generatePackage(examId: string): Promise<{ filename: string; size: number }> {
  return fetchApi<{ filename: string; size: number }>(`/api/exams/${examId}/package/generate`, {
    method: "POST",
  });
}

export function getPackageDownloadUrl(examId: string): string {
  return `${API_BASE}/api/exams/${examId}/package/download`;
}
