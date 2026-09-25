// Small builders so the mock dataset below reads like the designs.
import type { FlightLeg, Proposal, Stay, Thing } from "@wanderlot/core";

const pad = (n: number) => String(n).padStart(2, "0");

// Airport UTC offsets in November (no DST).
const OFFSET: Record<string, number> = {
  MAD: 1, LIS: 0, OPO: 0, TFS: 0, EDI: 0, NAP: 1, FCO: 1, RAK: 1, BUD: 1, PRG: 1, KRK: 1, MLA: 1, ATH: 2,
};

function iso(date: string, time: string, offsetHours: number): string {
  const sign = offsetHours >= 0 ? "+" : "-";
  return `${date}T${time}:00${sign}${pad(Math.abs(offsetHours))}:00`;
}

function addMinutes(isoTime: string, minutes: number, targetOffset: number): string {
  const t = new Date(Date.parse(isoTime) + minutes * 60_000 + targetOffset * 3_600_000);
  const date = `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
  return iso(date, `${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}`, targetOffset);
}

export interface LegSpec {
  from: string;
  to: string;
  date: string; // YYYY-MM-DD, local
  depart: string; // HH:MM, local
  minutes: number;
  carrier: string;
  flightNumber: string;
  euros: number;
  stops?: number;
}

export function leg(s: LegSpec): FlightLeg {
  const departAt = iso(s.date, s.depart, OFFSET[s.from] ?? 0);
  return {
    from: s.from,
    to: s.to,
    departAt,
    arriveAt: addMinutes(departAt, s.minutes, OFFSET[s.to] ?? 0),
    carrier: s.carrier,
    flightNumber: s.flightNumber,
    stops: s.stops ?? 0,
    priceCents: s.euros * 100,
  };
}

// Stays are priced per person per night in the designs; the model stores the
// whole group's nightly price.
export function stay(name: string, perPersonNight: number, opts: { kind?: string; description?: string; recommended?: boolean } = {}, partySize = 6): Stay {
  return {
    name,
    kind: opts.kind ?? "Apartamento",
    nightlyCents: perPersonNight * partySize * 100,
    recommended: opts.recommended ?? false,
    ...(opts.description ? { description: opts.description } : {}),
  };
}

export const things = (...items: [string, string?][]): Thing[] =>
  items.map(([title, detail]) => (detail ? { title, detail } : { title }));

export type ProposalSpec = Omit<Proposal, "planId">;
