"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { createRoom } from "@/lib/api/rooms";
import { Input, Button, PageContainer, PageHeader } from "@/components";
import { FloorPlan } from "@/components/rooms/FloorPlan";
import { cn } from "@/lib/utils";

const centreAisle = (columns: number) => (columns >= 6 ? [Math.ceil(columns / 2)] : []);

export default function NewRoomPage() {
  const router = useRouter();
  const [form, setForm] = useState({ building: "", room_number: "", rows: 6, columns: 10 });
  const [aisle, setAisle] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const rows = Math.min(52, Math.max(1, form.rows || 1));
  const columns = Math.min(60, Math.max(1, form.columns || 1));
  const aisles = aisle ? centreAisle(columns) : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const room = await createRoom({
        building: form.building.trim(),
        room_number: form.room_number.trim(),
        rows,
        columns,
        aisles_after: aisles,
      });
      // Straight to the layout, where pillars and broken seats can be marked.
      router.push(`/app/rooms/${room.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create room");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer className="space-y-6">
      <PageHeader eyebrow="Rooms" title="New room" description="Add an examination room to the room inventory." />

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[400px_minmax(0,1fr)]">
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
              <p className="mt-0.5 text-xs text-ink-3">Rows run from the front (A) to the back.</p>
            </div>
            <div className="space-y-4 px-5 py-5">
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Rows"
                  type="number"
                  min={1}
                  max={52}
                  value={form.rows}
                  onChange={(e) => setForm({ ...form, rows: parseInt(e.target.value) })}
                  className="tnum"
                />
                <Input
                  label="Seats per row"
                  id="seats-per-row"
                  type="number"
                  min={1}
                  max={60}
                  value={form.columns}
                  onChange={(e) => setForm({ ...form, columns: parseInt(e.target.value) })}
                  className="tnum"
                />
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-2">
                <input
                  type="checkbox"
                  checked={aisle}
                  onChange={(e) => setAisle(e.target.checked)}
                  className="h-3.5 w-3.5 accent-[var(--accent)]"
                />
                Centre aisle
              </label>
              <p className="text-xs text-ink-3">
                After creating the room you can mark pillars, broken seats and more aisles on its layout.
              </p>
            </div>

            {error && (
              <div className="mx-5 mb-5 flex items-start gap-2 rounded-lg border border-danger/20 bg-danger/5 p-3 text-sm text-danger">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <div className="flex justify-end gap-2 rounded-b-xl border-t border-line bg-surface-2 px-5 py-3.5">
              <Link href="/app/rooms">
                <Button variant="secondary" type="button">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" loading={loading}>
                Create room
              </Button>
            </div>
          </section>
        </form>

        <section className="surface-card animate-rise overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-ink">
                {form.building || "Building"} {form.room_number || "000"}
              </h2>
              <p className="tnum mt-0.5 text-xs text-ink-3">
                {rows * columns} seats · {rows} rows × {columns}
              </p>
            </div>
            <span className={cn("rounded-md bg-accent-subtle px-2 py-1 text-[11px] font-semibold text-accent")}>Preview</span>
          </div>
          <div className="max-h-[640px] overflow-auto bg-surface-2/60 px-4 py-8">
            <FloorPlan rows={rows} columns={columns} aisles={new Set(aisles)} stateOf={() => "seat"} />
          </div>
        </section>
      </div>
    </PageContainer>
  );
}
