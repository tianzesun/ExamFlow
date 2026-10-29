"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { getExam } from "@/lib/api/exams";
import { getAllRooms, Room } from "@/lib/api/rooms";
import {
  getExamRooms, addExamRoom, removeExamRoom,
  getAssignmentSummary, previewAssignment, confirmAssignment, regenerateAssignment,
  getAssignments, AssignmentSummary, Assignment,
} from "@/lib/api/assignments";
import { Exam } from "@/lib/types";
import { useAuth } from "@/lib/auth/context";
import { Badge } from "@/components/badge";
import { StatCard } from "@/components/dashboard/StatCard";
import { formatNumber, plural } from "@/lib/format";
import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { Select } from "@/components/select";
import { Table, TableHead, TableBody, Th, Td } from "@/components/table";
import { PageLoader } from "@/components/spinner";
import { EmptyState } from "@/components/empty-state";
import {
  AlertCircle, CheckCircle, CheckCircle2, AlertTriangle, Plus, Trash2, Armchair,
  ChevronLeft, ChevronRight, DoorOpen, RefreshCw, Search, Sparkles, Users, UserX,
} from "lucide-react";

import { notifyExamChanged } from "@/components/exam/workspace";
type PreviewData = {
  students: number; rooms: number; available_seats: number; assigned: number; unused: number;
  items: { assignment_order: number; student_number: string; full_name: string; building: string; room_number: string; seat_code: string }[];
  has_more: boolean;
};

export default function SeatingPage() {
  const params = useParams();
  const { user } = useAuth();
  const examId = params.id as string;

  const [exam, setExam] = useState<Exam | null>(null);
  const [allRooms, setAllRooms] = useState<Room[]>([]);
  const [examRooms, setExamRooms] = useState<{ id: string; building: string; room_number: string; capacity: number }[]>([]);
  const [summary, setSummary] = useState<AssignmentSummary | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [totalAssignments, setTotalAssignments] = useState(0);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRoom, setFilterRoom] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Workflow state
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);
  const [selectedAddRoom, setSelectedAddRoom] = useState<string>("");

  const canEdit = user?.role === "ADMIN" || user?.role === "STAFF";

  const fetchAll = useCallback(() => {
    let cancelled = false;
    Promise.resolve()
      .then(() => {
        if (!cancelled) setLoading(true);
      })
      .then(async () => {
        if (cancelled) return null;
        const [e, r, er, s, a] = await Promise.all([
          getExam(examId),
          getAllRooms(),
          getExamRooms(examId),
          getAssignmentSummary(examId),
          getAssignments(examId, { page, page_size: 50, query: searchQuery || undefined, room_id: filterRoom || undefined }),
        ]);
        if (cancelled) return null;
        return { exam: e, rooms: r, examRooms: er, summary: s, assignments: a } as const;
      })
      .then((next) => {
        if (!cancelled && next) {
          setExam(next.exam);
          setAllRooms(next.rooms.rooms);
          setExamRooms(next.examRooms);
          setSummary(next.summary);
          setAssignments(next.assignments.assignments);
          setTotalAssignments(next.assignments.total);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [examId, page, searchQuery, filterRoom]);

  useEffect(() => {
    const cleanup = fetchAll();
    return cleanup;
  }, [fetchAll]);

  const handleAddRoom = async () => {
    if (!selectedAddRoom) return;
    setError(null);
    try {
      await addExamRoom(examId, selectedAddRoom);
      notifyExamChanged();
      setSelectedAddRoom("");
      fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add room");
    }
  };

  const handleRemoveRoom = async (roomId: string) => {
    if (!confirm("Remove this room? Existing assignments in this room must be removed first.")) return;
    setError(null);
    try {
      await removeExamRoom(examId, roomId);
      notifyExamChanged();
      fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove room");
    }
  };

  const handlePreview = async () => {
    setPreviewing(true);
    setError(null);
    setPreview(null);
    try {
      const p = await previewAssignment(examId);
      setPreview(p);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setPreviewing(false);
    }
  };

  const handleConfirm = async () => {
    setConfirming(true);
    setError(null);
    try {
      await confirmAssignment(examId);
      notifyExamChanged();
      setPreview(null);
      fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Confirmation failed");
    } finally {
      setConfirming(false);
    }
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    setError(null);
    setShowRegenConfirm(false);
    try {
      await regenerateAssignment(examId);
      notifyExamChanged();
      fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Regeneration failed");
    } finally {
      setRegenerating(false);
    }
  };

  const handleSearch = () => { setPage(1); fetchAll(); };
  const hasAssignments = (summary?.assigned_students ?? 0) > 0;
  const availableRooms = allRooms.filter(r => r.is_active && !examRooms.some(er => er.id === r.id));

  if (loading && !exam) return <PageLoader />;

  const detailsById = new Map((summary?.room_details ?? []).map((rd) => [rd.room_id, rd]));
  const totalCapacity = examRooms.reduce((n, r) => n + r.capacity, 0);
  const pageCount = Math.max(1, Math.ceil(totalAssignments / 50));
  const seatedPct = summary && summary.registered_students > 0 ? summary.assigned_students / summary.registered_students : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-ink">Seats</h2>
          <p className="text-sm text-ink-2">
            {hasAssignments
              ? "Seating has been generated. Fine-tune individual seats on the seat map."
              : "Choose rooms, preview the assignment, then confirm it."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canEdit && (hasAssignments ? (
            <Button variant="secondary" className="text-danger" onClick={() => setShowRegenConfirm(true)} disabled={regenerating} loading={regenerating}>
              <RefreshCw className="h-4 w-4" /> Regenerate
            </Button>
          ) : (
            <Button onClick={handlePreview} disabled={previewing || examRooms.length === 0} loading={previewing}>
              <Sparkles className="h-4 w-4" /> Preview assignment
            </Button>
          ))}
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Regeneration confirmation */}
      {showRegenConfirm && (
        <div role="alertdialog" className="surface-card flex flex-col gap-4 border-danger/30 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-danger/10 text-danger">
              <AlertTriangle className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-ink">Replace the current seating?</h3>
              <p className="mt-0.5 text-sm text-ink-2">
                All {plural(summary?.assigned_students ?? 0, "assignment")} for this examination will be discarded and regenerated.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowRegenConfirm(false)}>Cancel</Button>
            <Button variant="danger" onClick={handleRegenerate} disabled={regenerating} loading={regenerating}>
              Regenerate seating
            </Button>
          </div>
        </div>
      )}

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard icon={Users} label="Registered" value={summary.registered_students} color="accent" hint="students on roster" />
          <StatCard icon={CheckCircle2} label="Assigned" value={summary.assigned_students} color="success"
            hint={`${Math.round(seatedPct * 100)}% of roster`} progress={seatedPct} />
          <StatCard icon={Armchair} label="Available seats" value={summary.available_seats} color="violet"
            hint={`across ${plural(examRooms.length, "room")}`} />
          <StatCard icon={UserX} label="Unused seats" value={summary.unused_seats} color="neutral"
            hint={summary.unassigned_students > 0 ? `${plural(summary.unassigned_students, "student")} unassigned` : "everyone has a seat"} />
        </div>
      )}

      {/* Preview */}
      {preview && (
        <div className="surface-card overflow-hidden border-accent/30">
          <div className="flex flex-col gap-1 border-b border-line bg-accent-subtle px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-ink">Seating preview</h3>
              <p className="text-xs text-ink-3">Nothing is saved until you confirm.</p>
            </div>
            <p className="tnum text-xs text-ink-2">
              {plural(preview.students, "student")} · {plural(preview.rooms, "room")} · {plural(preview.available_seats, "seat")} ·{" "}
              <span className="font-medium text-ink">{formatNumber(preview.assigned)} assigned</span> · {formatNumber(preview.unused)} unused
            </p>
          </div>
          {preview.items.length > 0 && (
            <Table>
              <TableHead>
                <Th className="w-14">#</Th>
                <Th>Student</Th>
                <Th>Room</Th>
                <Th>Seat</Th>
              </TableHead>
              <TableBody>
                {preview.items.map((p) => (
                  <tr key={p.assignment_order}>
                    <Td className="tnum text-ink-3">{p.assignment_order}</Td>
                    <Td>
                      <span className="font-medium">{p.full_name}</span>{" "}
                      <span className="font-mono text-xs text-ink-3">{p.student_number}</span>
                    </Td>
                    <Td>{p.building} <span className="font-mono text-xs text-ink-2">{p.room_number}</span></Td>
                    <Td className="font-mono text-xs font-medium">{p.seat_code}</Td>
                  </tr>
                ))}
              </TableBody>
            </Table>
          )}
          <div className="flex flex-col gap-3 border-t border-line bg-surface-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-ink-3">
              {preview.has_more ? `Showing first 20 of ${formatNumber(preview.students)} assignments` : `${plural(preview.items.length, "assignment")}`}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setPreview(null)}>Cancel</Button>
              <Button onClick={handleConfirm} disabled={confirming} loading={confirming}>
                <CheckCircle className="h-4 w-4" /> Confirm assignment
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Rooms */}
      <div className="surface-card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line px-5 py-3.5 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-ink">Rooms</h3>
            <p className="tnum text-xs text-ink-3">
              {plural(examRooms.length, "room")} selected · {plural(totalCapacity, "seat")} capacity
            </p>
          </div>
          {canEdit && (
            <div className="flex items-center gap-2">
              <Select
                value={selectedAddRoom}
                onChange={(e) => setSelectedAddRoom(e.target.value)}
                options={availableRooms.map((r) => ({ value: r.id, label: `${r.building} ${r.room_number} (${r.capacity} seats)` }))}
                placeholder="Add a room…"
                aria-label="Add a room"
                className="w-64"
              />
              <Button variant="secondary" onClick={handleAddRoom} disabled={!selectedAddRoom}>
                <Plus className="h-4 w-4" /> Add
              </Button>
            </div>
          )}
        </div>
        {examRooms.length === 0 ? (
          <EmptyState
            icon={<DoorOpen className="h-5 w-5 text-ink-3" />}
            title="No rooms selected"
            description={canEdit ? "Add at least one room above before generating seating." : "No rooms have been selected for this exam yet."}
          />
        ) : (
          <Table>
            <TableHead>
              <Th>Room</Th>
              <Th className="text-right">Capacity</Th>
              <Th className="text-right">Used</Th>
              <Th className="text-right">Free</Th>
              <Th className="w-[28%]">Utilization</Th>
              {canEdit && <Th className="w-12"><span className="sr-only">Actions</span></Th>}
            </TableHead>
            <TableBody>
              {examRooms.map((r) => {
                const rd = detailsById.get(r.id);
                const total = rd?.total_seats ?? r.capacity;
                const used = rd?.used_seats ?? 0;
                const pct = total > 0 ? used / total : 0;
                return (
                  <tr key={r.id}>
                    <Td className="font-medium">
                      {r.building} <span className="font-mono text-xs text-ink-2">{r.room_number}</span>
                    </Td>
                    <Td className="tnum text-right text-ink-2">{formatNumber(total)}</Td>
                    <Td className="tnum text-right">{formatNumber(used)}</Td>
                    <Td className="tnum text-right text-ink-2">{formatNumber(rd?.available_seats ?? total - used)}</Td>
                    <Td>
                      <div className="flex items-center gap-3">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-hover">
                          <div
                            className={pct >= 0.95 ? "h-full rounded-full bg-warning" : "h-full rounded-full bg-accent"}
                            style={{ width: `${Math.round(pct * 100)}%` }}
                          />
                        </div>
                        <span className="tnum w-9 text-right text-xs text-ink-3">{Math.round(pct * 100)}%</span>
                      </div>
                    </Td>
                    {canEdit && (
                      <Td className="py-1.5 text-right">
                        <Button variant="ghost" size="sm" className="px-2 text-ink-3 hover:text-danger"
                          onClick={() => handleRemoveRoom(r.id)} aria-label={`Remove ${r.building} ${r.room_number}`}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </Td>
                    )}
                  </tr>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Assignments */}
      <div className="surface-card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line px-5 py-3.5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-ink">Assignments</h3>
            <p className="tnum text-xs text-ink-3">{plural(totalAssignments, "student")} seated</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
              <Input type="text" placeholder="Search student #, name or seat…" value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                aria-label="Search assignments"
                className="pl-8 sm:w-72" />
            </div>
            <Select
              value={filterRoom}
              onChange={(e) => { setFilterRoom(e.target.value); setPage(1); }}
              options={[
                { value: "", label: "All rooms" },
                ...examRooms.map((r) => ({ value: r.id, label: `${r.building} ${r.room_number}` })),
              ]}
              aria-label="Filter by room"
              className="sm:w-48"
            />
            <Button variant="secondary" onClick={handleSearch}>Search</Button>
          </div>
        </div>
        {assignments.length === 0 ? (
          <EmptyState
            icon={<Armchair className="h-5 w-5 text-ink-3" />}
            title={searchQuery || filterRoom ? "No matching assignments" : "No assignments yet"}
            description={searchQuery || filterRoom ? "Try a different search or room filter." : "Preview and confirm a seating assignment to see it here."}
            action={
              canEdit && !hasAssignments && examRooms.length > 0 && !(searchQuery || filterRoom) ? (
                <Button onClick={handlePreview} loading={previewing}>
                  <Sparkles className="h-4 w-4" /> Preview assignment
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <Table>
              <TableHead>
                <Th className="w-14">#</Th>
                <Th>Student #</Th>
                <Th>Name</Th>
                <Th>Room</Th>
                <Th>Seat</Th>
                <Th>Method</Th>
              </TableHead>
              <TableBody>
                {assignments.map((a) => (
                  <tr key={a.id}>
                    <Td className="tnum text-ink-3">{a.assignment_order}</Td>
                    <Td className="font-mono text-xs text-ink-2">{a.student_number}</Td>
                    <Td className="font-medium">{a.full_name}</Td>
                    <Td>{a.building} <span className="font-mono text-xs text-ink-2">{a.room_number}</span></Td>
                    <Td className="font-mono text-xs font-medium">{a.seat_code}</Td>
                    <Td><Badge variant={a.method === "MANUAL" ? "violet" : "default"}>{a.method.charAt(0) + a.method.slice(1).toLowerCase()}</Badge></Td>
                  </tr>
                ))}
              </TableBody>
            </Table>
            <div className="flex items-center justify-between border-t border-line bg-surface-2 px-4 py-2.5 text-xs text-ink-3">
              <span className="tnum">Page {page} of {pageCount}</span>
              {totalAssignments > 50 && (
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                    <ChevronLeft className="h-3.5 w-3.5" /> Previous
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setPage(p => p + 1)} disabled={page * 50 >= totalAssignments}>
                    Next <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
