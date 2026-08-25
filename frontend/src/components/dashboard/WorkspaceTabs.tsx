"use client";

import { type ReactNode } from "react";
import { type LucideIcon } from "lucide-react";

interface Tab {
  id: string;
  label: string;
  icon: LucideIcon;
  count?: number;
}

interface WorkspaceTabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  actions?: ReactNode;
}

export function WorkspaceTabs({
  tabs,
  activeTab,
  onTabChange,
  actions,
}: WorkspaceTabsProps) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line bg-surface px-6">
      <nav className="flex gap-1 overflow-x-auto" aria-label="Tabs">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`relative -mb-px inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "border-accent text-ink"
                  : "border-transparent text-ink-2 hover:border-line-strong hover:text-ink"
              }`}
              aria-current={isActive ? "page" : undefined}
            >
              <tab.icon
                className={`h-4 w-4 ${isActive ? "text-accent" : "text-ink-3"}`}
              />
              {tab.label}
              {tab.count !== undefined && (
                <span
                  className={`tnum rounded-full px-1.5 py-0.5 text-[11px] font-medium ${
                    isActive
                      ? "bg-accent/10 text-accent"
                      : "bg-surface-hover text-ink-3"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>
      {actions && <div className="hidden shrink-0 sm:block">{actions}</div>}
    </div>
  );
}
