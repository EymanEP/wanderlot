// Turns destinations, members and votes into the strings the site shows.
import {
  baseStay,
  euros,
  flightDetailsKnown,
  flightPriceCents,
  mediumDate,
  ordinal,
  stayShareCents,
  tripLabel,
  trustState,
  copy,
  pick,
  type Destination,
  type Plan,
} from "@wanderlot/core";
import type { Person } from "../data/store.tsx";
import type { Trust } from "@wanderlot/ui";

export const PROVIDER_LABEL = { duffel: "Duffel", amadeus: "Amadeus", kiwi: "Kiwi" } as const;

const COPY = copy({
  es: {
    flightPrice: (price: string) => `vuelo ${price} i/v`,
    perPerson: (price: string) => `${price} por persona`,
    rank: (n: string) => `Tu ${n} opción`,
    points: (n: number): string => (n === 1 ? "PUNTO" : "PUNTOS"),
    someone: "Alguien",
    flightsApi: (provider: string, date: string) => `Vuelos · ${provider} · ${date}`,
    flightsByHand: (date: string) => `Vuelos · comprobados a mano el ${date}`,
    flightsResearch: (n: number) => `Vuelos · Claude, ${n} fuentes sin verificar`,
    stays: "Alojamiento · anuncios revisados a mano",
    weather: (month: string | null) => `Clima · medias de ${month ?? "la época"}, AEMET`,
    groupWord: (n: number) => (n === 1 ? "uno" : n <= 10 ? ["", "", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez"][n]! : String(n)),
    numberWord: (n: number) => ["cero", "una", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez"][n] ?? String(n),
    and: "y",
  },
  en: {
    flightPrice: (price: string) => `flight ${price} return`,
    perPerson: (price: string) => `${price} per person`,
    rank: (n: string) => `Your ${n} choice`,
    points: (n: number): string => (n === 1 ? "POINT" : "POINTS"),
    someone: "Someone",
    flightsApi: (provider: string, date: string) => `Flights · ${provider} · ${date}`,
    flightsByHand: (date: string) => `Flights · checked by hand on ${date}`,
    flightsResearch: (n: number) => `Flights · Claude, ${n} sources not verified`,
    stays: "Stays · listings checked by hand",
    weather: (month: string | null) => `Weather · ${month ? `${month} averages` : "averages for the season"}, AEMET`,
    groupWord: (n: number) => (n <= 10 ? ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"][n]! : String(n)),
    numberWord: (n: number) => ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"][n] ?? String(n),
    and: "and",
  },
});

export function trustOf(d: Destination, now: Date): Trust {
  const t = trustState(d.provenance, now).kind;
  return t === "unverified" ? "unverified" : t;
}

// "Marruecos · directo 1 h 55 m"
// "Portugal · directo 1 h 20 m", or "Portugal · vuelo 174 € i/v" when the
// organiser checked the price by hand but not the times.
export function placeLine(d: Destination): string {
  return `${d.place.country} · ${flightLabel(d)}`;
}

export function flightLabel(d: Destination): string {
  return flightDetailsKnown(d) ? tripLabel(d.outbound).toLowerCase().replace(" · ", " ") : pick(COPY).flightPrice(euros(flightPriceCents(d)));
}

// Each person's share of the whole stay: "204 € por persona".
export function stayShareLabel(d: Destination, plan: Plan): string | null {
  const c = stayShareCents(d.stays, plan.nights, plan.partySize);
  return c === null ? null : pick(COPY).perPerson(euros(c));
}

// "Riad entero en la Medina · 204 € por persona"
export function stayLine(d: Destination, plan: Plan): string {
  return [baseStay(d.stays)?.name, stayShareLabel(d, plan)].filter(Boolean).join(" · ");
}

export function rankLabel(position: number): string {
  return pick(COPY).rank(ordinal(position + 1));
}

export function pointsWord(n: number): string {
  return pick(COPY).points(n);
}

export function memberOf(members: Person[], id: string): Person {
  // Someone who has since left the group still shows on old comments.
  return members.find((m) => m.id === id) ?? { id, name: pick(COPY).someone, initials: "?", tint: "sand" };
}

// Where the numbers come from. `month`: the trip's, for the weather.
export function sourcesFor(d: Destination, month: string | null = null): string[] {
  const t = pick(COPY);
  const flights =
    d.provenance.kind === "api"
      ? t.flightsApi(PROVIDER_LABEL[d.provenance.provider], mediumDate(d.provenance.checkedAt))
      : d.provenance.kind === "organiser"
        ? t.flightsByHand(mediumDate(d.provenance.checkedAt))
        : t.flightsResearch(d.provenance.sources.length);
  return [flights, t.stays, t.weather(d.weather ? month : null)];
}

// The group chose another destination than the vote's winner.
export function overridden(result: { winnerId: string | null; voteWinnerId?: string | null } | null): boolean {
  return !!result?.voteWinnerId && !!result.winnerId && result.voteWinnerId !== result.winnerId;
}

// "los seis", "nosotros cinco": the group by its size, for prose. A trip of
// one person has no "los".
export function groupWord(n: number): string {
  return pick(COPY).groupWord(n);
}

// Counting words for small numbers in prose: "cuatro propuestas" · "four proposals".
export function numberWord(n: number): string {
  return pick(COPY).numberWord(n);
}

export function names(list: string[]): string {
  if (list.length <= 1) return list.join("");
  return `${list.slice(0, -1).join(", ")} ${pick(COPY).and} ${list[list.length - 1]}`;
}
