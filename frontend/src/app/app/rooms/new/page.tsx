"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createRoom } from "@/lib/api/rooms";
import { Card, CardContent, Input, Button } from "@/components";

export default function NewRoomPage() {
  const router = useRouter();
  const [form, setForm] = useState({ building: "", room_number: "", capacity: 30 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
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
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-black dark:text-white">Create Room</h1>
        <p className="text-sm text-zinc-500">Add a new examination room</p>
      </div>

      <Card>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Building"
              placeholder="e.g. IB"
              value={form.building}
              onChange={(e) => setForm({ ...form, building: e.target.value })}
              required
            />
            <Input
              label="Room Number"
              placeholder="e.g. 101"
              value={form.room_number}
              onChange={(e) => setForm({ ...form, room_number: e.target.value })}
              required
            />
            <Input
              label="Capacity"
              type="number"
              value={form.capacity}
              onChange={(e) => setForm({ ...form, capacity: parseInt(e.target.value) })}
            />
            <p className="text-xs text-zinc-500">Seats will be auto-generated based on capacity.</p>

            {error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button type="submit" loading={loading}>Create Room</Button>
              <Link href="/app/rooms">
                <Button variant="secondary" type="button">Cancel</Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
