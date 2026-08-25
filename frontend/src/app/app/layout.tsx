"use client";

import { useAuth } from "@/lib/auth/context";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  BookOpen,
  FileText,
  DoorOpen,
  Shield,
  LogOut,
  Menu,
  X,
  ChevronRight,
} from "lucide-react";
import { Spinner } from "@/components";
import { CourseProvider } from "@/lib/course-context";
import { CourseSwitcher } from "@/components/dashboard/CourseSwitcher";

const NAV_ITEMS = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/app/courses", label: "Courses", icon: BookOpen },
  { href: "/app/exams", label: "Exams", icon: FileText },
  { href: "/app/rooms", label: "Rooms", icon: DoorOpen },
  { href: "/app/admin", label: "Admin", icon: Shield, adminOnly: true },
];

function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length <= 1) return null;

  const breadcrumbs = segments.map((seg, i) => {
    const href = "/" + segments.slice(0, i + 1).join("/");
    const label = seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, " ");
    return { href, label, isLast: i === segments.length - 1 };
  });

  return (
    <nav className="flex items-center gap-1 text-xs text-ink-3" aria-label="Breadcrumb">
      {breadcrumbs.map((bc, i) => (
        <span key={bc.href} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="h-3 w-3" />}
          {bc.isLast ? (
            <span className="font-medium text-ink-2">{bc.label}</span>
          ) : (
            <Link href={bc.href} className="transition-colors hover:text-ink">
              {bc.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}

function AppContent({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isDashboard = pathname === "/app";

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <Spinner className="h-6 w-6 text-ink-3" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <CourseProvider>
      <div className={isDashboard ? "app-canvas flex h-screen flex-col overflow-hidden" : "app-canvas"}>
      {/* Top Nav */}
      <nav className="sticky top-0 z-50 border-b border-line bg-surface/90 backdrop-blur">
        <div className="flex w-full items-center justify-between gap-4 px-4 py-2.5">
          <div className="flex items-center gap-8">
            <Link href="/app" className="flex items-center gap-2 text-[15px] font-semibold tracking-tight text-ink">
              <div className="flex h-7 w-7 items-center justify-center rounded-md border border-line-strong bg-white dark:bg-surface-2">
                <FileText className="h-3.5 w-3.5 text-accent" />
              </div>
              ExamFlow
            </Link>
            {/* Desktop nav */}
            <div className="hidden items-center gap-1 md:flex">
              {NAV_ITEMS.filter((item) => !item.adminOnly || user.role === "ADMIN").map((item) => {
                const isActive = item.exact
                  ? pathname === item.href
                  : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`relative inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
                      isActive
                        ? "bg-surface-hover font-medium text-ink"
                        : "text-ink-2 hover:bg-surface-hover hover:text-ink"
                    }`}
                  >
                    <item.icon className={`h-4 w-4 ${isActive ? "text-accent" : "text-ink-3"}`} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Course context switcher */}
            <div className="hidden md:block">
              <CourseSwitcher />
            </div>
            {/* Desktop user */}
            <div className="hidden items-center gap-2 md:flex">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold text-ink ring-1 ring-line">
                  {(user.display_name || "U").charAt(0).toUpperCase()}
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium leading-tight text-ink">{user.display_name}</p>
                  <p className="text-[11px] leading-tight text-ink-3">{user.role}</p>
                </div>
              </div>
              <button
                onClick={() => { logout(); router.push("/login"); }}
                className="rounded-md p-1.5 text-ink-3 hover:bg-surface-hover hover:text-ink"
                title="Logout"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="rounded-md p-1.5 text-ink-2 hover:bg-surface-hover md:hidden"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        {mobileOpen && (
          <div className="border-t border-line px-4 py-3 md:hidden">
            <div className="mb-2">
              <CourseSwitcher />
            </div>
            <div className="flex flex-col gap-1">
              {NAV_ITEMS.filter((item) => !item.adminOnly || user.role === "ADMIN").map((item) => {
                const isActive = item.exact
                  ? pathname === item.href
                  : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                      isActive
                        ? "bg-surface-hover font-medium text-ink"
                        : "text-ink-2 hover:bg-surface-hover hover:text-ink"
                    }`}
                  >
                    <item.icon className={`h-4 w-4 ${isActive ? "text-accent" : "text-ink-3"}`} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
              <div>
                <p className="text-sm font-medium text-ink">{user.display_name}</p>
                <p className="text-xs text-ink-3">{user.role}</p>
              </div>
              <button
                onClick={() => { logout(); router.push("/login"); setMobileOpen(false); }}
                className="rounded-md p-2 text-ink-3 hover:bg-surface-hover hover:text-ink"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* Breadcrumbs (hidden on the full-bleed dashboard) */}
      {!isDashboard && (
        <div className="mx-auto max-w-7xl px-4 pt-4">
          <Breadcrumbs />
        </div>
      )}

      <main
        className={
          isDashboard
            ? "flex min-h-0 w-full flex-1 flex-col"
            : "min-h-0 w-full flex-1 px-4 py-6"
        }
      >
        {children}
      </main>
    </div>
    </CourseProvider>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppContent>{children}</AppContent>;
}
