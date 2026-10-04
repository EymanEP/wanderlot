import type { FlightLeg, Proposal, Stay } from "./model.ts";

// The stay a total is based on: the recommended one, else the cheapest.
export function baseStay(stays: readonly Stay[]): Stay | undefined {
  const recommended = stays.find((s) => s.recommended);
  if (recommended) return recommended;
  return [...stays].sort((a, b) => a.nightlyCents - b.nightlyCents)[0];
}

// Return flights plus this person's share of the stay, plus getting to the
// departure airport and back when it's known (SPEC §1, Destination).
export function totalPerPersonCents(
  p: Pick<Proposal, "outbound" | "inbound" | "stays"> & { access?: Proposal["access"] },
  nights: number,
  partySize: number,
): number {
  const flights = p.outbound.priceCents + p.inbound.priceCents;
  const stay = baseStay(p.stays);
  const stayShare = stay ? Math.ceil((stay.nightlyCents * nights) / partySize) : 0;
  return flights + stayShare + (p.access?.cents ?? 0);
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
  // Getting to the departure airport and back, per person, as the organiser
  // corrected it. Only when the proposal has an estimate to correct.
  accessCents?: number;
}

// Stores checked prices the way a proposal keeps them: each flight leg per
// person, the stay per night. The flight price is split between the legs in
// the proportion research found (half each without one); rounding moves at
// most a cent per night. A checked stay replaces research's options: it's the
// one they're going with.
export function applyCheckedPrices<P extends Pick<Proposal, "outbound" | "inbound" | "stays"> & { access?: Proposal["access"] }>(p: P, prices: CheckedPrices, nights: number): P {
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
    ...(p.access && prices.accessCents !== undefined ? { access: { ...p.access, cents: prices.accessCents, checked: true } } : {}),
  };
}

// The trip's dates changed: every price checked for the old ones (by hand or
// by an API) is marked as for other dates, so it shows as stale and its
// flight times stop showing until it's checked again. Research's prices stay
// as they are: they were estimates anyway.
export function markForOtherDates<P extends Pick<Proposal, "provenance">>(p: P): P {
  const prov = p.provenance;
  if (prov.kind === "claude" || prov.forOtherDates) return p;
  if (prov.kind === "api") return { ...p, provenance: { ...prov, forOtherDates: true } };
  const { flightDetails: _details, ...rest } = prov;
  return { ...p, provenance: { ...rest, forOtherDates: true } };
}
