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
  type Destination,
  type Plan,
} from "@wanderlot/core";
import type { Person } from "../data/store.tsx";
import type { Trust } from "@wanderlot/ui";

export const PROVIDER_LABEL = { duffel: "Duffel", amadeus: "Amadeus", kiwi: "Kiwi" } as const;

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
  return flightDetailsKnown(d) ? tripLabel(d.outbound).toLowerCase().replace(" · ", " ") : `vuelo ${euros(flightPriceCents(d))} i/v`;
}

// Each person's share of the whole stay: "204 € por persona".
export function stayShareLabel(d: Destination, plan: Plan): string | null {
  const c = stayShareCents(d.stays, plan.nights, plan.partySize);
  return c === null ? null : `${euros(c)} por persona`;
}

// "Riad entero en la Medina · 204 € por persona"
export function stayLine(d: Destination, plan: Plan): string {
  return [baseStay(d.stays)?.name, stayShareLabel(d, plan)].filter(Boolean).join(" · ");
}

export function rankLabel(position: number): string {
  return `Tu ${ordinal(position + 1)} opción`;
}

export function pointsWord(n: number): string {
  return n === 1 ? "PUNTO" : "PUNTOS";
}

export function memberOf(members: Person[], id: string): Person {
  // Someone who has since left the group still shows on old comments.
  return members.find((m) => m.id === id) ?? { id, name: "Alguien", initials: "?", tint: "sand" };
}

export function sourcesFor(d: Destination): string[] {
  const flights =
    d.provenance.kind === "api"
      ? `Vuelos · ${PROVIDER_LABEL[d.provenance.provider]} · ${mediumDate(d.provenance.checkedAt)}`
      : d.provenance.kind === "organiser"
        ? `Vuelos · comprobados a mano el ${mediumDate(d.provenance.checkedAt)}`
        : `Vuelos · Claude, ${d.provenance.sources.length} fuentes sin verificar`;
  return [flights, "Alojamiento · anuncios revisados a mano", `Clima · medias de ${d.weather ? "noviembre" : "la época"}, AEMET`];
}

// Spanish counting words for small numbers in prose: "cuatro propuestas".
export function numberWord(n: number): string {
  return ["cero", "una", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez"][n] ?? String(n);
}

export function names(list: string[]): string {
  if (list.length <= 1) return list.join("");
  return `${list.slice(0, -1).join(", ")} y ${list[list.length - 1]}`;
}
