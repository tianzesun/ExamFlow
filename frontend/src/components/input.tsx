import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className = "", id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-ink"
          >
            {label}
            {props.required && <span className="ml-0.5 text-danger">*</span>}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "flex h-9 w-full rounded-md border bg-surface px-3 py-2 text-sm text-ink transition-colors",
            "placeholder:text-ink-3",
            "focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent",
            "disabled:cursor-not-allowed disabled:opacity-50",
            error
              ? "border-danger focus:ring-danger/20 focus:border-danger"
              : "border-line hover:border-line-strong",
            className
          )}
          {...props}
        />
        {error && (
          <p className="text-xs text-danger">{error}</p>
        )}
        {hint && !error && (
          <p className="text-xs text-ink-3">{hint}</p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";
