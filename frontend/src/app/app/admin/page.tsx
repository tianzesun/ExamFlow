"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, History, ShieldCheck, Users } from "lucide-react";
import { useAuth } from "@/lib/auth/context";
import { errorReference } from "@/lib/api/client";
import { getActivity, getAdminUsers, setUserActive, type ActivityEntry, type ActivityPage, type AdminUser } from "@/lib/api/admin";
import { Badge, Button, PageContainer, PageHeader, Skeleton, Table, TableBody, TableHead, Td, Th } from "@/components";
import { formatDateTime, formatNumber, plural } from "@/lib/format";
import { cn } from "@/lib/utils";

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Administrator",
  STAFF: "Exam office",
  INSTRUCTOR: "Instructor",
  TA: "Teaching assistant",
};

const CATEGORY_LABEL: Record<string, string> = {
  access: "Sign-in and access",
  courses_exams: "Courses and exams",
  students: "Students",
  seating: "Seating",
  papers: "Exam papers",
  exam_day: "Exam day",
  rooms: "Rooms",
  other: "Other",
};

/** Plain-language names for audit actions; anything new falls back to a tidied action code. */
const ACTION_LABEL: Record<string, string> = {
  USER_PROVISIONED: "Signed in for the first time",
  USER_SIGNED_IN: "Signed in",
  USER_SIGNED_OUT: "Signed out",
  USER_SIGN_IN_REFUSED: "Was refused sign-in",
  USER_ROLE_CHANGED: "Role changed in Entra",
  USER_ACTIVATED: "Switched a person on",
  USER_DEACTIVATED: "Switched a person off",
  COURSE_ACCESS_GRANTED: "Gave course access",
  COURSE_ACCESS_REVOKED: "Removed course access",
  COURSE_CREATED: "Created a course",
  COURSE_UPDATED: "Edited a course",
  COURSE_DELETED: "Deleted a course",
  TIMETABLE_SYNCED: "Synced courses from the Timetable Builder",
  EXAM_CREATED: "Created an exam",
  EXAM_UPDATED: "Edited an exam",
  EXAM_DELETED: "Deleted an exam",
  EXAM_STATUS_CHANGED: "Changed the exam status",
  EXAM_STATUS_AUTO_UPDATED: "Exam status updated",
  ROSTER_IMPORTED: "Imported students",
  STUDENT_REMOVED_FROM_ROSTER: "Removed a student",
  ACCOMMODATION_UPDATED: "Changed accommodations",
  EXAM_ROOM_ADDED: "Added a room to an exam",
  EXAM_ROOM_REMOVED: "Removed a room from an exam",
  SEATING_RULES_UPDATED: "Changed seating rules",
  SEATING_ASSIGNMENT_CREATED: "Seated students",
  SEATING_ASSIGNMENT_REGENERATED: "Reseated everyone",
  SEATING_REMAINING_ASSIGNED: "Seated remaining students",
  SEAT_ASSIGNED: "Seated a student",
  SEAT_UNASSIGNED: "Unseated a student",
  EXAM_TEMPLATE_UPLOADED: "Uploaded an exam paper",
  EXAM_TEMPLATE_ACTIVATED: "Switched to another paper revision",
  EXAM_TEMPLATE_ARCHIVED: "Archived a paper revision",
  PERSONALIZED_EXAMS_GENERATION_COMPLETED: "Generated papers",
  PRINT_FILE_DOWNLOADED: "Downloaded papers for printing",
  PAPER_DOWNLOADED: "Downloaded a student's paper",
  TEMPLATE_DOWNLOADED: "Downloaded an exam paper upload",
  EXAM_DAY_DOCUMENT_DOWNLOADED: "Downloaded an exam-day document",
  QR_GENERATED: "Created QR codes",
  QR_VERIFIED: "Paper QR code checked",
  QR_VERIFY_FAILED: "Unknown QR code checked",
  EXAM_PACKAGE_GENERATED: "Built the exam-day package",
  ATTENDANCE_RECORDED: "Recorded attendance",
  ROOM_CREATED: "Created a room",
  ROOM_UPDATED: "Edited a room",
  ROOM_LAYOUT_UPDATED: "Changed a room layout",
  ROOM_DELETED: "Deleted a room",
};

function actionLabel(action: string): string {
  return ACTION_LABEL[action] ?? action.toLowerCase().replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

const ENTITY_LABEL: Record<string, string> = {
  exam: "Exam",
  course: "Course",
  room: "Room",
  user: "Person",
  exam_assignment: "Seat",
  exam_template: "Exam paper",
  generated_exam: "Paper",
};

/** A refused UTORid sign-in has no ExamFlow user; the email says who tried. */
function refusedEmail(entry: ActivityEntry): string | null {
  const email = entry.action === "USER_SIGN_IN_REFUSED" ? entry.new_values?.email : null;
  return typeof email === "string" && email ? email : null;
}

/** "key: value" pairs from the change, for the details line. */
function details(entry: ActivityEntry): string {
  const show = (v: unknown) => (v === null || v === undefined ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v));
  const parts: string[] = [];
  const before = entry.old_values ?? {};
  const after = entry.new_values ?? {};
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const name = key.replace(/_/g, " ");
    if (key in before && key in after && before[key] !== after[key]) parts.push(`${name}: ${show(before[key])} → ${show(after[key])}`);
    else parts.push(`${name}: ${show(key in after ? after[key] : before[key])}`);
  }
  return parts.join(" · ");
}

export default function AdminPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<"people" | "activity">("people");

  useEffect(() => {
    if (user && user.role !== "ADMIN") router.push("/app");
  }, [user, router]);

  if (!user || user.role !== "ADMIN") return null;

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Admin"
        description="Who uses ExamFlow, and a record of everything done in it."
        meta={<Badge variant="violet"><ShieldCheck className="h-3 w-3" /> Admin only</Badge>}
      />

      <div className="inline-flex rounded-lg border border-line bg-surface p-1" role="tablist">
        {([
          ["people", "People", Users],
          ["activity", "Activity", History],
        ] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              tab === key ? "bg-surface-hover text-ink" : "text-ink-3 hover:text-ink",
            )}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {tab === "people" ? <PeopleCard myId={user.id} /> : <ActivityCard />}
    </PageContainer>
  );
}

function PeopleCard({ myId }: { myId: string }) {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    getAdminUsers()
      .then(setUsers)
      .catch((err) => setError(`People couldn't be loaded. Try again in a moment.${errorReference(err)}`));
  }, []);

  const toggle = async (u: AdminUser) => {
    if (u.is_active && !confirm(`Switch off ${u.display_name}? They can't use ExamFlow until you switch them back on, whatever their role in Entra.`)) return;
    setBusy(u.id);
    try {
      const updated = await setUserActive(u.id, !u.is_active);
      setUsers((list) => list?.map((x) => (x.id === u.id ? updated : x)) ?? null);
    } catch (err) {
      toast.error(`That didn't work. Try again.${errorReference(err)}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="surface-card overflow-hidden">
      <div className="border-b border-line px-5 py-3.5">
        <h2 className="text-sm font-semibold text-ink">People</h2>
        <p className="text-xs text-ink-3">
          Everyone who has signed in. Roles come from Entra; course access is set on each course&apos;s page.
          Switching someone off blocks them in ExamFlow straight away.
        </p>
      </div>
      {error ? (
        <p className="px-5 py-6 text-sm text-danger">{error}</p>
      ) : users === null ? (
        <div className="space-y-2 p-5">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
      ) : (
        <Table>
          <TableHead>
            <Th>Name</Th>
            <Th>Role</Th>
            <Th className="hidden md:table-cell">Signs in with</Th>
            <Th className="hidden lg:table-cell">Courses</Th>
            <Th className="hidden lg:table-cell">First signed in</Th>
            <Th className="text-right">Access</Th>
          </TableHead>
          <TableBody>
            {users.map((u) => (
              <tr key={u.id} className={cn(!u.is_active && "opacity-60")}>
                <Td>
                  <p className="font-medium text-ink">{u.display_name}</p>
                  <p className="text-xs text-ink-3">{u.email ?? "No email"}</p>
                </Td>
                <Td><Badge variant={u.role === "ADMIN" ? "violet" : u.role === "STAFF" ? "info" : "default"}>{ROLE_LABEL[u.role] ?? u.role}</Badge></Td>
                <Td className="hidden text-xs text-ink-2 md:table-cell">{u.source}</Td>
                <Td className="tnum hidden text-xs text-ink-2 lg:table-cell">
                  {u.role === "ADMIN" || u.role === "STAFF" ? "All" : formatNumber(u.courses)}
                </Td>
                <Td className="tnum hidden text-xs text-ink-2 lg:table-cell">{formatDateTime(u.first_signed_in)}</Td>
                <Td className="py-1.5 text-right">
                  <span className="inline-flex items-center gap-2">
                    <Badge variant={u.is_active ? "success" : "danger"}>{u.is_active ? "On" : "Switched off"}</Badge>
                    {u.id !== myId && (
                      <Button size="sm" variant="ghost" onClick={() => toggle(u)} loading={busy === u.id}>
                        {u.is_active ? "Switch off" : "Switch on"}
                      </Button>
                    )}
                  </span>
                </Td>
              </tr>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}

function ActivityCard() {
  const [category, setCategory] = useState("");
  const [person, setPerson] = useState("");
  const [day, setDay] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ActivityPage | null>(null);
  const [people, setPeople] = useState<AdminUser[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAdminUsers().then(setPeople).catch(() => setPeople([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    getActivity({ category: category || undefined, user_id: person || undefined, day: day || undefined, page })
      .then((d) => { if (!cancelled) { setData(d); setError(null); } })
      .catch((err) => { if (!cancelled) setError(`Activity couldn't be loaded. Try again in a moment.${errorReference(err)}`); });
    return () => { cancelled = true; };
  }, [category, person, day, page]);

  const filterClass =
    "h-9 rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15";
  const pages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;

  return (
    <section className="surface-card overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-line px-5 py-3.5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-ink">Activity</h2>
          <p className="text-xs text-ink-3">
            {data ? `${plural(data.total, "entry", "entries")}, newest first` : "Every change, download and QR check, newest first"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select aria-label="What" className={filterClass} value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}>
            <option value="">Everything</option>
            {Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select aria-label="Who" className={filterClass} value={person} onChange={(e) => { setPerson(e.target.value); setPage(1); }}>
            <option value="">Anyone</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.display_name}</option>)}
          </select>
          <input aria-label="Day" type="date" className={filterClass} value={day} onChange={(e) => { setDay(e.target.value); setPage(1); }} />
        </div>
      </div>

      {error ? (
        <p className="px-5 py-6 text-sm text-danger">{error}</p>
      ) : data === null ? (
        <div className="space-y-2 p-5">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
      ) : data.entries.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-ink-3">Nothing matches these filters.</p>
      ) : (
        <ul className="divide-y divide-line">
          {data.entries.map((e) => {
            const info = details(e);
            return (
              <li key={e.id} className="grid grid-cols-1 gap-1 px-5 py-3 sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-4">
                <span className="tnum text-xs text-ink-3">{formatDateTime(e.at)}</span>
                <div className="min-w-0">
                  <p className="text-sm text-ink">
                    <span className="font-medium">{e.user?.name ?? refusedEmail(e) ?? "No sign-in"}</span>{" "}
                    <span className="text-ink-2">{actionLabel(e.action).replace(/^\w/, (c) => c.toLowerCase())}</span>
                    {e.entity_label && <> · <span className="font-medium">{e.entity_label}</span></>}
                    {!e.entity_label && e.entity_type && ENTITY_LABEL[e.entity_type] && (
                      <span className="text-ink-3"> · {ENTITY_LABEL[e.entity_type]}</span>
                    )}
                  </p>
                  {info && <p className="mt-0.5 truncate text-xs text-ink-3" title={info}>{info}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {data && data.total > data.page_size && (
        <div className="flex items-center justify-between border-t border-line bg-surface-2 px-4 py-2.5 text-xs text-ink-3">
          <span className="tnum">Page {page} of {pages}</span>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
              <ChevronLeft className="h-3.5 w-3.5" /> Newer
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page >= pages}>
              Older <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
