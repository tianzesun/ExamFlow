import { Loader2 } from "lucide-react";

export function Spinner({ className = "" }: { className?: string }) {
  return     <Loader2 className={`animate-spin text-ink-3 ${className}`} />;
}

export function PageLoader() {
  return (
    <div className="flex min-h-[400px] items-center justify-center">
      <Spinner className="h-6 w-6" />
    </div>
  );
}
