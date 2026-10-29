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
      <PageHeader eyebrow="Rooms" title="New room" description="Add an examination room to the room inventory." />

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="surface-card accent-top animate-rise">
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

        <aside className="hero-panel animate-rise px-5 py-5 xl:sticky xl:top-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">Preview</p>
          <p className="mt-3 text-xl font-semibold tracking-tight">
            {form.building || "Building"} {form.room_number || "000"}
          </p>
          <p className="tnum mt-1 text-sm text-white/70">{form.capacity || 0} seats</p>
          <div className="mt-4 grid grid-cols-10 gap-1" aria-hidden>
            {Array.from({ length: Math.min(60, Math.max(0, form.capacity || 0)) }).map((_, i) => (
              <span key={i} className="h-2.5 rounded-[3px] bg-white/30" />
            ))}
          </div>
          <p className="mt-4 text-xs leading-relaxed text-white/70">
            Seats are created automatically in rows (A01, A02 …) and grow or shrink if you change the capacity later.
          </p>
        </aside>
      </div>
    </PageContainer>
  );
}
