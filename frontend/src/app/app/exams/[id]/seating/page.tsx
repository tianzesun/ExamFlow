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

  if (loading && !exam) return <div className="text-zinc-600 dark:text-zinc-400">Loading...</div>;

  return (
    <div className="space-y-6">
      <Link href={`/app/exams/${examId}`} className="text-sm text-zinc-500 hover:text-black dark:text-zinc-500 dark:hover:text-white">← Back to Exam</Link>

      <div>
        <h1 className="text-2xl font-bold text-black dark:text-white">Seating Assignment</h1>
        {exam && <p className="text-sm text-zinc-500">{exam.course_code} — {exam.exam_name}</p>}
      </div>

      {error && <div className="rounded-md bg-red-50 p-4 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-400">{error}</div>}

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Registered", value: summary.registered_students },
            { label: "Assigned", value: summary.assigned_students },
            { label: "Available Seats", value: summary.available_seats },
            { label: "Unused", value: summary.unused_seats },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-lg border border-zinc-200 bg-white p-4 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              <div className="text-2xl font-bold text-black dark:text-white">{value}</div>
              <div className="text-xs text-zinc-500">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Room Selection */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-lg font-medium text-black dark:text-white">Selected Rooms ({examRooms.length})</h2>
        {examRooms.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">No rooms selected. Add rooms below.</p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {examRooms.map((r) => (
              <span key={r.id} className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800">
                {r.building} {r.room_number}
                {canEdit && (
                  <button onClick={() => handleRemoveRoom(r.id)} className="text-zinc-400 hover:text-red-500">×</button>
                )}
              </span>
            ))}
          </div>
        )}
        {canEdit && (
          <div className="mt-3 flex items-center gap-2">
            <select value={selectedAddRoom} onChange={(e) => setSelectedAddRoom(e.target.value)}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900">
              <option value="">Add a room...</option>
              {availableRooms.map((r) => <option key={r.id} value={r.id}>{r.building} {r.room_number} ({r.capacity} seats)</option>)}
            </select>
            <button onClick={handleAddRoom} disabled={!selectedAddRoom}
              className="rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black">
              Add
            </button>
          </div>
        )}
      </div>

      {/* Generate / Regenerate Actions */}
      {canEdit && (
        <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-lg font-medium text-black dark:text-white">
            {hasAssignments ? "Seating Generated" : "Generate Seating"}
          </h2>
          {!hasAssignments ? (
            <div className="mt-4 flex items-center gap-3">
              <button onClick={handlePreview} disabled={previewing || examRooms.length === 0}
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300">
                {previewing ? "Previewing..." : "Preview Assignment"}
              </button>
              {examRooms.length === 0 && <span className="text-sm text-zinc-500">Add rooms first</span>}
            </div>
          ) : (
            <div className="mt-4 flex items-center gap-3">
              <button onClick={() => setShowRegenConfirm(true)} disabled={regenerating}
                className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-700 dark:text-red-400">
                {regenerating ? "Regenerating..." : "Regenerate Seating"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Preview */}
      {preview && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-6 shadow-sm dark:border-blue-800 dark:bg-blue-900/20">
          <h2 className="text-lg font-medium text-blue-900 dark:text-blue-100">Seating Preview</h2>
          <div className="mt-3 grid grid-cols-5 gap-4 text-sm">
            <div><span className="text-blue-600 dark:text-blue-400">Students:</span> <span className="font-medium">{preview.students}</span></div>
            <div><span className="text-blue-600 dark:text-blue-400">Rooms:</span> <span className="font-medium">{preview.rooms}</span></div>
            <div><span className="text-blue-600 dark:text-blue-400">Seats:</span> <span className="font-medium">{preview.available_seats}</span></div>
            <div><span className="text-blue-600 dark:text-blue-400">Assigned:</span> <span className="font-medium">{preview.assigned}</span></div>
            <div><span className="text-blue-600 dark:text-blue-400">Unused:</span> <span className="font-medium">{preview.unused}</span></div>
          </div>
          {preview.items.length > 0 && (
            <table className="mt-4 w-full text-sm">
              <thead>
                <tr className="border-b border-blue-200 dark:border-blue-800">
                  <th className="py-1 text-left text-xs text-blue-600">#</th>
                  <th className="py-1 text-left text-xs text-blue-600">Student</th>
                  <th className="py-1 text-left text-xs text-blue-600">Room</th>
                  <th className="py-1 text-left text-xs text-blue-600">Seat</th>
                </tr>
              </thead>
              <tbody>
                {preview.items.map((p) => (
                  <tr key={p.assignment_order} className="border-b border-blue-100 dark:border-blue-800/50">
                    <td className="py-1">{p.assignment_order}</td>
                    <td className="py-1">{p.student_number} — {p.full_name}</td>
                    <td className="py-1">{p.building} {p.room_number}</td>
                    <td className="py-1 font-medium">{p.seat_code}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {preview.has_more && <p className="mt-2 text-xs text-blue-600">Showing first 20 of {preview.students} assignments</p>}
          <div className="mt-4 flex gap-3">
            <button onClick={handleConfirm} disabled={confirming}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {confirming ? "Confirming..." : "Confirm Assignment"}
            </button>
            <button onClick={() => setPreview(null)}
              className="rounded-md border border-blue-300 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:text-blue-300">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Regeneration Confirmation */}
      {showRegenConfirm && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 shadow-sm dark:border-red-800 dark:bg-red-900/20">
          <h2 className="text-lg font-medium text-red-900 dark:text-red-100">⚠ Warning</h2>
          <p className="mt-2 text-sm text-red-800 dark:text-red-300">
            This will replace the current seating assignment for this examination.
            Current assignments: {summary?.assigned_students}.
          </p>
          <div className="mt-4 flex gap-3">
            <button onClick={handleRegenerate} disabled={regenerating}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
              {regenerating ? "Regenerating..." : "Regenerate"}
            </button>
            <button onClick={() => setShowRegenConfirm(false)}
              className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 dark:border-red-700 dark:text-red-300">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Room Summary */}
      {summary && summary.room_details.length > 0 && (
        <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-lg font-medium text-black dark:text-white">Room Summary</h2>
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-b dark:border-zinc-700">
                <th className="py-2 text-left text-xs font-medium text-zinc-500">Room</th>
                <th className="py-2 text-left text-xs font-medium text-zinc-500">Used</th>
                <th className="py-2 text-left text-xs font-medium text-zinc-500">Available</th>
                <th className="py-2 text-left text-xs font-medium text-zinc-500">Total</th>
              </tr>
            </thead>
            <tbody>
              {summary.room_details.map((rd) => (
                <tr key={rd.room_id} className="border-b dark:border-zinc-800/50">
                  <td className="py-2 font-medium">{rd.building} {rd.room_number}</td>
                  <td className="py-2">{rd.used_seats}</td>
                  <td className="py-2">{rd.available_seats}</td>
                  <td className="py-2">{rd.total_seats}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Assignments Table */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-black dark:text-white">Assignments ({totalAssignments})</h2>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <input type="text" placeholder="Search student #, name, or seat..." value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="flex-1 rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
          <select value={filterRoom} onChange={(e) => { setFilterRoom(e.target.value); setPage(1); }}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900">
            <option value="">All rooms</option>
            {examRooms.map((r) => <option key={r.id} value={r.id}>{r.building} {r.room_number}</option>)}
          </select>
          <button onClick={handleSearch} className="rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-black">Search</button>
        </div>
        {assignments.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">No assignments found.</p>
        ) : (
          <>
            <table className="mt-4 w-full text-sm">
              <thead>
                <tr className="border-b dark:border-zinc-700">
                  <th className="py-2 text-left text-xs font-medium text-zinc-500">#</th>
                  <th className="py-2 text-left text-xs font-medium text-zinc-500">Student #</th>
                  <th className="py-2 text-left text-xs font-medium text-zinc-500">Name</th>
                  <th className="py-2 text-left text-xs font-medium text-zinc-500">Building</th>
                  <th className="py-2 text-left text-xs font-medium text-zinc-500">Room</th>
                  <th className="py-2 text-left text-xs font-medium text-zinc-500">Seat</th>
                  <th className="py-2 text-left text-xs font-medium text-zinc-500">Method</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((a) => (
                  <tr key={a.id} className="border-b dark:border-zinc-800/50">
                    <td className="py-2 text-zinc-500">{a.assignment_order}</td>
                    <td className="py-2">{a.student_number}</td>
                    <td className="py-2">{a.full_name}</td>
                    <td className="py-2">{a.building}</td>
                    <td className="py-2">{a.room_number}</td>
                    <td className="py-2 font-medium">{a.seat_code}</td>
                    <td className="py-2 text-xs text-zinc-500">{a.method}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {totalAssignments > 50 && (
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-zinc-500">Page {page} of {Math.ceil(totalAssignments / 50)}</span>
                <div className="flex gap-2">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="rounded border border-zinc-300 px-2 py-1 text-xs disabled:opacity-50 dark:border-zinc-700">Prev</button>
                  <button onClick={() => setPage(p => p + 1)} disabled={page * 50 >= totalAssignments}
                    className="rounded border border-zinc-300 px-2 py-1 text-xs disabled:opacity-50 dark:border-zinc-700">Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
