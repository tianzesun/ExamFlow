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

export async function previewAssignment(examId: string): Promise<{
  students: number; rooms: number; available_seats: number; assigned: number; unused: number;
  items: { assignment_order: number; student_number: string; full_name: string; building: string; room_number: string; seat_code: string }[];
  has_more: boolean;
}> {
  return fetchApi(`/api/exams/${examId}/assignments/preview`, { method: "POST" });
}

export async function confirmAssignment(examId: string): Promise<{ assigned: number; version: number; student_count: number; available_seats: number }> {
  return fetchApi(`/api/exams/${examId}/assignments/confirm`, { method: "POST" });
}

export async function regenerateAssignment(examId: string): Promise<{ assigned: number; version: number; previous_count: number }> {
  return fetchApi(`/api/exams/${examId}/assignments/regenerate`, { method: "POST" });
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
