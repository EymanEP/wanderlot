// Deciding the place and the dates together (ROADMAP 2.7): instead of exact
// days, the trip's length and the month or two it can happen in. Research
// then picks the best dates for each destination inside that window.
import { addDaysIso, copy, currentLocale, INTL_LOCALE } from "@wanderlot/core";
import { Field, Fieldset, Select, chipClasses, cn, useCopy } from "@wanderlot/ui";

const COPY = copy({
  es: {
    months: "Cuándo puede ser",
    monthsHint: "Uno o dos meses seguidos: toca el primero y luego el siguiente.",
    nights: "Cuántas noches",
    nightsOption: (n: number) => `${n} ${n === 1 ? "noche" : "noches"}`,
  },
  en: {
    months: "When it could be",
    monthsHint: "One or two months in a row: tap the first, then the next one.",
    nights: "How many nights",
    nightsOption: (n: number) => `${n} ${n === 1 ? "night" : "nights"}`,
  },
});

// "2026-11"
export type Month = string;

const monthStart = (m: Month) => `${m}-01`;
const nextMonth = (m: Month) => {
  const [y, mo] = m.split("-").map(Number) as [number, number];
  return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
};
const monthEnd = (m: Month) => addDaysIso(monthStart(nextMonth(m)), -1);

// The window a choice of months gives: from the first day (or tomorrow, this
// month) to the last.
export function windowOf(months: [Month, Month], today: string): { from: string; to: string } {
  const tomorrow = addDaysIso(today, 1);
  const from = monthStart(months[0]) < tomorrow ? tomorrow : monthStart(months[0]);
  return { from, to: monthEnd(months[1]) };
}

export function WindowField({
  today,
  months,
  onMonthsChange,
  nights,
  onNightsChange,
}: {
  today: string;
  months: [Month, Month] | null;
  onMonthsChange: (m: [Month, Month]) => void;
  nights: number;
  onNightsChange: (n: number) => void;
}) {
  const t = useCopy(COPY);
  // This month and the next eleven.
  const options: Month[] = [];
  for (let m = today.slice(0, 7); options.length < 12; m = nextMonth(m)) options.push(m);
  const label = (m: Month) => {
    const d = new Date(`${monthStart(m)}T12:00:00Z`);
    const name = new Intl.DateTimeFormat(INTL_LOCALE[currentLocale()], { month: "long", timeZone: "UTC" }).format(d);
    return m.slice(0, 4) === today.slice(0, 4) ? name : `${name} ${m.slice(0, 4)}`;
  };
  const pick = (m: Month) => {
    // A second month right after (or before) the one chosen widens it to
    // both; anything else starts again.
    if (months && months[0] === months[1] && nextMonth(months[0]) === m) return onMonthsChange([months[0], m]);
    if (months && months[0] === months[1] && nextMonth(m) === months[0]) return onMonthsChange([m, months[0]]);
    onMonthsChange([m, m]);
  };
  const on = (m: Month) => !!months && m >= months[0] && m <= months[1];
  return (
    <div className="flex flex-col gap-4">
      <Fieldset legend={t.months}>
        <span className="text-[13px] text-muted">{t.monthsHint}</span>
        <div className="flex flex-wrap gap-2">
          {options.map((m) => (
            <button key={m} type="button" aria-pressed={on(m)} onClick={() => pick(m)} className={cn(chipClasses("outline", on(m)), "capitalize")}>
              {label(m)}
            </button>
          ))}
        </div>
      </Fieldset>
      <Field label={t.nights} className="w-48">
        {({ inputId, labelId }) => (
          <Select
            id={inputId}
            labelledBy={labelId}
            value={String(nights)}
            onChange={(v) => onNightsChange(Number(v))}
            options={Array.from({ length: 20 }, (_, i) => i + 2).map((n) => ({ value: String(n), label: t.nightsOption(n) }))}
          />
        )}
      </Field>
    </div>
  );
}
