import { type ReactNode } from "react";

type BadgeVariant = "default" | "info" | "success" | "warning" | "danger" | "violet";

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-surface-hover text-ink-2",
  info: "bg-accent/10 text-accent",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-danger/10 text-danger",
  violet: "bg-violet/10 text-violet",
};

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
}

export function Badge({ variant = "default", children, className = "" }: BadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${variantClasses[variant]} ${className}`}>
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
