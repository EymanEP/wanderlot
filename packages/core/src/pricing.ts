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

// Prices the organiser checked by hand, as booking sites show them: one
// person's flights there and back, and the stay for the whole group and all
// the nights (as Airbnb does).
export interface CheckedPrices {
  flightCents: number;
  // Only when the proposal has a stay.
  stayCents?: number;
}

// Stores checked prices the way a proposal keeps them: each flight leg per
// person, the stay per night. The flight price is split between the legs in
// the proportion research found (half each without one); rounding moves at
// most a cent per night.
export function applyCheckedPrices<P extends Pick<Proposal, "outbound" | "inbound" | "stays">>(p: P, prices: CheckedPrices, nights: number): P {
  const before = p.outbound.priceCents + p.inbound.priceCents;
  const outbound = Math.round(before > 0 ? (prices.flightCents * p.outbound.priceCents) / before : prices.flightCents / 2);
  const stay = baseStay(p.stays);
  return {
    ...p,
    outbound: { ...p.outbound, priceCents: outbound },
    inbound: { ...p.inbound, priceCents: prices.flightCents - outbound },
    stays: p.stays.map((s) => (s === stay && prices.stayCents !== undefined ? { ...s, nightlyCents: Math.round(prices.stayCents / nights) } : s)),
  };
}
