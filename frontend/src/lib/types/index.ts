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
