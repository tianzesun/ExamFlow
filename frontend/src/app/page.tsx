import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-50 dark:bg-black">
      <main className="flex flex-col items-center gap-6 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-black dark:text-white">
          ExamFlow
        </h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400">
          University examination administration platform
        </p>
        <p className="text-sm text-zinc-500 dark:text-zinc-500">
          Phase 1 - Authentication + Application Foundation
        </p>
        <div className="flex gap-4">
          <Link
            href="/login"
            className="rounded-md bg-black px-6 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            Sign in
          </Link>
          <Link
            href="/app"
            className="rounded-md border border-zinc-300 px-6 py-2 text-sm font-medium text-black hover:bg-zinc-100 dark:border-zinc-700 dark:text-white dark:hover:bg-zinc-800"
          >
            Go to App
          </Link>
        </div>
      </main>
    </div>
  );
}
