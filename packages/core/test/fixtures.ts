// Sample data from the design canvas ("Noviembre 2026"), shared by tests.
import type { Destination, Proposal, Snapshot } from "../src/index.ts";

export function proposal(id: string, city: string, iata: string, over: Partial<Proposal> = {}): Proposal {
  return {
    id,
    planId: "noviembre-2026",
    place: { city, country: "Portugal", iata },
    outbound: {
      from: "MAD",
      to: iata,
      departAt: "2026-11-07T07:10:00+01:00",
      arriveAt: "2026-11-07T07:30:00+00:00",
      carrier: "TAP Air Portugal",
      flightNumber: "TP1015",
      stops: 0,
      priceCents: 9800,
    },
    inbound: {
      from: iata,
      to: "MAD",
      departAt: "2026-11-14T19:05:00+00:00",
      arriveAt: "2026-11-14T21:25:00+01:00",
      carrier: "TAP Air Portugal",
      flightNumber: "TP1018",
      stops: 0,
      priceCents: 10200,
    },
    stays: [{ name: "Apartamento Alfama", kind: "Apartamento", nightlyCents: 20400, recommended: true }],
    todo: ["Tranvía 28 al amanecer"],
    see: ["Mirador de Santa Luzia"],
    provenance: { kind: "api", provider: "duffel", checkedAt: "2026-10-09T10:00:00Z" },
    review: "approved",
    ...over,
  };
}

export function destination(id: string, over: Partial<Destination> = {}): Destination {
  const { review: _r, planId: _p, ...rest } = proposal(id, id, id.slice(0, 3).toUpperCase());
  return {
    ...rest,
    pros: [],
    cons: [],
    weather: "18 °C, lluvia algunos días",
    photos: [],
    inVote: true,
    totalPerPersonCents: 40000,
    ...over,
  };
}

export function snapshot(destinations: Destination[]): Snapshot {
  return {
    plan: {
      id: "noviembre-2026",
      name: "Noviembre 2026",
      origin: "MAD",
      dateFrom: "2026-11-07",
      dateTo: "2026-11-14",
      nights: 7,
      flexDays: 1,
      partySize: 6,
      maxPriceCents: 42000,
    },
    destinations,
    publishedAt: "2026-10-10T09:00:00Z",
  };
}
