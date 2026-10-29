export interface Course {
  id: string;
  course_code: string;
  course_name: string;
  department: string | null;
  created_at: string;
  updated_at: string;
}

export interface CourseListResponse {
  courses: Course[];
  total: number;
}

export interface Exam {
  id: string;
  course_id: string;
  course_code: string;
  course_name: string | null;
  exam_name: string;
  term: string;
  academic_year: number;
  exam_date: string;
  start_time: string;
  duration_minutes: number;
  notes?: string | null;
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ExamListResponse {
  exams: Exam[];
  total: number;
  page: number;
  page_size: number;
}

export interface ExamStudent {
  id: string;
  exam_id: string;
  student_id: string;
  student_number: string;
  full_name: string;
  utorid?: string | null;
  email?: string | null;
  attendance_status?: AttendanceStatus;
  checked_in_at?: string | null;
  extra_time_minutes?: number;
  accommodation_notes?: string | null;
  created_at: string;
}

export type AttendanceStatus = "EXPECTED" | "PRESENT" | "ABSENT";

export enum ExamStatus {
  Draft = "DRAFT",
  AwaitingTemplate = "AWAITING_TEMPLATE",
  ReadyForSeating = "READY_FOR_SEATING",
  SeatingDone = "SEATING_DONE",
  Generated = "GENERATED",
}
