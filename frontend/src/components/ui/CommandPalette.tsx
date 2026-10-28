"use client";

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
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 px-4 pt-[14vh] backdrop-blur-[2px] animate-fade-in"
      onClick={() => onOpen(false)}
      aria-modal="true"
      role="dialog"
      aria-label="Command palette"
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-xl border border-line-strong bg-surface shadow-[var(--shadow-lg)] animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
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
  const [active, setActive] = useState(0);

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

  const run = (item: CommandItem) => {
    onClose();
    item.action?.();
    if (item.href) router.push(item.href);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") onClose();
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, visible.length - 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    }
    if (e.key === "Enter" && visible[active]) {
      e.preventDefault();
      run(visible[active]);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2.5 border-b border-line px-4 py-3">
        <Search size={16} className="shrink-0 text-ink-3" />
        <input
          ref={inputRef}
          type="search"
          placeholder="Search pages and actions…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          className="w-full border-none bg-transparent text-sm text-ink placeholder:text-ink-3 focus:outline-none focus-visible:outline-none"
        />
        <kbd className="rounded border border-line bg-surface-2 px-1.5 font-mono text-[10px] text-ink-3">Esc</kbd>
      </div>
      <nav className="max-h-80 overflow-y-auto p-1.5">
        {visible.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-ink-3">
            No results for &ldquo;{query}&rdquo;
          </p>
        ) : (
          visible.map((item, i) => (
            <button
              key={item.id}
              onMouseEnter={() => setActive(i)}
              onClick={(e) => {
                e.preventDefault();
                run(item);
              }}
              className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none ${
                i === active ? "bg-accent-subtle text-accent" : "text-ink"
              }`}
            >
              <span className={i === active ? "text-accent" : "text-ink-3"}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))
        )}
      </nav>
      <div className="flex items-center gap-3 border-t border-line bg-surface-2 px-4 py-2 text-[11px] text-ink-3">
        <span>↑↓ to navigate</span>
        <span>↵ to open</span>
      </div>
    </>
  );
}
