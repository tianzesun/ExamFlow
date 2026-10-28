import { type ReactNode } from "react";

type BadgeVariant = "default" | "info" | "success" | "warning" | "danger" | "violet";

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-surface-hover text-ink-2 ring-line",
  info: "bg-accent/10 text-accent ring-accent/20",
  success: "bg-success/10 text-success ring-success/20",
  warning: "bg-warning/10 text-warning ring-warning/20",
  danger: "bg-danger/10 text-danger ring-danger/20",
  violet: "bg-violet/10 text-violet ring-violet/20",
};

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
}

export function Badge({ variant = "default", children, className = "" }: BadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${variantClasses[variant]} ${className}`}>
      {children}
    </span>
  );
}

export const STATUS_BADGES: Record<string, BadgeVariant> = {
  DRAFT: "default",
  CONFIGURED: "info",
  READY: "warning",
  GENERATED: "violet",
  COMPLETED: "success",
  ARCHIVED: "default",
};
