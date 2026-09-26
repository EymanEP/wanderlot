import { useState } from "react";
import { rangeLabel } from "@wanderlot/core";
import { Calendar, Card, Chip, Fieldset, nightsBetween, pickRange, type DateRange } from "@wanderlot/ui";

const FLEX = [
  { value: 0, label: "Fechas exactas" },
  { value: 1, label: "± 1 día" },
  { value: 2, label: "± 2 días" },
] as const;

export type FlexDays = 0 | 1 | 2;

export function datesSummary({ start, end }: DateRange): string {
  if (!start) return "Elige el día de salida";
  if (!end) return "Ahora elige el día de vuelta";
  const n = nightsBetween(start, end);
  return `${rangeLabel(start, end)} · ${n} ${n === 1 ? "noche" : "noches"}`;
}

export interface TripDatesProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  flexDays: FlexDays;
  onFlexChange: (flex: FlexDays) => void;
  // Days before this can't be picked (tomorrow, for a new trip).
  min: string;
}

// When the trip is: click the day you leave, then the day you come back.
export function TripDates({ value, onChange, flexDays, onFlexChange, min }: TripDatesProps) {
  // Opens on the chosen start, or on the first month that can be picked.
  const opening = value.start ?? min;
  const [month, setMonth] = useState({ year: Number(opening.slice(0, 4)), month0: Number(opening.slice(5, 7)) - 1 });

  return (
    <Fieldset
      legend={
        <span className="flex items-center justify-between gap-3">
          Fechas
          <span className="font-semibold text-accent-strong tabular-nums" aria-live="polite">
            {datesSummary(value)}
          </span>
        </span>
      }
    >
      <Card variant="outline" radius="tile" padding="sm" className="flex flex-col gap-2.5">
        <Calendar {...month} onMonthChange={setMonth} start={value.start} end={value.end} min={min} onPick={(d) => onChange(pickRange(value, d))} />
        <div role="group" aria-label="Flexibilidad" className="flex gap-1.5 border-t border-line-faint pt-3">
          {FLEX.map((f) => (
            <Chip key={f.value} variant="subtle" size="sm" on={flexDays === f.value} onClick={() => onFlexChange(f.value)} className="flex-1">
              {f.label}
            </Chip>
          ))}
        </div>
      </Card>
    </Fieldset>
  );
}
