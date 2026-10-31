"use client";

import { useAuth } from "@/lib/auth/context";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
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
  Sun,
  Moon,
  Plus,
} from "lucide-react";
import {
  Spinner,
  CommandPalette,
  Breadcrumbs,
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

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Administrator",
  STAFF: "Exam staff",
  INSTRUCTOR: "Instructor",
};

function Logo() {
  return (
    <Link href="/app" className="flex items-center gap-2.5 px-1">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-grad-primary text-white shadow-[0_6px_18px_-6px_rgba(124,77,255,0.8)]">
        <FileText className="h-4 w-4" />
      </span>
      <span className="leading-tight">
        <span className="block text-[15px] font-semibold tracking-tight text-ink">ExamFlow</span>
        <span className="block text-[11px] text-ink-3">Exam administration</span>
      </span>
    </Link>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  // false during SSR/hydration, true on the client — avoids a theme icon mismatch.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const dark = mounted && resolvedTheme === "dark";
  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? "light" : "dark")}
      className="rounded-lg p-2 text-ink-2 transition-colors hover:bg-surface-hover hover:text-ink"
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      title={dark ? "Light theme" : "Dark theme"}
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

function AppContent({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const navItems = useMemo(
    () => NAV_ITEMS.filter((item) => !item.adminOnly || user?.role === "ADMIN"),
    [user?.role],
  );

  const commandItems = useMemo<CommandItem[]>(
    () => [
      ...navItems.map((item) => ({
        id: item.href,
        label: `Go to ${item.label}`,
        href: item.href,
        icon: <item.icon className="h-4 w-4" />,
      })),
      { id: "new-exam", label: "Create exam", href: "/app/exams/new", icon: <Plus className="h-4 w-4" />, keywords: "new" },
      { id: "new-course", label: "Create course", href: "/app/courses/new", icon: <Plus className="h-4 w-4" />, keywords: "new" },
      { id: "new-room", label: "Create room", href: "/app/rooms/new", icon: <Plus className="h-4 w-4" />, keywords: "new" },
    ],
    [navItems],
  );

  useEffect(() => {
    if (!loading && !user) {
      // Come back to this page after signing in.
      router.push(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [user, loading, router, pathname]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <Spinner className="h-6 w-6 text-ink-3" />
      </div>
    );
  }

  if (!user) return null;

  const initials = (user.display_name || "U")
    .split(/\s+/)
    .map((p) => p.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center px-4">
        <Logo />
      </div>

      <div className="px-3 pb-2 pt-1">
        <CourseSwitcher />
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3" aria-label="Main">
        <p className="eyebrow px-2.5 pb-2">Menu</p>
        {navItems.map((item) => {
          const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              onClick={() => setMobileOpen(false)}
              className={`group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                isActive
                  ? "nav-active font-medium text-white"
                  : "text-ink-2 hover:bg-surface-hover hover:text-ink"
              }`}
            >
              <item.icon className={`h-4 w-4 ${isActive ? "text-[#a9b8ff]" : "text-ink-3 group-hover:text-ink-2"}`} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-line p-3">
        <div className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent to-violet text-xs font-semibold text-white dark:text-[#0a0c10]">
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium leading-tight text-ink">{user.display_name}</p>
            <p className="truncate text-[11px] leading-tight text-ink-3">{ROLE_LABEL[user.role] ?? user.role}</p>
          </div>
          <button
            onClick={() => { logout(); router.push("/login"); }}
            className="rounded-lg p-1.5 text-ink-3 transition-colors hover:bg-surface-hover hover:text-ink"
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <CourseProvider>
      <div className="app-canvas flex h-screen overflow-hidden">
        {/* Desktop sidebar */}
        <aside className="dark sidebar-shell hidden w-64 shrink-0 lg:block">
          {sidebar}
        </aside>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="absolute inset-0 bg-black/40 animate-fade-in"
              onClick={() => setMobileOpen(false)}
            />
            <aside className="dark sidebar-shell absolute inset-y-0 left-0 w-72 shadow-[var(--shadow-lg)] animate-fade-in">
              <button
                onClick={() => setMobileOpen(false)}
                className="absolute right-3 top-3.5 rounded-lg p-1.5 text-ink-2 hover:bg-surface-hover"
                aria-label="Close menu"
              >
                <X className="h-4 w-4" />
              </button>
              {sidebar}
            </aside>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Top bar */}
          <header className="glass sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 px-4 sm:px-6">
            <button
              onClick={() => setMobileOpen(true)}
              className="-ml-1.5 rounded-lg p-1.5 text-ink-2 hover:bg-surface-hover lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1">
              <Breadcrumbs />
            </div>
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="hidden h-9 w-72 items-center gap-2 rounded-xl border border-line bg-surface/80 px-3 shadow-[var(--shadow-sm)] text-sm text-ink-3 transition-colors hover:border-line-strong hover:text-ink-2 md:flex"
              aria-label="Search (Ctrl K)"
            >
              <Search className="h-3.5 w-3.5" />
              <span className="flex-1 text-left">Search or jump to…</span>
              <kbd className="rounded border border-line bg-surface px-1.5 font-mono text-[10px] text-ink-3">⌘K</kbd>
            </button>
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="rounded-lg p-2 text-ink-2 hover:bg-surface-hover md:hidden"
              aria-label="Search"
            >
              <Search className="h-4 w-4" />
            </button>
            <ThemeToggle />
            <CommandPalette open={paletteOpen} onOpen={setPaletteOpen} items={commandItems} />
          </header>

          <main className="min-h-0 w-full flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </CourseProvider>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppContent>{children}</AppContent>;
}
