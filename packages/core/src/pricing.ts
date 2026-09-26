import type { Proposal, Stay } from "./model.ts";

// The stay a total is based on: the recommended one, else the cheapest.
export function baseStay(stays: readonly Stay[]): Stay | undefined {
  const recommended = stays.find((s) => s.recommended);
  if (recommended) return recommended;
  return [...stays].sort((a, b) => a.nightlyCents - b.nightlyCents)[0];
}

// Return flights plus this person's share of the stay (SPEC §1, Destination).
export function totalPerPersonCents(
  p: Pick<Proposal, "outbound" | "inbound" | "stays">,
  nights: number,
  partySize: number,
): number {
  const flights = p.outbound.priceCents + p.inbound.priceCents;
  const stay = baseStay(p.stays);
  const stayShare = stay ? Math.ceil((stay.nightlyCents * nights) / partySize) : 0;
  return flights + stayShare;
}

// What the whole group pays to fly there and back.
export function groupFlightsCents(p: Pick<Proposal, "outbound" | "inbound">, partySize: number): number {
  return (p.outbound.priceCents + p.inbound.priceCents) * partySize;
}

// Prices the organiser checked by hand, as booking sites show them: the
// flights there and back for everyone, and the stay for all the nights.
export interface GroupTotals {
  flightsCents: number;
  // Only when the proposal has a stay.
  stayCents?: number;
}

// Stores group totals the way a proposal keeps prices: each flight leg per
// person, the stay per night. The flight total is split between the legs in
// the proportion research found (half each without one); rounding moves at
// most a cent per person or per night.
export function applyGroupTotals<P extends Pick<Proposal, "outbound" | "inbound" | "stays">>(
  p: P,
  totals: GroupTotals,
  nights: number,
  partySize: number,
): P {
  const perPerson = Math.round(totals.flightsCents / partySize);
  const before = p.outbound.priceCents + p.inbound.priceCents;
  const outbound = Math.round(before > 0 ? (perPerson * p.outbound.priceCents) / before : perPerson / 2);
  const stay = baseStay(p.stays);
  return {
    ...p,
    outbound: { ...p.outbound, priceCents: outbound },
    inbound: { ...p.inbound, priceCents: perPerson - outbound },
    stays: p.stays.map((s) => (s === stay && totals.stayCents !== undefined ? { ...s, nightlyCents: Math.round(totals.stayCents / nights) } : s)),
  };
}
