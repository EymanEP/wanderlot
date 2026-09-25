// Turns proposals into the strings the panel screens show.
import {
  baseStay,
  euros,
  flightPriceCents,
  mediumDate,
  stayPerPersonNightCents,
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
  return trustLabel(trustState(p.provenance, now));
}

export function total(p: Proposal, plan: Plan): number {
  return totalPerPersonCents(p, plan.nights, plan.partySize);
}

export function perNight(p: Proposal, plan: Plan): string | null {
  const c = stayPerPersonNightCents(p.stays, plan.partySize);
  return c === null ? null : `${euros(c)}/noche`;
}

// "Directo · 1 h 20 m · TAP Air Portugal"
export function flightSummary(p: Proposal): string {
  return `${tripLabel(p.outbound)} · ${p.outbound.carrier}`;
}

// "Directo · 1 h 20 m · TAP Air Portugal · alojamiento ≈ 34 €/noche"
export function generatedLine(p: Proposal, plan: Plan): string {
  const night = perNight(p, plan);
  return night ? `${flightSummary(p)} · alojamiento ≈ ${night}` : flightSummary(p);
}

// "… · 174 € ida y vuelta", or a warning when Claude wrote the price.
export function flightLine(p: Proposal): string {
  const price = p.provenance.kind === "api" ? `${euros(flightPriceCents(p))} ida y vuelta` : "precio sin confirmar";
  return `${flightSummary(p)} · ${price}`;
}

// "Piso entero para 6 · Alfama · 34 €/noche · 9 cosas que hacer y ver"
export function stayLine(p: Proposal, plan: Plan): string {
  const stay = baseStay(p.stays);
  const parts = [stay?.name, perNight(p, plan), `${thingsCount(p)} cosas que hacer y ver`].filter(Boolean);
  return parts.join(" · ");
}

// "Duffel · 24 sep 2026" or "Claude · 3 fuentes"
export function sourceLine(p: Proposal): string {
  if (p.provenance.kind === "api") return `${PROVIDER_LABEL[p.provenance.provider]} · ${mediumDate(p.provenance.checkedAt)}`;
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
