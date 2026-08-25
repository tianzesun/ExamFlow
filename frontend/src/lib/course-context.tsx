"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { getCourses } from "@/lib/api/courses";
import type { Course } from "@/lib/types";

interface CourseContextValue {
  courses: Course[];
  selectedCourseId: string | null;
  setSelectedCourseId: (id: string | null) => void;
  loading: boolean;
}

const CourseContext = createContext<CourseContextValue | null>(null);

export function CourseProvider({ children }: { children: ReactNode }) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getCourses(1, 100)
      .then((data) => {
        if (active) setCourses(data.courses);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <CourseContext.Provider
      value={{ courses, selectedCourseId, setSelectedCourseId, loading }}
    >
      {children}
    </CourseContext.Provider>
  );
}

export function useCourseContext() {
  const ctx = useContext(CourseContext);
  if (!ctx) {
    throw new Error("useCourseContext must be used within a CourseProvider");
  }
  return ctx;
}
