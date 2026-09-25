import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { cn } from "../cn.ts";
import { CheckIcon, ChevronDownIcon } from "../icons.tsx";

export interface SelectOption<T extends string> {
  value: T;
  label: string;
}

export interface SelectProps<T extends string> {
  value: T;
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
  // Either a visible label's id or a plain accessible name.
  labelledBy?: string;
  label?: string;
  size?: "md" | "sm";
  placement?: "below" | "above";
  className?: string;
  id?: string;
}

// The canvas's dropdown: a button that opens a listbox. Arrow keys move,
// Enter picks, Escape or a click outside closes.
export function Select<T extends string>({ value, options, onChange, labelledBy, label, size = "md", placement = "below", className, id }: SelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const selected = options.find((o) => o.value === value) ?? options[0]!;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const openList = () => {
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  };
  const pick = (v: T) => {
    onChange(v);
    setOpen(false);
    button.current?.focus();
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        openList();
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(options.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      pick(options[active]!.value);
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <div ref={root} className={cn("relative", className)} onKeyDown={onKeyDown}>
      <button
        ref={button}
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-labelledby={labelledBy ? `${labelledBy} ${id ?? ""}`.trim() : undefined}
        aria-label={labelledBy ? undefined : label}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        onClick={() => (open ? setOpen(false) : openList())}
        className={cn(
          "box-border flex w-full cursor-pointer items-center justify-between gap-2.5 rounded-xl border border-line bg-surface text-left font-medium text-ink",
          size === "md" ? "h-[46px] px-3.5 text-[15px]" : "h-[42px] px-[13px] text-sm",
        )}
      >
        <span className="truncate">{selected.label}</span>
        <ChevronDownIcon size={16} className={cn("shrink-0 text-muted transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          aria-labelledby={labelledBy}
          className={cn(
            "absolute inset-x-0 z-20 m-0 flex list-none flex-col gap-0.5 rounded-tile bg-surface p-1.5 shadow-pop",
            placement === "below" ? "top-[calc(100%+6px)]" : "bottom-[calc(100%+6px)]",
          )}
        >
          {options.map((o, i) => {
            const isSelected = o.value === selected.value;
            return (
              <li
                key={o.value}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(o.value)}
                className={cn(
                  "flex h-11 cursor-pointer items-center justify-between gap-2.5 rounded-[10px] px-3 text-sm",
                  isSelected ? "bg-accent-soft font-bold" : "font-medium",
                  i === active && !isSelected && "bg-surface-2",
                )}
              >
                <span>{o.label}</span>
                {isSelected && <CheckIcon size={16} strokeWidth={2.6} className="shrink-0 text-accent" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
