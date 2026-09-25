// Month grid maths for the Calendar component. Dates are plain YYYY-MM-DD
// strings so nothing depends on the viewer's time zone.

export interface DayCell {
  date: string; // YYYY-MM-DD
  day: number;
  inMonth: boolean;
}

const pad = (n: number) => String(n).padStart(2, "0");

export function toIsoDate(y: number, m0: number, d: number): string {
  const t = new Date(Date.UTC(y, m0, d));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  return toIsoDate(y, m - 1, d + days);
}

// Six Monday-first weeks covering the month, padded with the neighbours' days.
export function monthGrid(year: number, month0: number): DayCell[] {
  const first = new Date(Date.UTC(year, month0, 1));
  const lead = (first.getUTCDay() + 6) % 7; // days before the 1st, Monday = 0
  return Array.from({ length: 42 }, (_, i) => {
    const t = new Date(Date.UTC(year, month0, 1 - lead + i));
    return {
      date: toIsoDate(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()),
      day: t.getUTCDate(),
      inMonth: t.getUTCMonth() === month0,
    };
  });
}

export type DayRole = "start" | "end" | "between" | "none";

export function dayRole(date: string, start: string | null, end: string | null): DayRole {
  if (!start) return "none";
  if (date === start) return "start";
  if (end && date === end) return "end";
  if (end && date > start && date < end) return "between";
  return "none";
}

export function monthLabel(year: number, month0: number): string {
  const name = new Intl.DateTimeFormat("es-ES", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(year, month0, 1)));
  return `${name[0]!.toUpperCase()}${name.slice(1)} ${year}`;
}

export function shiftMonth(year: number, month0: number, by: number): { year: number; month0: number } {
  const t = new Date(Date.UTC(year, month0 + by, 1));
  return { year: t.getUTCFullYear(), month0: t.getUTCMonth() };
}
