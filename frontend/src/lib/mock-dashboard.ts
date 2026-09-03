import type { Course, Exam } from "./types";
import type { ExamSummary } from "./api/readiness";

/**
 * Realistic seed data used to render the dashboard like a shipped product
 * when the backend has not yet been populated (or is unreachable). Only used
 * as a fallback — live data always takes precedence.
 */

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export const MOCK_COURSES: Array<
  Pick<Course, "id" | "course_code" | "course_name" | "department">
> = [
  { id: "c-MAT2015", course_code: "MAT 2015", course_name: "Data Structures & Algorithms", department: "Computer Science" },
  { id: "c-STAT2200", course_code: "STAT 2200", course_name: "Statistical Modelling", department: "Mathematics" },
  { id: "c-PHYS3110", course_code: "PHYS 3110", course_name: "Introductory Physics", department: "Physics" },
  { id: "c-CHEM1150", course_code: "CHEM 1150", course_name: "Organic Chemistry", department: "Chemistry" },
  { id: "c-WRIT3500", course_code: "WRIT 3500", course_name: "Technical Writing", department: "English" },
];

type MockExam = Omit<Exam, "course_id"> & { course_id: string };

export const MOCK_EXAMS: MockExam[] = [
  {
    id: "e-M1a", course_id: "c-MAT2015", course_code: "MAT 2015", course_name: "Data Structures & Algorithms",
    exam_name: "Midterm Examination", term: "W25", academic_year: 2025,
    exam_date: daysFromNow(-58), start_time: "09:00", duration_minutes: 120, status: "COMPLETED",
    created_by: "demo", created_at: daysFromNow(-130), updated_at: daysFromNow(-58),
  },
  {
    id: "e-M1b", course_id: "c-MAT2015", course_code: "MAT 2015", course_name: "Data Structures & Algorithms",
    exam_name: "Final Examination", term: "W25", academic_year: 2025,
    exam_date: daysFromNow(3), start_time: "09:00", duration_minutes: 180, status: "READY",
    created_by: "demo", created_at: daysFromNow(-60), updated_at: daysFromNow(-3),
  },
  {
    id: "e-M1c", course_id: "c-MAT2015", course_code: "MAT 2015", course_name: "Data Structures & Algorithms",
    exam_name: "W25 Re-sit", term: "W25", academic_year: 2025,
    exam_date: daysFromNow(28), start_time: "13:00", duration_minutes: 120, status: "DRAFT",
    created_by: "demo", created_at: daysFromNow(-5), updated_at: daysFromNow(-5),
  },
  {
    id: "e-S2a", course_id: "c-STAT2200", course_code: "STAT 2200", course_name: "Statistical Modelling",
    exam_name: "Midterm Assessment", term: "F24", academic_year: 2024,
    exam_date: daysFromNow(-12), start_time: "10:00", duration_minutes: 90, status: "COMPLETED",
    created_by: "demo", created_at: daysFromNow(-50), updated_at: daysFromNow(-12),
  },
  {
    id: "e-S2b", course_id: "c-STAT2200", course_code: "STAT 2200", course_name: "Statistical Modelling",
    exam_name: "Final Examination", term: "W25", academic_year: 2025,
    exam_date: daysFromNow(7), start_time: "09:30", duration_minutes: 150, status: "GENERATED",
    created_by: "demo", created_at: daysFromNow(-40), updated_at: daysFromNow(-2),
  },
  {
    id: "e-S2c", course_id: "c-STAT2200", course_code: "STAT 2200", course_name: "Statistical Modelling",
    exam_name: "Lab Practical", term: "W25", academic_year: 2025,
    exam_date: daysFromNow(26), start_time: "14:00", duration_minutes: 60, status: "CONFIGURED",
    created_by: "demo", created_at: daysFromNow(-8), updated_at: daysFromNow(-6),
  },
  {
    id: "e-P3a", course_id: "c-PHYS3110", course_code: "PHYS 3110", course_name: "Introductory Physics",
    exam_name: "Midterm Examination", term: "W25", academic_year: 2025,
    exam_date: daysFromNow(2), start_time: "09:00", duration_minutes: 120, status: "GENERATED",
    created_by: "demo", created_at: daysFromNow(-55), updated_at: daysFromNow(-1),
  },
  {
    id: "e-P3b", course_id: "c-PHYS3110", course_code: "PHYS 3110", course_name: "Introductory Physics",
    exam_name: "Laboratory Assessment", term: "W25", academic_year: 2025,
    exam_date: daysFromNow(20), start_time: "11:00", duration_minutes: 90, status: "CONFIGURED",
    created_by: "demo", created_at: daysFromNow(-10), updated_at: daysFromNow(-7),
  },
  {
    id: "e-C4a", course_id: "c-CHEM1150", course_code: "CHEM 1150", course_name: "Organic Chemistry",
    exam_name: "Term Examination", term: "F24", academic_year: 2024,
    exam_date: daysFromNow(-20), start_time: "09:00", duration_minutes: 150, status: "COMPLETED",
    created_by: "demo", created_at: daysFromNow(-70), updated_at: daysFromNow(-20),
  },
  {
    id: "e-C4b", course_id: "c-CHEM1150", course_code: "CHEM 1150", course_name: "Organic Chemistry",
    exam_name: "Final Examination", term: "W25", academic_year: 2025,
    exam_date: daysFromNow(5), start_time: "09:00", duration_minutes: 180, status: "READY",
    created_by: "demo", created_at: daysFromNow(-35), updated_at: daysFromNow(-4),
  },
  {
    id: "e-W5a", course_id: "c-WRIT3500", course_code: "WRIT 3500", course_name: "Technical Writing",
    exam_name: "Portfolio Review", term: "W25", academic_year: 2025,
    exam_date: daysFromNow(10), start_time: "10:00", duration_minutes: 60, status: "READY",
    created_by: "demo", created_at: daysFromNow(-25), updated_at: daysFromNow(-9),
  },
  {
    id: "e-W5b", course_id: "c-WRIT3500", course_code: "WRIT 3500", course_name: "Technical Writing",
    exam_name: "Final Assessment", term: "W25", academic_year: 2025,
    exam_date: daysFromNow(34), start_time: "13:00", duration_minutes: 90, status: "DRAFT",
    created_by: "demo", created_at: daysFromNow(-3), updated_at: daysFromNow(-3),
  },
];

const summarize = (
  roster: number,
  assigned: number,
  room: number,
  hasTemplate: boolean
): ExamSummary => ({
  roster_count: roster,
  assigned_count: assigned,
  unassigned_count: roster - assigned,
  room_count: room,
  generated_count: assigned,
  qr_count: roster,
  has_template: hasTemplate,
  template_version: hasTemplate ? 1 : null,
});

export const MOCK_SUMMARIES: Record<string, ExamSummary> = {
  "e-M1a": summarize(120, 120, 4, true),
  "e-M1b": summarize(120, 104, 5, true),
  "e-M1c": summarize(0, 0, 0, false),
  "e-S2a": summarize(80, 80, 3, true),
  "e-S2b": summarize(80, 72, 3, true),
  "e-S2c": summarize(0, 0, 1, false),
  "e-P3a": summarize(150, 142, 6, true),
  "e-P3b": summarize(0, 0, 2, false),
  "e-C4a": summarize(95, 95, 4, true),
  "e-C4b": summarize(95, 88, 4, true),
  "e-W5a": summarize(60, 51, 2, true),
  "e-W5b": summarize(0, 0, 0, false),
};

/** Exam records cast to the full `Exam` shape expected by the dashboard. */
export const MOCK_EXAMS_FULL: Exam[] = MOCK_EXAMS.map((e) => ({ ...e }));