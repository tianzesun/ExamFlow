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
    <nav className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
      {breadcrumbs.map((bc, i) => (
        <span key={bc.href} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="h-3 w-3" />}
          {bc.isLast ? (
            <span className="font-medium text-zinc-700 dark:text-zinc-300">{bc.label}</span>
          ) : (
            <Link href={bc.href} className="hover:text-zinc-900 dark:hover:text-zinc-100">
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
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  if (!user) return null;

  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      {/* Top Nav */}
      <nav className="sticky top-0 z-50 border-b border-zinc-200 bg-white/80 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <Link href="/app" className="flex items-center gap-2 text-lg font-bold text-black dark:text-white">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-black text-white dark:bg-white dark:text-black">
                <FileText className="h-4 w-4" />
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
                    className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
                      isActive
                        ? "bg-zinc-100 font-medium text-black dark:bg-zinc-800 dark:text-white"
                        : "text-zinc-600 hover:bg-zinc-50 hover:text-black dark:text-zinc-400 dark:hover:bg-zinc-800/50 dark:hover:text-white"
                    }`}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Desktop user */}
            <div className="hidden items-center gap-3 md:flex">
              <div className="text-right">
                <p className="text-sm font-medium text-black dark:text-white">{user.display_name}</p>
                <p className="text-xs text-zinc-500">{user.role}</p>
              </div>
              <button
                onClick={() => { logout(); router.push("/login"); }}
                className="rounded-md p-2 text-zinc-500 hover:bg-zinc-100 hover:text-black dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
                title="Logout"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="rounded-md p-2 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 md:hidden"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        {mobileOpen && (
          <div className="border-t border-zinc-200 px-4 py-3 dark:border-zinc-800 md:hidden">
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
                        ? "bg-zinc-100 font-medium text-black dark:bg-zinc-800 dark:text-white"
                        : "text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800/50"
                    }`}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
            <div className="mt-3 border-t border-zinc-200 pt-3 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-black dark:text-white">{user.display_name}</p>
                  <p className="text-xs text-zinc-500">{user.role}</p>
                </div>
                <button
                  onClick={() => { logout(); router.push("/login"); setMobileOpen(false); }}
                  className="rounded-md p-2 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Breadcrumbs */}
      <div className="mx-auto max-w-7xl px-4 pt-4">
        <Breadcrumbs />
      </div>

      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppContent>{children}</AppContent>;
}
