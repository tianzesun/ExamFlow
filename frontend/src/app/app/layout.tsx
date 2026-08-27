"use client";

import { useAuth } from "@/lib/auth/context";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard,
  BookOpen,
  FileText,
  DoorOpen,
  Shield,
  LogOut,
  Menu,
  X,
  Search,
} from "lucide-react";
import {
  Spinner,
  CommandPalette,
  NotificationDropdown,
  Breadcrumbs as BreadcrumbsGlobal,
  type CommandItem,
} from "@/components";
import { CourseProvider } from "@/lib/course-context";
import { CourseSwitcher } from "@/components/dashboard/CourseSwitcher";

const NAV_ITEMS = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/app/courses", label: "Courses", icon: BookOpen },
  { href: "/app/exams", label: "Exams", icon: FileText },
  { href: "/app/rooms", label: "Rooms", icon: DoorOpen },
  { href: "/app/admin", label: "Admin", icon: Shield, adminOnly: true },
];

function AppContent({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const isDashboard = pathname === "/app";

  const commandItems = useMemo<CommandItem[]>(
    () =>
      NAV_ITEMS.filter(
        (item) => !item.adminOnly || user?.role === "ADMIN",
      ).map((item) => ({
        id: item.href,
        label: item.label,
        href: item.href,
        icon: <item.icon className="h-4 w-4" />,
      })),
    [user?.role],
  );

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
            {/* Command palette toggle (Search) */}
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="hidden rounded-md p-1.5 text-ink-2 hover:bg-surface-hover hover:text-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent sm:flex"
              aria-label="Search (⌘K)"
              title="Search (⌘K)"
            >
              <Search className="h-4 w-4" />
            </button>
            <CommandPalette
              open={paletteOpen}
              onOpen={setPaletteOpen}
              items={commandItems}
            />
            {/* Notifications */}
            <div className="hidden sm:block">
              <NotificationDropdown />
            </div>
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
          <BreadcrumbsGlobal />
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
