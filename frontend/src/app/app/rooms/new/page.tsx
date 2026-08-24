"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createRoom } from "@/lib/api/rooms";

export default function NewRoomPage() {
  const router = useRouter();
  const [form, setForm] = useState({ building: "", room_number: "", capacity: 30 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await createRoom(form);
      router.push("/app/rooms");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create room");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-bold text-black dark:text-white">Create Room</h1>
      {error && <div className="mt-4 rounded-md bg-red-50 p-4 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-400">{error}</div>}
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">Building *</label>
          <input type="text" required value={form.building} onChange={(e) => setForm({ ...form, building: e.target.value })}
            placeholder="e.g. IB" className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">Room Number *</label>
          <input type="text" required value={form.room_number} onChange={(e) => setForm({ ...form, room_number: e.target.value })}
            placeholder="e.g. 3010" className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">Capacity *</label>
          <input type="number" required min={1} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: parseInt(e.target.value) })}
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
        </div>
        <p className="text-xs text-zinc-500">Seats will be auto-generated (A01, A02, B01, etc.)</p>
        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading} className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black">
            {loading ? "Creating..." : "Create Room"}
          </button>
          <button type="button" onClick={() => router.back()} className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
