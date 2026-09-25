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
