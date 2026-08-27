import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

export interface CommandItem {
  id: string;
  label: string;
  href?: string;
  action?: () => void;
  icon?: React.ReactNode;
  keywords?: string;
}

interface CommandPaletteProps {
  open: boolean;
  onOpen: (open: boolean) => void;
  items: CommandItem[];
}

/**
 * Minimal ⌘K command palette. Renders an overlay with a set of navigation
 * items. Designed to be toggled from the global layout via the
 * `open`/`onOpen` pair (kept host-controlled, no global singleton).
 */
export function CommandPalette({ open, onOpen, items }: CommandPaletteProps) {
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpen(!open);
      }
      if (e.key === "Escape") {
        e.preventDefault();
        onOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpen]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[calc(4rem+3.5rem)]"
      onClick={() => onOpen(false)}
      aria-modal="true"
      role="dialog"
    >
      <div
        className="surface-card w-full max-w-xl overflow-hidden rounded-lg border border-line shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-line px-3 py-2.5">
          <div className="flex items-center gap-2 text-xs text-ink-3">
            <span>⌘K</span>
            <span>· Type to navigate</span>
          </div>
        </div>
        <PaletteInput
          items={items}
          router={router}
          onClose={() => onOpen(false)}
        />
      </div>
    </div>
  );
}

function PaletteInput({
  items,
  router,
  onClose,
}: {
  items: CommandItem[];
  router: ReturnType<typeof useRouter>;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    const base = items.filter((i) => !i.href?.startsWith("#"));
    if (!term) return base;
    return base.filter(
      (i) =>
        i.label.toLowerCase().includes(term) ||
        (i.keywords?.toLowerCase().includes(term) ?? false),
    );
  }, [items, query]);

  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") onClose();
  };

  return (
    <>
      <div className="relative border-b border-line px-3 py-2">
        <Search
          size={16}
          className="absolute left-5 top-1/2 -translate-y-1/2 text-ink-3"
        />
        <input
          ref={inputRef}
          type="search"
          placeholder="Search actions..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          className="w-full border-none bg-transparent text-sm text-ink placeholder-ink-3 focus:outline-none"
        />
      </div>
      <nav className="max-h-80 overflow-y-auto py-1">
        {visible.length === 0 ? (
          <p className="px-3 py-4 text-center text-xs text-ink-3">
            No actions found
          </p>
        ) : (
          visible.map((item) => (
            <button
              key={item.id}
              onClick={(e) => {
                e.preventDefault();
                onClose();
                item.action?.();
                if (item.href) router.push(item.href);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
            >
              {item.icon}
              <span>{item.label}</span>
              {item.keywords && (
                <span className="ml-auto text-xs text-ink-3">{item.keywords}</span>
              )}
            </button>
          ))
        )}
      </nav>
    </>
  );
}
