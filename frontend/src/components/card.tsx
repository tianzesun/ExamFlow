import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className = "" }: CardProps) {
  return (
    <div className={cn("surface-card", className)}>{children}</div>
  );
}

export function CardHeader({ children, className = "" }: CardProps) {
  return (
    <div className={cn("border-b border-line px-6 py-4", className)}>
      {children}
    </div>
  );
}

export function CardContent({ children, className = "" }: CardProps) {
  return <div className={cn("px-6 py-4", className)}>{children}</div>;
}
