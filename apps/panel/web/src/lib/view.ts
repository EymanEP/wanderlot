// Turns proposals into the strings the panel screens show.
import {
  baseStay,
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

export const CATEGORY_LABEL: Record<Category, string> = {
  ciudad: "Ciudad",
  escapada: "Escapada",
  playa: "Playa",
  naturaleza: "Naturaleza",
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
  return `${eurosGrouped(group)} ${plan.nights === 1 ? "la noche" : `las ${plan.nights} noches`} (${euros(share)}/persona)`;
}

// "174 € ida y vuelta por persona"
export function flightsPrice(p: Proposal): string {
  return `${euros(flightPriceCents(p))} ida y vuelta por persona`;
}

// "Directo · 1 h 20 m · TAP Air Portugal", or "BIO ⇄ AMS" when only the
// price was checked by hand and research's times would mislead.
export function flightSummary(p: Proposal): string {
  return flightDetailsKnown(p) ? `${tripLabel(p.outbound)} · ${p.outbound.carrier}` : `${p.outbound.from} ⇄ ${p.outbound.to}`;
}

// "Directo · 1 h 20 m · TAP Air Portugal · alojamiento ≈ 1 428 € en total"
export function generatedLine(p: Proposal, plan: Plan): string {
  const stay = stayGroupCents(p.stays, plan.nights);
  return stay === null ? flightSummary(p) : `${flightSummary(p)} · alojamiento ≈ ${eurosGrouped(stay)} en total`;
}

// "Vuelos: 174 € ida y vuelta por persona · Directo · …"; "≈" while the
// price is Claude's.
export function flightLine(p: Proposal): string {
  return `Vuelos: ${p.provenance.kind === "claude" ? "≈ " : ""}${flightsPrice(p)} · ${flightSummary(p)}`;
}

// "Alojamiento: 1 428 € las 7 noches (238 €/persona) · Piso entero · Alfama"
export function stayLine(p: Proposal, plan: Plan): string | null {
  const stay = baseStay(p.stays);
  const price = stayPrice(p, plan);
  return stay && price ? `Alojamiento: ${p.provenance.kind === "claude" ? "≈ " : ""}${price} · ${stay.name}` : null;
}

// "9 cosas que hacer y ver"
export function thingsLine(p: Proposal): string {
  return `${thingsCount(p)} cosas que hacer y ver`;
}

// "Duffel · 24 sep 2026" or "Claude · 3 fuentes"
export function sourceLine(p: Proposal): string {
  if (p.provenance.kind === "api") return `${PROVIDER_LABEL[p.provenance.provider]} · ${mediumDate(p.provenance.checkedAt)}`;
  if (p.provenance.kind === "organiser") return `Comprobado a mano · ${mediumDate(p.provenance.checkedAt)}`;
  const n = p.provenance.sources.length;
  return `Claude · ${n} ${n === 1 ? "fuente" : "fuentes"}`;
}

export function flightMinutes(p: Proposal): number {
  return (Date.parse(p.outbound.arriveAt) - Date.parse(p.outbound.departAt)) / 60_000;
}

// "23 °C · seco" → 23
export function weatherTemp(weather: string): number | null {
  const m = /(-?\d+)\s*°/.exec(weather);
  return m ? Number(m[1]) : null;
}
