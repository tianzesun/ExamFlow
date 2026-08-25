"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, BookOpen } from "lucide-react";
import { getCourses } from "@/lib/api/courses";
import { Card, Button, Table, TableHead, TableBody, Th, Td, PageLoader, EmptyState } from "@/components";

export default function CoursesPage() {
  const [courses, setCourses] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCourses(1, 100)
      .then((d) => { setCourses(d.courses); setTotal(d.total); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-black dark:text-white">Courses</h1>
          <p className="text-sm text-zinc-500">{total} course{total !== 1 ? "s" : ""}</p>
        </div>
        <Link href="/app/courses/new">
          <Button><Plus className="h-4 w-4" /> Create Course</Button>
        </Link>
      </div>

      {loading ? (
        <PageLoader />
      ) : courses.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="h-6 w-6 text-zinc-400" />}
          title="No courses yet"
          description="Create your first course to get started"
          action={<Link href="/app/courses/new"><Button>Create Course</Button></Link>}
        />
      ) : (
        <Card>
          <Table>
            <TableHead>
              <Th>Code</Th>
              <Th>Name</Th>
              <Th>Department</Th>
            </TableHead>
            <TableBody>
              {courses.map((course) => (
                <tr key={course.id} className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                  <Td className="font-medium">{course.course_code}</Td>
                  <Td>{course.course_name}</Td>
                  <Td className="text-zinc-500">{course.department || "—"}</Td>
                </tr>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
