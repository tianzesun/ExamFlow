"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";

interface Crumb {
  label: string;
  href: string;
  isLast: boolean;
}

// Human-readable names for the dynamic routes that can't be derived from the
// URL segment alone (e.g. exam title, course code).
const LABEL: Record<string, string> = {
  courses: "Courses",
  exams: "Exams",
  rooms: "Rooms",
  admin: "Admin",
  roster: "Students",
  seating: "Seats",
  "seat-map": "Seat map",
  documents: "Exam papers",
  administration: "Exam day",
};

// "new" is labelled after its parent collection: /rooms/new → "New room".
const NEW_LABEL: Record<string, string> = {
  courses: "New course",
  exams: "New exam",
  rooms: "New room",
};

function resolveCrumb(seg: string, parent?: string): string {
  if (seg === "new") return (parent && NEW_LABEL[parent]) ?? "New";
  // UUID / id segments → generic "Details"
  if (/^[0-9a-f-]{8,}$/i.test(seg)) return "Exam";
  return LABEL[seg] ?? seg.charAt(0).toUpperCase() + seg.slice(1);
}

/**
 * Breadcrumbs derived from the current pathname, rendered in the app top bar.
 */
export function Breadcrumbs() {
  const pathname = usePathname();
  // Drop the leading "app" segment; the home icon already stands for it.
  const segments = pathname.split("/").filter(Boolean).slice(1);

  const crumbs: Crumb[] = segments.map((seg, i) => ({
    label: resolveCrumb(seg, segments[i - 1]),
    href: "/app/" + segments.slice(0, i + 1).join("/"),
    isLast: i === segments.length - 1,
  }));

  return (
    <nav
      className="flex min-w-0 items-center gap-1.5 text-[13px] text-ink-3"
      aria-label="Breadcrumb"
    >
      <Link
        href="/app"
        className="flex items-center rounded p-0.5 text-ink-3 transition-colors hover:text-ink"
        aria-label="Dashboard"
      >
        <Home className="h-3.5 w-3.5" />
      </Link>
      {crumbs.length === 0 && (
        <>
          <ChevronRight className="h-3 w-3 shrink-0 text-ink-3/60" />
          <span className="font-medium text-ink">Dashboard</span>
        </>
      )}
      {crumbs.length > 0 && <ChevronRight className="h-3 w-3 shrink-0 text-ink-3/60" />}
      {crumbs.map((c) => (
        <span key={c.href} className="flex min-w-0 items-center gap-1.5">
          {c.isLast ? (
            <span className="truncate font-medium text-ink">{c.label}</span>
          ) : (
            <Link
              href={c.href}
              className="truncate transition-colors hover:text-ink"
            >
              {c.label}
            </Link>
          )}
          {!c.isLast && <ChevronRight className="h-3 w-3 shrink-0 text-ink-3/60" />}
        </span>
      ))}
    </nav>
  );
}
