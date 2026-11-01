"use client";

import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { UserPlus, UsersRound, X } from "lucide-react";
import { addCoursePerson, getCoursePeople, removeCoursePerson, type CoursePerson } from "@/lib/api/courses";
import { ApiError, errorReference } from "@/lib/api/client";
import { Button } from "@/components/button";
import { Input } from "@/components/input";

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Administrator",
  STAFF: "Exam office",
  INSTRUCTOR: "Instructor",
  TA: "Teaching assistant",
};

/**
 * Instructors and TAs who can see this course, its exams and their students.
 * The exam office sees every course, so it is never listed here.
 */
export function CoursePeopleCard({ courseId, canManage }: { courseId: string; canManage: boolean }) {
  const [people, setPeople] = useState<CoursePerson[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getCoursePeople(courseId)
      .then((p) => { if (!cancelled) setPeople(p); })
      .catch((err) => {
        if (!cancelled) setLoadError(`People couldn't be loaded.${errorReference(err)}`);
      });
    return () => { cancelled = true; };
  }, [courseId]);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setAdding(true);
    try {
      const person = await addCoursePerson(courseId, email.trim());
      setPeople((list) => [...(list ?? []), person].sort((a, b) => a.email.localeCompare(b.email)));
      setEmail("");
      toast.success(`${person.email} can now see this course`);
    } catch (err) {
      toast.error(
        err instanceof ApiError && err.status === 409
          ? err.message
          : err instanceof ApiError && err.status === 422
            ? "Enter the email address the person signs in with."
            : `They couldn't be added. Try again.${errorReference(err)}`,
      );
    } finally {
      setAdding(false);
    }
  };

  const remove = async (person: CoursePerson) => {
    if (!confirm(`Remove ${person.email}? They will no longer see this course or its students.`)) return;
    setRemoving(person.id);
    try {
      await removeCoursePerson(courseId, person.id);
      setPeople((list) => (list ?? []).filter((p) => p.id !== person.id));
    } catch (err) {
      toast.error(`They couldn't be removed. Try again.${errorReference(err)}`);
    } finally {
      setRemoving(null);
    }
  };

  return (
    <section className="surface-card">
      <div className="border-b border-line px-5 py-3.5">
        <h2 className="text-sm font-semibold text-ink">People with access</h2>
        <p className="text-xs text-ink-3">
          Instructors and TAs listed here can see this course&apos;s exams and students. The exam office sees every
          course.
        </p>
      </div>

      {loadError ? (
        <p className="px-5 py-6 text-sm text-danger">{loadError}</p>
      ) : people === null ? (
        <div className="space-y-2 px-5 py-4">
          {Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-9 animate-pulse rounded-md bg-surface-2" />)}
        </div>
      ) : people.length === 0 ? (
        <div className="flex items-center gap-2.5 px-5 py-5 text-sm text-ink-3">
          <UsersRound className="h-4 w-4 shrink-0" />
          No instructors or TAs yet.
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {people.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-5 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{p.display_name ?? p.email}</p>
                <p className="truncate text-xs text-ink-3">
                  {p.display_name ? p.email : "Hasn't signed in yet"}
                  {p.role && ` · ${ROLE_LABEL[p.role] ?? p.role}`}
                </p>
              </div>
              {canManage && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(p)}
                  loading={removing === p.id}
                  aria-label={`Remove ${p.email}`}
                  title="Remove access"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canManage && (
        <form onSubmit={add} className="flex items-end gap-2 border-t border-line px-5 py-3.5">
          <div className="min-w-0 flex-1">
            <Input
              label="Add by sign-in email"
              type="email"
              value={email}
              placeholder="name@utoronto.ca"
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="off"
            />
          </div>
          <Button type="submit" variant="secondary" loading={adding} disabled={!email.trim()}>
            <UserPlus /> Add
          </Button>
        </form>
      )}
    </section>
  );
}
