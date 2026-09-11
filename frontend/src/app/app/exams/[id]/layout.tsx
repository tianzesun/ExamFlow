import type { ReactNode } from "react";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-ink-950 text-ink-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto w-full max-w-[1440px]">{children}</div>
    </main>
  );
}
