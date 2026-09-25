// Spanish display helpers shared by the panel and the site.
import type { Destination, FlightLeg, Proposal, Stay } from "./model.ts";
import { baseStay } from "./pricing.ts";

const TZ = "Europe/Madrid";

export function euros(cents: number, opts: { decimals?: boolean } = {}): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: opts.decimals ? 2 : 0,
    maximumFractionDigits: opts.decimals ? 2 : 0,
    useGrouping: true,
  })
    .format(cents / 100)
    .replace(/ €/, " €");
}

// Spanish groups thousands with a space in prose ("1 720 €"), even for 4 digits.
export function eurosGrouped(cents: number): string {
  const whole = Math.round(cents / 100);
  return `${String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} €`;
}

export function minutesBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 60_000);
}

// "1 h 20 m", "45 m"
export function duration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} m`;
  return `${h} h ${String(m).padStart(2, "0")} m`;
}

export function legDuration(leg: FlightLeg): string {
  return duration(minutesBetween(leg.departAt, leg.arriveAt));
}

export function stopsLabel(stops: number): string {
  if (stops === 0) return "Directo";
  return stops === 1 ? "1 escala" : `${stops} escalas`;
}

// "Directo · 1 h 20 m"
export function tripLabel(leg: FlightLeg): string {
  return `${stopsLabel(leg.stops)} · ${legDuration(leg)}`;
}

// Local wall-clock time of a leg's departure or arrival, in the airport's own offset.
export function localTime(iso: string): string {
  return iso.slice(11, 16);
}

export function flightPriceCents(p: Pick<Proposal, "outbound" | "inbound">): number {
  return p.outbound.priceCents + p.inbound.priceCents;
}

// A person's share of one night at the base stay.
export function stayPerPersonNightCents(stays: readonly Stay[], partySize: number): number | null {
  const stay = baseStay(stays);
  return stay ? Math.round(stay.nightlyCents / partySize) : null;
}

export function stayTotalCents(stay: Stay, nights: number): number {
  return stay.nightlyCents * nights;
}

export function thingsCount(p: Pick<Destination, "todo" | "see">): number {
  return p.todo.length + p.see.length;
}

// ICU abbreviates September as "sept"; the designs use "sep".
const tidy = (s: string) => s.replace(/\./g, "").replace(/\bsept\b/, "sep");

const dateFmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("es-ES", { timeZone: TZ, ...opts });

// "sáb 7 nov"
export function shortDate(iso: string): string {
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso);
  return tidy(dateFmt({ weekday: "short", day: "numeric", month: "short" }).format(d)).replace(",", "");
}

// "24 sep 2026"
export function mediumDate(iso: string): string {
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso);
  return tidy(dateFmt({ day: "numeric", month: "short", year: "numeric" }).format(d));
}

// "10 de octubre"
export function longDate(iso: string): string {
  return dateFmt({ day: "numeric", month: "long" }).format(new Date(iso));
}

// "sábado 10 de octubre a las 23:59"
export function deadlineLabel(iso: string): string {
  const d = new Date(iso);
  const day = dateFmt({ weekday: "long", day: "numeric", month: "long" }).format(d).replace(",", "");
  const time = dateFmt({ hour: "2-digit", minute: "2-digit" }).format(d);
  return `${day} a las ${time}`;
}

// "7 – 14 nov"
export function rangeLabel(fromIso: string, toIso: string): string {
  const from = new Date(`${fromIso}T12:00:00Z`);
  const to = new Date(`${toIso}T12:00:00Z`);
  const month = (d: Date) => tidy(dateFmt({ month: "short" }).format(d));
  return from.getUTCMonth() === to.getUTCMonth()
    ? `${from.getUTCDate()} – ${to.getUTCDate()} ${month(to)}`
    : `${from.getUTCDate()} ${month(from)} – ${to.getUTCDate()} ${month(to)}`;
}

// Whole days left, rounded down: 15.5 days is "15 días más".
export function daysUntil(iso: string, now: Date): number {
  return Math.max(0, Math.floor((Date.parse(iso) - now.getTime()) / 86_400_000));
}

// "hace 4 horas", "hace 2 días", "ahora mismo"
export function relativeTime(iso: string, now: Date): string {
  const minutes = Math.floor((now.getTime() - Date.parse(iso)) / 60_000);
  if (minutes < 1) return "ahora mismo";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} ${hours === 1 ? "hora" : "horas"}`;
  const days = Math.floor(hours / 24);
  return `hace ${days} ${days === 1 ? "día" : "días"}`;
}

// "Tu 1.ª opción"
export function ordinal(n: number): string {
  return `${n}.ª`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (parts.length > 1 ? parts[0]![0]! + parts[parts.length - 1]![0]! : name.slice(0, 2)).toUpperCase();
}

export function pointsFor(position: number): number {
  return Math.max(0, 3 - position);
}
