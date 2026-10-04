// Turns proposals into the strings the panel screens show.
import {
  baseStay,
  copy,
  duration,
  pick,
  euros,
  flightPriceCents,
  mediumDate,
  eurosGrouped,
  flightDetailsKnown,
  stayGroupCents,
  stayShareCents,
  thingsCount,
  totalPerPersonCents,
  tripLabel,
  trustLabel,
  trustState,
  type Category,
  type Plan,
  type Proposal,
} from "@wanderlot/core";
import type { Trust } from "@wanderlot/ui";

const COPY = copy({
  es: {
    category: { ciudad: "Ciudad", escapada: "Escapada", playa: "Playa", naturaleza: "Naturaleza" } as Record<Category, string>,
    stay: (group: string, nights: number, share: string): string => `${group} ${nights === 1 ? "la noche" : `las ${nights} noches`} (${share}/persona)`,
    flights: (price: string) => `${price} ida y vuelta por persona`,
    generated: (flight: string, stay: string) => `${flight} · alojamiento ≈ ${stay} en total`,
    flightLine: (approx: string, price: string, summary: string) => `Vuelos: ${approx}${price} · ${summary}`,
    stayLine: (approx: string, price: string, name: string) => `Alojamiento: ${approx}${price} · ${name}`,
    things: (n: number) => `${n} cosas que hacer y ver`,
    byHand: (date: string) => `Comprobado a mano · ${date}`,
    sources: (n: number): string => `Claude · ${n} ${n === 1 ? "fuente" : "fuentes"}`,
    accessLine: (airport: string, home: string, approx: string, price: string, summary: string) => `Llegar a ${airport} desde ${home}: ${approx}${price} ida y vuelta por persona · ${summary}`,
    access: "Llegar al aeropuerto",
  },
  en: {
    category: { ciudad: "City", escapada: "Short break", playa: "Beach", naturaleza: "Nature" } as Record<Category, string>,
    stay: (group: string, nights: number, share: string): string => `${group} ${nights === 1 ? "for the night" : `for the ${nights} nights`} (${share}/person)`,
    flights: (price: string) => `${price} return per person`,
    generated: (flight: string, stay: string) => `${flight} · accommodation ≈ ${stay} in total`,
    flightLine: (approx: string, price: string, summary: string) => `Flights: ${approx}${price} · ${summary}`,
    stayLine: (approx: string, price: string, name: string) => `Accommodation: ${approx}${price} · ${name}`,
    things: (n: number) => `${n} things to do and see`,
    byHand: (date: string) => `Checked by hand · ${date}`,
    sources: (n: number): string => `Claude · ${n} ${n === 1 ? "source" : "sources"}`,
    accessLine: (airport: string, home: string, approx: string, price: string, summary: string) => `Getting to ${airport} from ${home}: ${approx}${price} return per person · ${summary}`,
    access: "Getting to the airport",
  },
});

// Read as it's shown, so it follows the current language.
export const CATEGORY_LABEL: Record<Category, string> = {
  get ciudad() {
    return pick(COPY).category.ciudad;
  },
  get escapada() {
    return pick(COPY).category.escapada;
  },
  get playa() {
    return pick(COPY).category.playa;
  },
  get naturaleza() {
    return pick(COPY).category.naturaleza;
  },
};

export const PROVIDER_LABEL = { duffel: "Duffel", amadeus: "Amadeus", kiwi: "Kiwi" } as const;

export function trustOf(p: Proposal, now: Date): Trust {
  const t = trustState(p.provenance, now).kind;
  return t === "unverified" ? "unverified" : t;
}

export function trustText(p: Proposal, now: Date): string {
  return trustLabel(trustState(p.provenance, now), p.provenance.kind);
}

export function total(p: Proposal, plan: Plan): number {
  return totalPerPersonCents(p, plan.nights, plan.partySize);
}

// "1 428 € las 7 noches (238 €/persona)": the whole stay, as Airbnb shows it,
// and each person's share.
export function stayPrice(p: Proposal, plan: Plan): string | null {
  const group = stayGroupCents(p.stays, plan.nights);
  const share = stayShareCents(p.stays, plan.nights, plan.partySize);
  if (group === null || share === null) return null;
  return pick(COPY).stay(eurosGrouped(group), plan.nights, euros(share));
}

// "174 € ida y vuelta por persona"
export function flightsPrice(p: Proposal): string {
  return pick(COPY).flights(euros(flightPriceCents(p)));
}

// "Directo · 1 h 20 m · TAP Air Portugal", or "BIO ⇄ AMS" when only the
// price was checked by hand and research's times would mislead.
export function flightSummary(p: Proposal): string {
  return flightDetailsKnown(p) ? `${tripLabel(p.outbound)} · ${p.outbound.carrier}` : `${p.outbound.from} ⇄ ${p.outbound.to}`;
}

// "Directo · 1 h 20 m · TAP Air Portugal · alojamiento ≈ 1 428 € en total"
export function generatedLine(p: Proposal, plan: Plan): string {
  const stay = stayGroupCents(p.stays, plan.nights);
  return stay === null ? flightSummary(p) : pick(COPY).generated(flightSummary(p), eurosGrouped(stay));
}

// "Vuelos: 174 € ida y vuelta por persona · Directo · …"; "≈" while the
// price is Claude's.
export function flightLine(p: Proposal): string {
  return pick(COPY).flightLine(p.provenance.kind === "claude" ? "≈ " : "", flightsPrice(p), flightSummary(p));
}

// "Alojamiento: 1 428 € las 7 noches (238 €/persona) · Piso entero · Alfama"
export function stayLine(p: Proposal, plan: Plan): string | null {
  const stay = baseStay(p.stays);
  const price = stayPrice(p, plan);
  return stay && price ? pick(COPY).stayLine(p.provenance.kind === "claude" ? "≈ " : "", price, stay.name) : null;
}

// "9 cosas que hacer y ver"
export function thingsLine(p: Proposal): string {
  return pick(COPY).things(thingsCount(p));
}

// "Duffel · 24 sep 2026" or "Claude · 3 fuentes"
export function sourceLine(p: Proposal): string {
  if (p.provenance.kind === "api") return `${PROVIDER_LABEL[p.provenance.provider]} · ${mediumDate(p.provenance.checkedAt)}`;
  if (p.provenance.kind === "organiser") return pick(COPY).byHand(mediumDate(p.provenance.checkedAt));
  return pick(COPY).sources(p.provenance.sources.length);
}

export function flightMinutes(p: Proposal): number {
  return (Date.parse(p.outbound.arriveAt) - Date.parse(p.outbound.departAt)) / 60_000;
}

// "23 °C · seco" → 23
export function weatherTemp(weather: string): number | null {
  const m = /(-?\d+)\s*°/.exec(weather);
  return m ? Number(m[1]) : null;
}

// "Llegar a BIO desde Logroño: ≈ 24 € ida y vuelta por persona · Coche hasta
// Bilbao, 2 coches · 1 h 50 m" (ROADMAP 2.3); null when not worked out.
export function accessLine(p: Proposal): string | null {
  const a = p.access;
  if (!a) return null;
  const summary = a.minutes ? `${a.title} · ${duration(a.minutes)}` : a.title;
  return pick(COPY).accessLine(p.outbound.from, a.home, a.checked ? "" : "≈ ", euros(a.cents), summary);
}

// "Llegar al aeropuerto", for a price's label.
export const accessLabel = () => pick(COPY).access;
