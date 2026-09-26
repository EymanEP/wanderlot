import type { ReactNode } from "react";
import { cn } from "./cn.ts";

export interface IconTab<T extends string> {
  id: T;
  label: string;
  icon: ReactNode;
}

// The Plan page's category filter: icon over label, underline on the active one.
export function IconTabs<T extends string>({ tabs, value, onChange, label }: { tabs: readonly IconTab<T>[]; value: T; onChange: (id: T) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="-mx-4 flex gap-7 overflow-x-auto px-4 sm:mx-0 sm:gap-9 sm:px-0 [scrollbar-width:none]">
      {tabs.map((t) => {
        const on = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(t.id)}
            className={cn(
              "flex shrink-0 cursor-pointer flex-col items-center gap-2 border-b-2 bg-transparent px-0.5 pb-3 transition-colors",
              on ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink",
            )}
          >
            {t.icon}
            <span className={cn("text-xs", on ? "font-bold" : "font-semibold")}>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}
