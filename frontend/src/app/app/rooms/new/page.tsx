"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { createRoom } from "@/lib/api/rooms";
import { Input, Button, PageContainer, PageHeader } from "@/components";

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
    <PageContainer className="space-y-6">
      <PageHeader title="New room" description="Add an examination room to the room inventory." />

      <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
        <section className="surface-card">
          <div className="border-b border-line px-5 py-4">
            <h2 className="text-sm font-semibold text-ink">Location</h2>
            <p className="mt-0.5 text-xs text-ink-3">Where the room is on campus.</p>
          </div>
          <div className="space-y-4 px-5 py-5">
            <Input
              label="Building"
              placeholder="e.g. IC"
              value={form.building}
              onChange={(e) => setForm({ ...form, building: e.target.value })}
              required
            />
            <Input
              label="Room number"
              id="room-number"
              placeholder="e.g. 130"
              value={form.room_number}
              onChange={(e) => setForm({ ...form, room_number: e.target.value })}
              required
            />
          </div>

          <div className="border-y border-line px-5 py-4">
            <h2 className="text-sm font-semibold text-ink">Seating</h2>
            <p className="mt-0.5 text-xs text-ink-3">Used to plan exam seating.</p>
          </div>
          <div className="px-5 py-5">
            <Input
              label="Capacity"
              type="number"
              min={1}
              value={form.capacity}
              onChange={(e) => setForm({ ...form, capacity: parseInt(e.target.value) })}
              className="tnum sm:max-w-40"
              hint="Seats are generated automatically from the capacity."
            />
          </div>

          {error && (
            <div className="mx-5 mb-5 flex items-start gap-2 rounded-lg border border-danger/20 bg-danger/5 p-3 text-sm text-danger">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-line bg-surface-2 px-5 py-3.5 rounded-b-xl">
            <Link href="/app/rooms">
              <Button variant="secondary" type="button">Cancel</Button>
            </Link>
            <Button type="submit" loading={loading}>Create room</Button>
          </div>
        </section>
      </form>
    </PageContainer>
  );
}
