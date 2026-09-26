import type { FlightLeg, Proposal, Stay } from "./model.ts";

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
// the nights (as Airbnb does). Optionally what was checked along with them:
// the flights' real times (read from a screenshot) and the stay's own name.
export interface CheckedPrices {
  flightCents: number;
  // Only when the proposal has a stay, or one is being added.
  stayCents?: number;
  outbound?: Omit<FlightLeg, "priceCents">;
  inbound?: Omit<FlightLeg, "priceCents">;
  stay?: { name: string; description?: string; url?: string };
}

// Stores checked prices the way a proposal keeps them: each flight leg per
// person, the stay per night. The flight price is split between the legs in
// the proportion research found (half each without one); rounding moves at
// most a cent per night. A checked stay replaces research's options: it's the
// one they're going with.
export function applyCheckedPrices<P extends Pick<Proposal, "outbound" | "inbound" | "stays">>(p: P, prices: CheckedPrices, nights: number): P {
  const before = p.outbound.priceCents + p.inbound.priceCents;
  const outbound = Math.round(before > 0 ? (prices.flightCents * p.outbound.priceCents) / before : prices.flightCents / 2);
  const base = baseStay(p.stays);
  const stays =
    prices.stayCents === undefined
      ? p.stays
      : [
          {
            ...(base ?? { kind: "Alojamiento" }),
            ...(prices.stay ? { name: prices.stay.name, description: prices.stay.description, url: prices.stay.url } : { name: base?.name ?? "Alojamiento" }),
            nightlyCents: Math.round(prices.stayCents / nights),
            recommended: true,
          } as Stay,
        ];
  return {
    ...p,
    outbound: { ...p.outbound, ...prices.outbound, priceCents: outbound },
    inbound: { ...p.inbound, ...prices.inbound, priceCents: prices.flightCents - outbound },
    stays,
  };
}
