import { Course, CourseListResponse } from "../types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function getCourses(page = 1, pageSize = 50): Promise<CourseListResponse> {
  return fetchApi<CourseListResponse>(`/api/courses?page=${page}&page_size=${pageSize}`);
}

export async function getCourse(id: string): Promise<Course> {
  return fetchApi<Course>(`/api/courses/${id}`);
}

export async function createCourse(data: {
  course_code: string;
  course_name: string;
  department?: string;
}): Promise<Course> {
  return fetchApi<Course>("/api/courses", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateCourse(
  id: string,
  data: { course_code?: string; course_name?: string; department?: string }
): Promise<Course> {
  return fetchApi<Course>(`/api/courses/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}
