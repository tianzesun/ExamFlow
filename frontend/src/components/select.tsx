import { forwardRef, type SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, hint, options, placeholder, className = "", id, ...props }, ref) => {
    const selectId = id || label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={selectId}
            className="block text-sm font-medium text-ink"
          >
            {label}
            {props.required && <span className="ml-0.5 text-danger">*</span>}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={cn(
            "flex h-9 w-full rounded-lg border bg-surface px-3 py-2 text-sm text-ink shadow-[var(--shadow-sm)] transition-[color,border-color,box-shadow]",
            "focus:outline-none focus-visible:outline-none focus:ring-3 focus:ring-accent/15 focus:border-accent",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "dark:[&>option]:bg-surface",
            error
              ? "border-danger focus:ring-danger/20 focus:border-danger"
              : "border-line-strong hover:border-ink-3/50",
            className
          )}
          {...props}
        >
          {placeholder && (
            <option value="" className="text-ink-3">
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
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
Select.displayName = "Select";
