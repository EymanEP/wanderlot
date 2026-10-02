// Display helpers shared by the panel and the site, in the current language
// (i18n.ts) or the one given.
import type { Destination, FlightLeg, Proposal, Provenance, Stay } from "./model.ts";
import { baseStay } from "./pricing.ts";
import { INTL_LOCALE, currentLocale, type Locale } from "./i18n.ts";

const TZ = "Europe/Madrid";

export function euros(cents: number, opts: { decimals?: boolean } = {}, l: Locale = currentLocale()): string {
  return new Intl.NumberFormat(INTL_LOCALE[l], {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: opts.decimals ? 2 : 0,
    maximumFractionDigits: opts.decimals ? 2 : 0,
    useGrouping: true,
  })
    .format(cents / 100)
    .replace(/ €/, " €");
}

// Spanish groups thousands with a space in prose ("1 720 €"), even for 4
// digits; English writes "€1,720".
export function eurosGrouped(cents: number, l: Locale = currentLocale()): string {
  const whole = Math.round(cents / 100);
  if (l === "en") return `€${String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
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

export function stopsLabel(stops: number, l: Locale = currentLocale()): string {
  if (l === "en") return stops === 0 ? "Direct" : stops === 1 ? "1 stop" : `${stops} stops`;
  if (stops === 0) return "Directo";
  return stops === 1 ? "1 escala" : `${stops} escalas`;
}

// Whether a proposal's flight times, dates and numbers can be shown: always,
// except when the organiser checked only the price by hand (research's guess
// at the times would sit beside a real price).
export function flightDetailsKnown(p: Pick<Proposal, "provenance">): boolean {
  if (p.provenance.kind === "claude") return true;
  // Checked for dates the trip no longer has: those were other flights.
  if (p.provenance.forOtherDates) return false;
  return p.provenance.kind === "api" || p.provenance.flightDetails === true;
}

// A price the organiser checked, and where: "Visto en Google Flights y
// Airbnb", or "Comprobado a mano". null for others.
export function checkedLabel(p: Provenance, l: Locale = currentLocale()): string | null {
  if (p.kind !== "organiser") return null;
  const seen = (p.seenOn ?? []).map((s) => (s === "google-flights" ? "Google Flights" : "Airbnb"));
  if (l === "en") return seen.length ? `Seen on ${seen.join(" and ")}` : "Checked by hand";
  return seen.length ? `Visto en ${seen.join(" y ")}` : "Comprobado a mano";
}

// Who wrote research's figures, as a badge says it: "Lo escribió Claude",
// "Estimado por OpenAI" (ROADMAP 3.3). null for checked prices.
export function researchLabel(p: Provenance, l: Locale = currentLocale()): string | null {
  if (p.kind !== "claude") return null;
  const by = p.by ?? "Claude";
  if (l === "en") return p.estimate ? `Estimated by ${by}` : `Written by ${by}`;
  return p.estimate ? `Estimado por ${by}` : `Lo escribió ${by}`;
}

// "Directo · 1 h 20 m"
export function tripLabel(leg: FlightLeg, l: Locale = currentLocale()): string {
  return `${stopsLabel(leg.stops, l)} · ${legDuration(leg)}`;
}

// Local wall-clock time of a leg's departure or arrival, in the airport's own offset.
export function localTime(iso: string): string {
  return iso.slice(11, 16);
}

export function flightPriceCents(p: Pick<Proposal, "outbound" | "inbound">): number {
  return p.outbound.priceCents + p.inbound.priceCents;
}

// What the whole group pays for the base stay, all the nights, and each
// person's share of it: how Airbnb and booking sites show a stay.
export function stayGroupCents(stays: readonly Stay[], nights: number): number | null {
  const stay = baseStay(stays);
  return stay ? stayTotalCents(stay, nights) : null;
}

export function stayShareCents(stays: readonly Stay[], nights: number, partySize: number): number | null {
  const total = stayGroupCents(stays, nights);
  return total === null ? null : Math.ceil(total / partySize);
}

export function stayTotalCents(stay: Stay, nights: number): number {
  return stay.nightlyCents * nights;
}

export function thingsCount(p: Pick<Destination, "todo" | "see">): number {
  return p.todo.length + p.see.length;
}

// ICU abbreviates September as "sept" ("Sept" in British English); the
// designs use "sep".
const tidy = (s: string) => s.replace(/\./g, "").replace(/\bsept\b/, "sep").replace(/\bSept\b/, "Sep");

const dateFmt = (l: Locale, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(INTL_LOCALE[l], { timeZone: TZ, ...opts });
const day = (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso);

// "sáb 7 nov" · "Sat 7 Nov"
export function shortDate(iso: string, l: Locale = currentLocale()): string {
  return tidy(dateFmt(l, { weekday: "short", day: "numeric", month: "short" }).format(day(iso))).replace(",", "");
}

// "viernes 12" · "Friday 12": a day the group already knows the month of.
export function weekdayDay(iso: string, l: Locale = currentLocale()): string {
  return dateFmt(l, { weekday: "long", day: "numeric" }).format(day(iso)).replace(",", "");
}

// "24 sep 2026" · "24 Sep 2026"
export function mediumDate(iso: string, l: Locale = currentLocale()): string {
  return tidy(dateFmt(l, { day: "numeric", month: "short", year: "numeric" }).format(day(iso)));
}

// "10 de octubre" · "10 October"
export function longDate(iso: string, l: Locale = currentLocale()): string {
  return dateFmt(l, { day: "numeric", month: "long" }).format(new Date(iso));
}

// "sábado 10 de octubre a las 23:59" · "Saturday 10 October at 23:59"
export function deadlineLabel(iso: string, l: Locale = currentLocale()): string {
  const d = new Date(iso);
  const date = dateFmt(l, { weekday: "long", day: "numeric", month: "long" }).format(d).replace(",", "");
  const time = dateFmt(l, { hour: "2-digit", minute: "2-digit" }).format(d);
  return l === "en" ? `${date} at ${time}` : `${date} a las ${time}`;
}

// "7 – 14 nov" · "7 – 14 Nov"
export function rangeLabel(fromIso: string, toIso: string, l: Locale = currentLocale()): string {
  const from = new Date(`${fromIso}T12:00:00Z`);
  const to = new Date(`${toIso}T12:00:00Z`);
  const month = (d: Date) => tidy(dateFmt(l, { month: "short" }).format(d));
  return from.getUTCMonth() === to.getUTCMonth()
    ? `${from.getUTCDate()} – ${to.getUTCDate()} ${month(to)}`
    : `${from.getUTCDate()} ${month(from)} – ${to.getUTCDate()} ${month(to)}`;
}

// The month's name, as the trip's calendar says it: "noviembre" · "November".
export function monthName(iso: string, l: Locale = currentLocale()): string {
  return dateFmt(l, { month: "long" }).format(day(iso));
}

// Whole days left, rounded down: 15.5 days is "15 días más".
export function daysUntil(iso: string, now: Date): number {
  return Math.max(0, Math.floor((Date.parse(iso) - now.getTime()) / 86_400_000));
}

// "hace 4 horas", "hace 2 días", "ahora mismo" · "4 hours ago", "just now"
export function relativeTime(iso: string, now: Date, l: Locale = currentLocale()): string {
  const minutes = Math.floor((now.getTime() - Date.parse(iso)) / 60_000);
  if (l === "en") {
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
    const days = Math.floor(hours / 24);
    return `${days} ${days === 1 ? "day" : "days"} ago`;
  }
  if (minutes < 1) return "ahora mismo";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} ${hours === 1 ? "hora" : "horas"}`;
  const days = Math.floor(hours / 24);
  return `hace ${days} ${days === 1 ? "día" : "días"}`;
}

// "Tu 1.ª opción" · "Your 1st choice"
export function ordinal(n: number, l: Locale = currentLocale()): string {
  if (l === "en") {
    const tens = n % 100;
    const suffix = tens >= 11 && tens <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
    return `${n}${suffix}`;
  }
  return `${n}.ª`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (parts.length > 1 ? parts[0]![0]! + parts[parts.length - 1]![0]! : name.slice(0, 2)).toUpperCase();
}

export function pointsFor(position: number): number {
  return Math.max(0, 3 - position);
}

export type AvatarTintName = "sand" | "lilac" | "mint" | "sky" | "rose";
const TINTS: AvatarTintName[] = ["sand", "lilac", "mint", "sky", "rose"];

// A stable colour per person, so the same friend always looks the same.
export function avatarTint(id: string): AvatarTintName {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TINTS[h % TINTS.length]!;
}

// Cities for common Spanish departure airports; anything else shows its code.
const AIRPORT_CITY: Record<string, string> = {
  MAD: "Madrid", BCN: "Barcelona", VLC: "Valencia", SVQ: "Sevilla", AGP: "Málaga", BIO: "Bilbao", ALC: "Alicante",
  PMI: "Palma", ZAZ: "Zaragoza", SCQ: "Santiago", OVD: "Asturias", VGO: "Vigo", LPA: "Gran Canaria", TFN: "Tenerife Norte",
  IBZ: "Ibiza", GRX: "Granada", SDR: "Santander", VIT: "Vitoria", PNA: "Pamplona", LEI: "Almería",
};

export function airportCity(iata: string): string {
  return AIRPORT_CITY[iata] ?? iata;
}

// Adds days to a YYYY-MM-DD date.
export function addDaysIso(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

// "Semana Santa 2027" → "semana-santa-2027"
export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

// Wikimedia serves other sites only these thumbnail widths and rejects the
// rest, so a photo saved at, say, 1600px fails to load. A thumbnail address
// is moved to the largest standard width that fits: never wider than the one
// saved, which Wikimedia already had enough pixels for. Other addresses pass
// through untouched.
export const WIKIMEDIA_WIDTHS = [20, 40, 60, 120, 250, 330, 500, 960, 1280, 1920, 3840] as const;

export function standardImageUrl(url: string): string {
  const m = /^(https:\/\/(?:upload|thumb)\.wikimedia\.org\/.+\/thumb\/.+\/)(\d+)px-([^/]+)$/.exec(url);
  if (!m) return url;
  const width = Number(m[2]);
  if ((WIKIMEDIA_WIDTHS as readonly number[]).includes(width)) return url;
  const fit = [...WIKIMEDIA_WIDTHS].reverse().find((w) => w <= width) ?? WIKIMEDIA_WIDTHS[0];
  return `${m[1]}${fit}px-${m[3]}`;
}

// Google Flights, searched for this route and the trip's dates, round trip,
// one person, in euros: where to check a price by hand.
export function googleFlightsUrl(from: string, to: string, dateFrom: string, dateTo: string, l: Locale = currentLocale()): string {
  const q = `Flights from ${from} to ${to} on ${dateFrom} through ${dateTo}`;
  return `https://www.google.com/travel/flights?hl=${l}&curr=EUR&q=${encodeURIComponent(q)}`;
}

// The stay, checked by hand on Airbnb: the listing already chosen for the
// trip's dates and people, or a search for a whole place for the group.
export function airbnbUrl(trip: { city: string; dateFrom: string; dateTo: string; partySize: number }, listing?: string | null): string {
  if (listing && /^https:\/\/(www\.)?airbnb\.[a-z.]+\/rooms\/\d+/.test(listing)) {
    const u = new URL(listing);
    return `${u.origin}${u.pathname}?check_in=${trip.dateFrom}&check_out=${trip.dateTo}&adults=${trip.partySize}`;
  }
  return `https://www.airbnb.es/s/${encodeURIComponent(trip.city)}/homes?checkin=${trip.dateFrom}&checkout=${trip.dateTo}&adults=${trip.partySize}&room_types%5B%5D=Entire%20home%2Fapt`;
}
