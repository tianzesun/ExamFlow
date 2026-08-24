"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getRooms, Room } from "@/lib/api/rooms";
import { useAuth } from "@/lib/auth/context";

export default function RoomsPage() {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRooms()
      .then((res) => { setRooms(res.rooms); setTotal(res.total); })
      .finally(() => setLoading(false));
  }, []);

  const canEdit = user?.role === "ADMIN";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-black dark:text-white">Rooms</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-500">{total} rooms</p>
        </div>
        {canEdit && (
          <Link href="/app/rooms/new" className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200">
            Create Room
          </Link>
        )}
      </div>

      {loading ? (
        <div className="text-zinc-600 dark:text-zinc-400">Loading...</div>
      ) : rooms.length === 0 ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-zinc-500 dark:text-zinc-500">No rooms yet.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800">
                <th className="px-4 py-3 text-left text-sm font-medium text-zinc-500">Building</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-zinc-500">Room</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-zinc-500">Capacity</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-zinc-500">Status</th>
              </tr>
            </thead>
            <tbody>
              {rooms.map((room) => (
                <tr key={room.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/50">
                  <td className="px-4 py-3 text-sm font-medium text-black dark:text-white">{room.building}</td>
                  <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">{room.room_number}</td>
                  <td className="px-4 py-3 text-sm text-zinc-500">{room.capacity}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${room.is_active ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-zinc-100 text-zinc-500"}`}>
                      {room.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
