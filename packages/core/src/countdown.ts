// The countdown on El viaje: how long until the trip, and once it has
// started, which day of it this is. Dates without time are the viewer's local
// days; the departure is the flight's own time when it's known.

const DAY_MS = 24 * 60 * 60 * 1000;

// How far back the flight path on the countdown starts: the plane sets off
// eight weeks before the trip and lands on the day.
export const COUNTDOWN_RUNWAY_DAYS = 56;

export type Countdown =
  | {
      phase: "before";
      // Until take-off, split as a clock shows it.
      msLeft: number;
      days: number;
      hours: number;
      minutes: number;
      seconds: number;
      // Days on the calendar: 1 is tomorrow, 0 is today.
      calendarDays: number;
      // 0 at the start of the runway, 1 at take-off.
      progress: number;
    }
  | { phase: "during"; day: number; of: number; progress: number }
  | { phase: "after" };

function localDay(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
}

function startOfDay(at: Date): Date {
  return new Date(at.getFullYear(), at.getMonth(), at.getDate());
}

// Whole days between two local dates, ignoring daylight-saving hours.
function daysApart(from: Date, to: Date): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / DAY_MS);
}

// When the trip starts: the outbound flight's departure if it's on the first
// day, otherwise the first day's midnight.
export function departureAt(dateFrom: string, departAt?: string | null): Date {
  if (departAt && departAt.slice(0, 10) === dateFrom) {
    const at = new Date(departAt);
    if (!Number.isNaN(at.getTime())) return at;
  }
  return localDay(dateFrom);
}

export function tripCountdown(trip: { dateFrom: string; dateTo: string; departAt?: string | null }, now: Date): Countdown {
  const start = departureAt(trip.dateFrom, trip.departAt);
  const last = localDay(trip.dateTo);
  const msLeft = start.getTime() - now.getTime();
  if (msLeft > 0) {
    const s = Math.floor(msLeft / 1000);
    return {
      phase: "before",
      msLeft,
      days: Math.floor(s / 86400),
      hours: Math.floor((s % 86400) / 3600),
      minutes: Math.floor((s % 3600) / 60),
      seconds: s % 60,
      calendarDays: Math.max(0, daysApart(now, localDay(trip.dateFrom))),
      progress: Math.min(1, Math.max(0, 1 - msLeft / (COUNTDOWN_RUNWAY_DAYS * DAY_MS))),
    };
  }
  const of = daysApart(localDay(trip.dateFrom), last) + 1;
  const day = daysApart(localDay(trip.dateFrom), now) + 1;
  if (day > of) return { phase: "after" };
  const d = Math.max(1, day);
  return { phase: "during", day: d, of, progress: of <= 1 ? 1 : (d - 1) / (of - 1) };
}
