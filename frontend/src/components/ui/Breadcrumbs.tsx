"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

interface Crumb {
  label: string;
  href: string;
  isLast: boolean;
}

// Human-readable names for the dynamic routes that can't be derived from the
// URL segment alone (e.g. exam title, course code).
const LABEL: Record<string, string> = {
  app: "Workspace",
  courses: "Courses",
  "new": "New course",
  exams: "Exams",
  rooms: "Rooms",
  admin: "Admin",
  roster: "Roster",
  seating: "Seating",
  documents: "Documents",
  administration: "Administration",
};

function resolveCrumb(seg: string): string {
  // UUID / id segments → generic "Details"
  if (/^[0-9a-f-]{8,}$/i.test(seg)) return "Details";
  return LABEL[seg] ?? seg.charAt(0).toUpperCase() + seg.slice(1);
}

/**
 * Breadcrumbs derived from the current pathname. Hidden at the dashboard root.
 */
export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length <= 1) return null;

  const crumbs: Crumb[] = segments.map((seg, i) => ({
    label: resolveCrumb(seg),
    href: "/" + segments.slice(0, i + 1).join("/"),
    isLast: i === segments.length - 1,
  }));

  return (
    <nav
      className="flex items-center gap-1 text-xs text-ink-3"
      aria-label="Breadcrumb"
    >
      <Link
        href="/app"
        className="text-ink-2 hover:text-ink"
        aria-label="Home"
      >
        Workspace
      </Link>
      <ChevronRight className="h-3 w-3" />
      {crumbs.map((c) => (
        <span key={c.href} className="flex items-center gap-1">
          {c.isLast ? (
            <span className="truncate font-medium text-ink-2">{c.label}</span>
          ) : (
            <Link
              href={c.href}
              className="truncate transition-colors hover:text-ink"
            >
              {c.label}
            </Link>
          )}
          {!c.isLast && <ChevronRight className="h-3 w-3" />}
        </span>
      ))}
    </nav>
  );
}
