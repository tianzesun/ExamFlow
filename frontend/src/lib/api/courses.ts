import { fetchApi } from "./client";
import type { Course, CourseListResponse } from "../types";
export interface CourseOption {
  value: string;
  label: string;
}

export async function getCoursesDropdown(): Promise<CourseOption[]> {
  const data = await getCourses(1, 200);
  return data.courses
    .map((c) => ({ value: String(c.id), label: `${c.course_code} ${c.course_name}`.trim() }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export async function getCourses(page = 1, pageSize = 50): Promise<CourseListResponse> {
  // The API caps page_size at 100. Aggregate all pages so callers always
  // receive the complete course list (requested page/size act as the start).
  const size = Math.min(pageSize, 100);
  const first = await fetchApi<CourseListResponse>(
    `/api/courses?page=${page}&page_size=${size}`
  );
  const courses = [...(first.courses ?? [])];
  let nextPage = page + 1;
  while (courses.length < first.total) {
    const res = await fetchApi<CourseListResponse>(
      `/api/courses?page=${nextPage}&page_size=${size}`
    );
    if (!res.courses || res.courses.length === 0) break;
    courses.push(...res.courses);
    nextPage += 1;
  }
  return { courses, total: first.total };
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
  data: { course_code?: string; course_name?: string; department?: string | null }
): Promise<Course> {
  return fetchApi<Course>(`/api/courses/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteCourse(id: string): Promise<void> {
  return fetchApi<void>(`/api/courses/${id}`, { method: "DELETE" });
}

/** An instructor or TA who can see a course. Name and role appear once they have signed in. */
export interface CoursePerson {
  id: string;
  email: string;
  display_name: string | null;
  role: string | null;
  added_at: string;
}

export async function getCoursePeople(courseId: string): Promise<CoursePerson[]> {
  return (await fetchApi<{ people: CoursePerson[] }>(`/api/courses/${courseId}/people`)).people;
}

export async function addCoursePerson(courseId: string, email: string): Promise<CoursePerson> {
  return fetchApi<CoursePerson>(`/api/courses/${courseId}/people`, {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function removeCoursePerson(courseId: string, accessId: string): Promise<void> {
  return fetchApi<void>(`/api/courses/${courseId}/people/${accessId}`, { method: "DELETE" });
}

/** What a course-access CSV would do (or did, once confirmed). */
export interface CourseAccessImport {
  added: number;
  already: number;
  errors: string[];
  /** The first rows being added */
  rows: { course_code: string; email: string }[];
}

export async function importCourseAccess(file: File, confirm: boolean): Promise<CourseAccessImport> {
  const form = new FormData();
  form.append("file", file);
  return fetchApi<CourseAccessImport>(`/api/courses/access/import?confirm=${confirm}`, { method: "POST", body: form });
}
