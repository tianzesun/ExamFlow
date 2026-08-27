import { type ReactNode } from "react";

interface SkeletonProps {
  children?: ReactNode;
  className?: string;
}

/**
 * Reusable shimmer block. Applies the global `.skeleton` utility (CSS shimmer)
 * and fills the dimensions given via `className` (e.g. `h-4 w-20`).
 */
export function Skeleton({ children, className = "" }: SkeletonProps) {
  return (
    <div
      className={`skeleton ${className}`}
      aria-busy="true"
      aria-label="Loading"
    >
      {children}
    </div>
  );
}

export function SkeletonRow({
  lines = 1,
  className = "",
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div
      className={`space-y-2 ${className}`}
      aria-busy="true"
      aria-label="Loading list"
    >
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={
            i === lines - 1
              ? "h-3 w-3/4 opacity-60"
              : "h-3 w-full opacity-80"
          }
        />
      ))}
    </div>
  );
}
