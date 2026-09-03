"use client";

import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";

export interface Notification {
  id: string;
  title: string;
  body?: string;
  when?: string;
  unread: boolean;
}

const MOCK: Notification[] = [
  {
    id: "1",
    title: "Seating generated",
    body: "FINAL_MATH seating plan is ready for review.",
    when: "10 min ago",
    unread: true,
  },
  {
    id: "2",
    title: "Roster uploaded",
    body: "CS-207 roster applied to 241 students.",
    when: "2 hours ago",
    unread: false,
  },
];

/**
 * Notification dropdown with an unread badge. Uses a small fixed data set so
 * it renders without additional network calls; wired to swap for real events.
 */
export function NotificationDropdown() {
  const [open, setOpen] = useState(false);
  const [notes] = useState<Notification[]>(MOCK);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const unread = notes.filter((n) => n.unread).length;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="relative rounded-md p-1.5 text-ink-2 hover:bg-surface-hover hover:text-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
        aria-label="Notifications"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-danger text-[9px] font-medium text-white"
            aria-label={`${unread} unread`}
          >
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="surface-card absolute top-full right-0 mt-2 w-64 rounded-lg border border-line shadow-lg"
          role="menu"
        >
          <div className="border-b border-line px-3 py-2 text-xs font-medium text-ink-2">
            Notifications
          </div>
          <ul className="py-1">
            {notes.length === 0 ? (
              <li className="px-3 py-4 text-center text-xs text-ink-3">
                No notifications
              </li>
            ) : (
              notes.map((n) => (
                <li
                  key={n.id}
                  className={
                    "px-3 py-2 text-sm " +
                    (n.unread
                      ? "border-l-2 border-accent bg-accent/5"
                      : "border-l-2 border-transparent")
                  }
                >
                  <p
                    className={
                      "font-medium " + (n.unread ? "text-ink" : "text-ink-2")
                    }
                  >
                    {n.title}
                  </p>
                  {n.body && (
                    <p className="text-xs text-ink-3">{n.body}</p>
                  )}
                  <p className="text-[10px] text-ink-3">{n.when}</p>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
