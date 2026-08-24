"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getExam } from "@/lib/api/exams";
import { getRoster } from "@/lib/api/roster";
import { getRooms, getRoomSeats, Room, Seat } from "@/lib/api/rooms";
import { getAssignments, assignSeat, autoAssign, removeAssignment } from "@/lib/api/assignments";
import { Exam, ExamStudent } from "@/lib/types";
import { Assignment } from "@/lib/api/assignments";
import { useAuth } from "@/lib/auth/context";

export default function SeatingPage() {
  const params = useParams();
  const { user } = useAuth();
  const examId = params.id as string;

  const [exam, setExam] = useState<Exam | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<string>("");
  const [seats, setSeats] = useState<Seat[]>([]);
  const [students, setStudents] = useState<ExamStudent[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Manual assignment state
  const [selectedStudent, setSelectedStudent] = useState<string>("");
  const [selectedSeat, setSelectedSeat] = useState<string>("");
  const [assigning, setAssigning] = useState(false);

  const canEdit = user?.role === "ADMIN" || user?.role === "STAFF";

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      getExam(examId),
      getRooms(1, 100),
      getRoster(examId, 1, 500),
      getAssignments(examId),
    ]).then(([e, r, roster, a]) => {
      setExam(e);
      setRooms(r.rooms);
      setStudents(roster.students);
      setAssignments(a);
    }).catch((err) => setError(err.message)).finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [examId]);

  useEffect(() => {
    if (selectedRoom) {
      getRoomSeats(selectedRoom).then(setSeats).catch(() => setSeats([]));
    }
  }, [selectedRoom]);

  const assignedStudentIds = new Set(assignments.map(a => a.student_id));
  const assignedSeatIds = new Set(assignments.map(a => a.seat_id));
  const unassignedStudents = students.filter(s => !assignedStudentIds.has(s.student_id));
  const availableSeats = seats.filter(s => s.status === "AVAILABLE" && !assignedSeatIds.has(s.id));

  const handleAssign = async () => {
    if (!selectedStudent || !selectedSeat) return;
    setAssigning(true);
    setError(null);
    try {
      await assignSeat(examId, selectedStudent, selectedSeat);
      setSelectedStudent("");
      setSelectedSeat("");
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Assignment failed");
    } finally {
      setAssigning(false);
    }
  };

  const handleAutoAssign = async () => {
    if (!selectedRoom) return;
    if (!confirm(`Auto-assign ${unassignedStudents.length} students to available seats?`)) return;
    setAssigning(true);
    setError(null);
    try {
      const result = await autoAssign(examId, selectedRoom);
      alert(`Assigned ${result.assigned} students`);
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Auto-assign failed");
    } finally {
      setAssigning(false);
    }
  };

  const handleRemove = async (assignmentId: string) => {
    try {
      await removeAssignment(examId, assignmentId);
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Remove failed");
    }
  };

  if (loading) return <div className="text-zinc-600 dark:text-zinc-400">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/app/exams/${examId}`} className="text-sm text-zinc-500 hover:text-black dark:text-zinc-500 dark:hover:text-white">← Back to Exam</Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-black dark:text-white">Seating Assignment</h1>
        {exam && <p className="text-sm text-zinc-500">{exam.course_code} — {exam.exam_name}</p>}
      </div>

      {error && <div className="rounded-md bg-red-50 p-4 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-400">{error}</div>}

      {/* Room Selector */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-lg font-medium text-black dark:text-white">Select Room</h2>
        <div className="mt-4 flex items-center gap-3">
          <select value={selectedRoom} onChange={(e) => setSelectedRoom(e.target.value)}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100">
            <option value="">Select a room...</option>
            {rooms.map((r) => <option key={r.id} value={r.id}>{r.building} {r.room_number} ({r.capacity} seats)</option>)}
          </select>
          {canEdit && selectedRoom && unassignedStudents.length > 0 && (
            <button onClick={handleAutoAssign} disabled={assigning}
              className="rounded-md bg-green-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
              {assigning ? "Assigning..." : `Auto-Assign (${unassignedStudents.length} students)`}
            </button>
          )}
        </div>
        <div className="mt-3 flex gap-4 text-sm text-zinc-500">
          <span>Students: {students.length}</span>
          <span>Assigned: {assignments.length}</span>
          <span>Unassigned: {unassignedStudents.length}</span>
        </div>
      </div>

      {/* Manual Assignment */}
      {canEdit && selectedRoom && (
        <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-lg font-medium text-black dark:text-white">Manual Assignment</h2>
          <div className="mt-4 flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Student</label>
              <select value={selectedStudent} onChange={(e) => setSelectedStudent(e.target.value)}
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900">
                <option value="">Select student...</option>
                {unassignedStudents.map((s) => <option key={s.student_id} value={s.student_id}>{s.student_number} — {s.full_name}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Seat</label>
              <select value={selectedSeat} onChange={(e) => setSelectedSeat(e.target.value)}
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900">
                <option value="">Select seat...</option>
                {availableSeats.map((s) => <option key={s.id} value={s.id}>{s.seat_code}</option>)}
              </select>
            </div>
            <button onClick={handleAssign} disabled={assigning || !selectedStudent || !selectedSeat}
              className="rounded-md bg-black px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black">
              Assign
            </button>
          </div>
        </div>
      )}

      {/* Seat Grid */}
      {selectedRoom && seats.length > 0 && (
        <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-lg font-medium text-black dark:text-white">Seat Layout</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {seats.map((seat) => {
              const assignment = assignments.find(a => a.seat_id === seat.id);
              return (
                <div key={seat.id}
                  className={`flex h-16 w-20 flex-col items-center justify-center rounded border text-xs ${
                    assignment
                      ? "border-green-300 bg-green-50 text-green-800 dark:border-green-700 dark:bg-green-900/30 dark:text-green-400"
                      : "border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800"
                  }`}>
                  <span className="font-medium">{seat.seat_code}</span>
                  {assignment && (
                    <>
                      <span className="mt-0.5 truncate px-1 text-[10px]">{assignment.student_number}</span>
                      {canEdit && (
                        <button onClick={() => handleRemove(assignment.id)}
                          className="mt-0.5 text-[9px] text-red-500 hover:text-red-700">remove</button>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Current Assignments Table */}
      {assignments.length > 0 && (
        <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-lg font-medium text-black dark:text-white">All Assignments ({assignments.length})</h2>
          <table className="mt-4 w-full">
            <thead>
              <tr className="border-b dark:border-zinc-700">
                <th className="py-2 text-left text-sm font-medium text-zinc-500">Student #</th>
                <th className="py-2 text-left text-sm font-medium text-zinc-500">Name</th>
                <th className="py-2 text-left text-sm font-medium text-zinc-500">Seat</th>
                <th className="py-2 text-left text-sm font-medium text-zinc-500">Method</th>
                {canEdit && <th className="py-2 text-right text-sm font-medium text-zinc-500"></th>}
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => (
                <tr key={a.id} className="border-b dark:border-zinc-800/50">
                  <td className="py-2 text-sm">{a.student_number}</td>
                  <td className="py-2 text-sm">{a.full_name}</td>
                  <td className="py-2 text-sm font-medium">{a.seat_code}</td>
                  <td className="py-2 text-xs text-zinc-500">{a.method}</td>
                  {canEdit && (
                    <td className="py-2 text-right">
                      <button onClick={() => handleRemove(a.id)} className="text-xs text-red-600 hover:text-red-800 dark:text-red-400">Remove</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
