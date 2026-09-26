import { cn } from "./cn.ts";
import { IconButton } from "./Button.tsx";
import { ChevronLeftIcon, ChevronRightIcon } from "./icons.tsx";
import { dayRole, monthGrid, monthLabel, shiftMonth } from "./calendar.ts";

const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];
const WEEKDAY_NAMES = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

export interface CalendarProps {
  year: number;
  month0: number;
  onMonthChange: (next: { year: number; month0: number }) => void;
  // The highlighted stay. Picking a day moves the start; the length is the caller's.
  start: string | null;
  end: string | null;
  onPick: (date: string) => void;
  // Earliest pickable day (YYYY-MM-DD); earlier days and months are off.
  min?: string;
  className?: string;
}

export function Calendar({ year, month0, onMonthChange, start, end, onPick, min, className }: CalendarProps) {
  const cells = monthGrid(year, month0);
  const atMin = min !== undefined && year * 12 + month0 <= Number(min.slice(0, 4)) * 12 + Number(min.slice(5, 7)) - 1;
  const label = monthLabel(year, month0);
  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      <div className="flex items-center justify-between">
        <IconButton label="Mes anterior" tone="filled" size="md" disabled={atMin} className="disabled:cursor-not-allowed disabled:opacity-40" onClick={() => onMonthChange(shiftMonth(year, month0, -1))}>
          <ChevronLeftIcon size={16} />
        </IconButton>
        <span className="text-[15px] font-bold" aria-live="polite">
          {label}
        </span>
        <IconButton label="Mes siguiente" tone="filled" size="md" onClick={() => onMonthChange(shiftMonth(year, month0, 1))}>
          <ChevronRightIcon size={16} />
        </IconButton>
      </div>
      <div role="grid" aria-label={label} className="flex flex-col gap-1">
        <div role="row" className="grid grid-cols-7 gap-1">
          {WEEKDAYS.map((d, i) => (
            <span key={d} role="columnheader" aria-label={WEEKDAY_NAMES[i]} className="text-center text-[11px] font-bold text-muted">
              {d}
            </span>
          ))}
        </div>
        {Array.from({ length: 6 }, (_, w) => (
          <div role="row" key={w} className="grid grid-cols-7 gap-1">
            {cells.slice(w * 7, w * 7 + 7).map((c) => {
              const role = dayRole(c.date, start, end);
              const off = min !== undefined && c.date < min;
              return (
                <span role="gridcell" key={c.date} aria-selected={role !== "none"}>
                  <button
                    type="button"
                    onClick={() => onPick(c.date)}
                    aria-label={c.date}
                    disabled={off}
                    className={cn(
                      "flex h-9 w-full cursor-pointer items-center justify-center rounded-[10px] text-sm tabular-nums transition-colors disabled:cursor-not-allowed disabled:text-faint disabled:hover:bg-transparent",
                      role === "start" || role === "end"
                        ? "bg-accent font-bold text-white"
                        : role === "between"
                          ? "bg-accent-soft font-semibold text-accent-strong"
                          : c.inMonth
                            ? "text-ink hover:bg-surface-2"
                            : "text-[#757570] hover:bg-surface-2",
                    )}
                  >
                    {c.day}
                  </button>
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
