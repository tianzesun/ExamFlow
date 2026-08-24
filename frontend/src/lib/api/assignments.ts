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
  student_id: string;
  student_number: string;
  full_name: string;
  seat_code: string;
  seat_id: string;
  room_id: string;
  method: string;
}

export async function getAssignments(examId: string): Promise<Assignment[]> {
  return fetchApi(`/api/exams/${examId}/assignments`);
}

export async function assignSeat(
  examId: string,
  studentId: string,
  seatId: string
): Promise<Assignment> {
  return fetchApi(`/api/exams/${examId}/assignments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ student_id: studentId, seat_id: seatId }),
  });
}

export async function autoAssign(examId: string, roomId: string): Promise<{ assigned: number }> {
  return fetchApi(`/api/exams/${examId}/assignments/auto`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ room_id: roomId }),
  });
}

export async function removeAssignment(examId: string, assignmentId: string): Promise<void> {
  return fetchApi(`/api/exams/${examId}/assignments/${assignmentId}`, {
    method: "DELETE",
  });
}
