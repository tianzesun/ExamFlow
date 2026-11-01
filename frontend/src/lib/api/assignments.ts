import { fetchApi } from "./client";

export interface Assignment {
  id: string;
  assignment_order: number;
  student_id: string;
  student_number: string;
  full_name: string;
  seat_code: string;
  seat_id: string;
  room_id: string;
  building: string;
  room_number: string;
  method: string;
  version: number;
  /** Paper version (A–D) the student writes */
  paper_version: string;
}

export interface AssignmentSummary {
  registered_students: number;
  assigned_students: number;
  unassigned_students: number;
  available_seats: number;
  unused_seats: number;
  rooms_used: number;
  room_details: { room_id: string; building: string; room_number: string; total_seats: number; used_seats: number; available_seats: number }[];
}

export interface AssignmentListResponse {
  assignments: Assignment[];
  total: number;
  page: number;
  page_size: number;
}

export interface ExamRoom {
  id: string;
  building: string;
  room_number: string;
  capacity: number;
}

export async function getExamRooms(examId: string): Promise<ExamRoom[]> {
  return fetchApi(`/api/exams/${examId}/assignments/rooms`);
}

export async function addExamRoom(examId: string, roomId: string): Promise<void> {
  await fetchApi(`/api/exams/${examId}/assignments/rooms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ room_id: roomId }),
  });
}

export async function removeExamRoom(examId: string, roomId: string): Promise<void> {
  await fetchApi(`/api/exams/${examId}/assignments/rooms/${roomId}`, { method: "DELETE" });
}

export async function getAssignmentSummary(examId: string): Promise<AssignmentSummary> {
  return fetchApi(`/api/exams/${examId}/assignments/summary`);
}

/** How automatic seating picks seats; applies to preview, confirm, regenerate and seat remaining. */
export interface SeatingRules {
  order: "student_number" | "name" | "random";
  spacing: "none" | "every_other_seat" | "every_other_seat_and_row";
  /** Students with accommodations sit here, and nobody else does */
  accommodation_room_id: string | null;
  /** Paper versions (1–4) alternated by seat so neighbours write different papers */
  versions: number;
}

export interface AssignmentPreview {
  students: number; rooms: number; available_seats: number; assigned: number; unused: number;
  /** Usable seats the spacing rule keeps empty */
  spaced_out_seats: number;
  accommodation_students: number;
  rules: SeatingRules;
  items: { assignment_order: number; student_number: string; full_name: string; building: string; room_number: string; seat_code: string; paper_version: string }[];
  has_more: boolean;
}

export async function getSeatingRules(examId: string): Promise<SeatingRules> {
  return fetchApi(`/api/exams/${examId}/assignments/rules`);
}

/** Save the rules; reshuffle draws a new random order. */
export async function saveSeatingRules(examId: string, rules: SeatingRules, reshuffle = false): Promise<SeatingRules> {
  return fetchApi(`/api/exams/${examId}/assignments/rules?reshuffle=${reshuffle}`, {
    method: "PUT",
    body: JSON.stringify(rules),
  });
}

export async function previewAssignment(examId: string): Promise<AssignmentPreview> {
  return fetchApi(`/api/exams/${examId}/assignments/preview`, { method: "POST" });
}

export async function confirmAssignment(examId: string): Promise<{ assigned: number; version: number; student_count: number }> {
  return fetchApi(`/api/exams/${examId}/assignments/confirm`, { method: "POST" });
}

export async function regenerateAssignment(examId: string): Promise<{ assigned: number; version: number; previous_count: number }> {
  return fetchApi(`/api/exams/${examId}/assignments/regenerate`, { method: "POST" });
}

export async function seatRemainingStudents(examId: string): Promise<{ assigned: number; version: number }> {
  return fetchApi(`/api/exams/${examId}/assignments/seat-remaining`, { method: "POST" });
}

export async function getAssignments(examId: string, opts?: { query?: string; room_id?: string; page?: number; page_size?: number }): Promise<AssignmentListResponse> {
  const params = new URLSearchParams();
  if (opts?.query) params.set("query", opts.query);
  if (opts?.room_id) params.set("room_id", opts.room_id);
  if (opts?.page) params.set("page", String(opts.page));
  if (opts?.page_size) params.set("page_size", String(opts.page_size));
  const qs = params.toString();
  return fetchApi(`/api/exams/${examId}/assignments${qs ? "?" + qs : ""}`);
}

export async function assignSeat(examId: string, studentId: string, seatId: string): Promise<Assignment> {
  return fetchApi(`/api/exams/${examId}/assignments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ student_id: studentId, seat_id: seatId }),
  });
}

export async function removeAssignment(examId: string, assignmentId: string): Promise<void> {
  await fetchApi(`/api/exams/${examId}/assignments/${assignmentId}`, { method: "DELETE" });
}

export interface SeatOccupant {
  assignment_id: string;
  student_id: string;
  student_number: string;
  full_name: string;
  method: string;
  paper_version: string;
}

export interface SeatMapSeat {
  id: string;
  seat_code: string;
  row_number: number | null;
  column_number: number | null;
  is_usable: boolean;
  /** Another exam at the same time has a student in this seat (its name) */
  taken_by: string | null;
  occupant: SeatOccupant | null;
}

export interface SeatMapRoom {
  id: string;
  building: string;
  room_number: string;
  capacity: number;
  rows: number;
  columns: number;
  /** An aisle follows each of these seat numbers */
  aisles_after: number[];
  usable_seats: number;
  occupied_seats: number;
  seats: SeatMapSeat[];
}

export interface UnassignedStudent {
  student_id: string;
  student_number: string;
  full_name: string;
}

export async function getSeatMap(examId: string): Promise<{ rooms: SeatMapRoom[] }> {
  return fetchApi(`/api/exams/${examId}/assignments/seat-map`);
}

export async function getUnassignedStudents(examId: string): Promise<{ students: UnassignedStudent[] }> {
  return fetchApi(`/api/exams/${examId}/assignments/unassigned`);
}

/** Seat a student. Empty seat: assign or move. Occupied seat: swap the two students. */
export async function moveStudent(
  examId: string,
  studentId: string,
  seatId: string,
): Promise<{ action: "assigned" | "moved" | "swapped" | "unchanged" }> {
  return fetchApi(`/api/exams/${examId}/assignments/move`, {
    method: "POST",
    body: JSON.stringify({ student_id: studentId, seat_id: seatId }),
  });
}
