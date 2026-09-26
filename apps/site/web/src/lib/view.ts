// Turns destinations, members and votes into the strings the site shows.
import {
  baseStay,
  euros,
  mediumDate,
  ordinal,
  stayPerPersonNightCents,
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
export function placeLine(d: Destination): string {
  return `${d.place.country} · ${tripLabel(d.outbound).toLowerCase().replace(" · ", " ")}`;
}

export function perNightLabel(d: Destination, plan: Plan): string | null {
  const c = stayPerPersonNightCents(d.stays, plan.partySize);
  return c === null ? null : `${euros(c)}/noche`;
}

// "Riad entero en la Medina · 29 €/noche"
export function stayLine(d: Destination, plan: Plan): string {
  return [baseStay(d.stays)?.name, perNightLabel(d, plan)].filter(Boolean).join(" · ");
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
