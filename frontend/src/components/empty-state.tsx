import { type ReactNode } from "react";
import { Inbox } from "lucide-react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-line bg-surface-2">
        {icon || <Inbox className="h-5 w-5 text-ink-3" />}
      </div>
      <h3 className="mt-4 text-sm font-semibold text-ink">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-ink-2">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
