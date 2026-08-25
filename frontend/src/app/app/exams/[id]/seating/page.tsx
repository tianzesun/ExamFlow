"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getExam } from "@/lib/api/exams";
import { getRooms, Room } from "@/lib/api/rooms";
import {
  getExamRooms, addExamRoom, removeExamRoom,
  getAssignmentSummary, previewAssignment, confirmAssignment, regenerateAssignment,
  getAssignments, AssignmentSummary, Assignment,
} from "@/lib/api/assignments";
import { Exam } from "@/lib/types";
import { useAuth } from "@/lib/auth/context";
import { Card, CardContent } from "@/components/card";
import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { Select } from "@/components/select";
import { Table, TableHead, TableBody, Th, Td } from "@/components/table";
import { PageLoader } from "@/components/spinner";
import { EmptyState } from "@/components/empty-state";
import { AlertCircle, CheckCircle, AlertTriangle, Plus, Trash2 } from "lucide-react";

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
    setLoading(true);
    Promise.all([
      getExam(examId),
      getRooms(1, 200),
      getExamRooms(examId),
      getAssignmentSummary(examId),
      getAssignments(examId, { page, page_size: 50, query: searchQuery || undefined, room_id: filterRoom || undefined }),
    ]).then(([e, r, er, s, a]) => {
      setExam(e);
      setAllRooms(r.rooms);
      setExamRooms(er);
      setSummary(s);
      setAssignments(a.assignments);
      setTotalAssignments(a.total);
    }).catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, [examId, page, searchQuery, filterRoom]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleAddRoom = async () => {
    if (!selectedAddRoom) return;
    setError(null);
    try {
      await addExamRoom(examId, selectedAddRoom);
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

  return (
    <div className="space-y-6">
      <Link href={`/app/exams/${examId}`} className="text-sm text-zinc-500 hover:text-black dark:text-zinc-500 dark:hover:text-white">← Back to Exam</Link>

      <div>
        <h1 className="text-2xl font-bold text-black dark:text-white">Seating Assignment</h1>
        {exam && <p className="text-sm text-zinc-500">{exam.course_code} — {exam.exam_name}</p>}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md bg-red-50 p-4 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-400">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Registered", value: summary.registered_students },
            { label: "Assigned", value: summary.assigned_students },
            { label: "Available Seats", value: summary.available_seats },
            { label: "Unused", value: summary.unused_seats },
          ].map(({ label, value }) => (
            <Card key={label}>
              <CardContent className="text-center">
                <div className="text-2xl font-bold text-black dark:text-white">{value}</div>
                <div className="text-xs text-zinc-500">{label}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Room Selection */}
      <Card>
        <CardContent>
          <h2 className="text-lg font-medium text-black dark:text-white">Selected Rooms ({examRooms.length})</h2>
          {examRooms.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-500">No rooms selected. Add rooms below.</p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {examRooms.map((r) => (
                <span key={r.id} className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800">
                  {r.building} {r.room_number}
                  {canEdit && (
                    <button onClick={() => handleRemoveRoom(r.id)} className="text-zinc-400 hover:text-red-500">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}
          {canEdit && (
            <div className="mt-3 flex items-center gap-2">
              <Select
                value={selectedAddRoom}
                onChange={(e) => setSelectedAddRoom(e.target.value)}
                options={[
                  { value: "", label: "Add a room..." },
                  ...availableRooms.map((r) => ({ value: r.id, label: `${r.building} ${r.room_number} (${r.capacity} seats)` })),
                ]}
                placeholder="Add a room..."
                className="w-auto"
              />
              <Button variant="primary" size="sm" onClick={handleAddRoom} disabled={!selectedAddRoom}>
                <Plus className="h-3.5 w-3.5" />
                Add
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Generate / Regenerate Actions */}
      {canEdit && (
        <Card>
          <CardContent>
            <h2 className="text-lg font-medium text-black dark:text-white">
              {hasAssignments ? "Seating Generated" : "Generate Seating"}
            </h2>
            {!hasAssignments ? (
              <div className="mt-4 flex items-center gap-3">
                <Button variant="secondary" onClick={handlePreview} disabled={previewing || examRooms.length === 0} loading={previewing}>
                  Preview Assignment
                </Button>
                {examRooms.length === 0 && <span className="text-sm text-zinc-500">Add rooms first</span>}
              </div>
            ) : (
              <div className="mt-4 flex items-center gap-3">
                <Button variant="danger" onClick={() => setShowRegenConfirm(true)} disabled={regenerating} loading={regenerating}>
                  Regenerate Seating
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Preview */}
      {preview && (
        <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20">
          <CardContent>
            <h2 className="text-lg font-medium text-blue-900 dark:text-blue-100">Seating Preview</h2>
            <div className="mt-3 grid grid-cols-5 gap-4 text-sm">
              <div><span className="text-blue-600 dark:text-blue-400">Students:</span> <span className="font-medium">{preview.students}</span></div>
              <div><span className="text-blue-600 dark:text-blue-400">Rooms:</span> <span className="font-medium">{preview.rooms}</span></div>
              <div><span className="text-blue-600 dark:text-blue-400">Seats:</span> <span className="font-medium">{preview.available_seats}</span></div>
              <div><span className="text-blue-600 dark:text-blue-400">Assigned:</span> <span className="font-medium">{preview.assigned}</span></div>
              <div><span className="text-blue-600 dark:text-blue-400">Unused:</span> <span className="font-medium">{preview.unused}</span></div>
            </div>
            {preview.items.length > 0 && (
              <Table className="mt-4">
                <TableHead>
                  <Th className="text-blue-600 dark:text-blue-400">#</Th>
                  <Th className="text-blue-600 dark:text-blue-400">Student</Th>
                  <Th className="text-blue-600 dark:text-blue-400">Room</Th>
                  <Th className="text-blue-600 dark:text-blue-400">Seat</Th>
                </TableHead>
                <TableBody>
                  {preview.items.map((p) => (
                    <tr key={p.assignment_order}>
                      <Td>{p.assignment_order}</Td>
                      <Td>{p.student_number} — {p.full_name}</Td>
                      <Td>{p.building} {p.room_number}</Td>
                      <Td className="font-medium">{p.seat_code}</Td>
                    </tr>
                  ))}
                </TableBody>
              </Table>
            )}
            {preview.has_more && <p className="mt-2 text-xs text-blue-600">Showing first 20 of {preview.students} assignments</p>}
            <div className="mt-4 flex gap-3">
              <Button variant="primary" onClick={handleConfirm} disabled={confirming} loading={confirming}>
                <CheckCircle className="h-4 w-4" />
                Confirm Assignment
              </Button>
              <Button variant="secondary" onClick={() => setPreview(null)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Regeneration Confirmation */}
      {showRegenConfirm && (
        <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
          <CardContent>
            <h2 className="text-lg font-medium text-red-900 dark:text-red-100 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Warning
            </h2>
            <p className="mt-2 text-sm text-red-800 dark:text-red-300">
              This will replace the current seating assignment for this examination.
              Current assignments: {summary?.assigned_students}.
            </p>
            <div className="mt-4 flex gap-3">
              <Button variant="danger" onClick={handleRegenerate} disabled={regenerating} loading={regenerating}>
                Regenerate
              </Button>
              <Button variant="secondary" onClick={() => setShowRegenConfirm(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Room Summary */}
      {summary && summary.room_details.length > 0 && (
        <Card>
          <CardContent>
            <h2 className="text-lg font-medium text-black dark:text-white">Room Summary</h2>
            <Table className="mt-3">
              <TableHead>
                <Th>Room</Th>
                <Th>Used</Th>
                <Th>Available</Th>
                <Th>Total</Th>
              </TableHead>
              <TableBody>
                {summary.room_details.map((rd) => (
                  <tr key={rd.room_id}>
                    <Td className="font-medium">{rd.building} {rd.room_number}</Td>
                    <Td>{rd.used_seats}</Td>
                    <Td>{rd.available_seats}</Td>
                    <Td>{rd.total_seats}</Td>
                  </tr>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Assignments Table */}
      <Card>
        <CardContent>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-black dark:text-white">Assignments ({totalAssignments})</h2>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <Input type="text" placeholder="Search student #, name, or seat..." value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="flex-1" />
            <Select
              value={filterRoom}
              onChange={(e) => { setFilterRoom(e.target.value); setPage(1); }}
              options={[
                { value: "", label: "All rooms" },
                ...examRooms.map((r) => ({ value: r.id, label: `${r.building} ${r.room_number}` })),
              ]}
              className="w-auto"
            />
            <Button variant="primary" size="sm" onClick={handleSearch}>Search</Button>
          </div>
          {assignments.length === 0 ? (
            <EmptyState
              title="No assignments found"
              description="Generate seating assignments to see them here."
            />
          ) : (
            <>
              <Table className="mt-4">
                <TableHead>
                  <Th>#</Th>
                  <Th>Student #</Th>
                  <Th>Name</Th>
                  <Th>Building</Th>
                  <Th>Room</Th>
                  <Th>Seat</Th>
                  <Th>Method</Th>
                </TableHead>
                <TableBody>
                  {assignments.map((a) => (
                    <tr key={a.id}>
                      <Td className="text-zinc-500">{a.assignment_order}</Td>
                      <Td>{a.student_number}</Td>
                      <Td>{a.full_name}</Td>
                      <Td>{a.building}</Td>
                      <Td>{a.room_number}</Td>
                      <Td className="font-medium">{a.seat_code}</Td>
                      <Td className="text-xs text-zinc-500">{a.method}</Td>
                    </tr>
                  ))}
                </TableBody>
              </Table>
              {totalAssignments > 50 && (
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-zinc-500">Page {page} of {Math.ceil(totalAssignments / 50)}</span>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                      Prev
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setPage(p => p + 1)} disabled={page * 50 >= totalAssignments}>
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
