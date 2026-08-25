"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, DoorOpen } from "lucide-react";
import { getRooms } from "@/lib/api/rooms";
import { Card, Badge, Button, Table, TableHead, TableBody, Th, Td, PageLoader, EmptyState } from "@/components";
import { useAuth } from "@/lib/auth/context";

export default function RoomsPage() {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRooms(1, 100)
      .then((d) => { setRooms(d.rooms); setTotal(d.total); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const canCreate = user?.role === "ADMIN";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-black dark:text-white">Rooms</h1>
          <p className="text-sm text-zinc-500">{total} room{total !== 1 ? "s" : ""}</p>
        </div>
        {canCreate && (
          <Link href="/app/rooms/new">
            <Button><Plus className="h-4 w-4" /> Create Room</Button>
          </Link>
        )}
      </div>

      {loading ? (
        <PageLoader />
      ) : rooms.length === 0 ? (
        <EmptyState
          icon={<DoorOpen className="h-6 w-6 text-zinc-400" />}
          title="No rooms yet"
          description="Create your first room to get started"
          action={canCreate ? <Link href="/app/rooms/new"><Button>Create Room</Button></Link> : undefined}
        />
      ) : (
        <Card>
          <Table>
            <TableHead>
              <Th>Building</Th>
              <Th>Room</Th>
              <Th>Capacity</Th>
              <Th>Status</Th>
            </TableHead>
            <TableBody>
              {rooms.map((room) => (
                <tr key={room.id} className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                  <Td className="font-medium">{room.building}</Td>
                  <Td>{room.room_number}</Td>
                  <Td>{room.capacity} seats</Td>
                  <Td>
                    <Badge variant={room.is_active ? "success" : "default"}>
                      {room.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </Td>
                </tr>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
