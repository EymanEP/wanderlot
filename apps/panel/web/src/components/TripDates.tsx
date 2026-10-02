import { useState } from "react";
import { copy, pick, rangeLabel } from "@wanderlot/core";
import { Calendar, Card, Chip, Fieldset, nightsBetween, pickRange, useCopy, type DateRange } from "@wanderlot/ui";

const COPY = copy({
  es: {
    exact: "Fechas exactas",
    flex: (n: number) => `± ${n} ${n === 1 ? "día" : "días"}`,
    pickStart: "Elige el día de salida",
    pickEnd: "Ahora elige el día de vuelta",
    summary: (range: string, n: number) => `${range} · ${n} ${n === 1 ? "noche" : "noches"}`,
    legend: "Fechas",
    flexibility: "Flexibilidad",
  },
  en: {
    exact: "Exact dates",
    flex: (n: number) => `± ${n} ${n === 1 ? "day" : "days"}`,
    pickStart: "Pick the day you leave",
    pickEnd: "Now pick the day you come back",
    summary: (range: string, n: number) => `${range} · ${n} ${n === 1 ? "night" : "nights"}`,
    legend: "Dates",
    flexibility: "Flexibility",
  },
});

const FLEX = [0, 1, 2] as const;

export type FlexDays = 0 | 1 | 2;

export function datesSummary({ start, end }: DateRange): string {
  const t = pick(COPY);
  if (!start) return t.pickStart;
  if (!end) return t.pickEnd;
  return t.summary(rangeLabel(start, end), nightsBetween(start, end));
}

export interface TripDatesProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  // The ± days chips; left out without onFlexChange.
  flexDays?: FlexDays;
  onFlexChange?: (flex: FlexDays) => void;
  // Days before this can't be picked (tomorrow, for a new trip).
  min: string;
}

// When the trip is: click the day you leave, then the day you come back.
export function TripDates({ value, onChange, flexDays, onFlexChange, min }: TripDatesProps) {
  const t = useCopy(COPY);
  // Opens on the chosen start, or on the first month that can be picked.
  const opening = value.start ?? min;
  const [month, setMonth] = useState({ year: Number(opening.slice(0, 4)), month0: Number(opening.slice(5, 7)) - 1 });

  return (
    <Fieldset
      legend={
        <span className="flex items-center justify-between gap-3">
          {t.legend}
          <span className="font-semibold text-accent-strong tabular-nums" aria-live="polite">
            {datesSummary(value)}
          </span>
        </span>
      }
    >
      <Card variant="outline" radius="tile" padding="sm" className="flex flex-col gap-2.5">
        <Calendar {...month} onMonthChange={setMonth} start={value.start} end={value.end} min={min} onPick={(d) => onChange(pickRange(value, d))} />
        {onFlexChange && (
          <div role="group" aria-label={t.flexibility} className="flex gap-1.5 border-t border-line-faint pt-3">
            {FLEX.map((f) => (
              <Chip key={f} variant="subtle" size="sm" on={flexDays === f} onClick={() => onFlexChange(f)} className="flex-1">
                {f === 0 ? t.exact : t.flex(f)}
              </Chip>
            ))}
          </div>
        )}
      </Card>
    </Fieldset>
  );
}
