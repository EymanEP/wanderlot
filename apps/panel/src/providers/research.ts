// What research asks Claude for and what comes back, shared by the `claude`
// command and the Anthropic API. Besides the trip itself, each proposal brings
// the Comparativa notes (pros, cons, weather) and what to photograph: Claude
// names subjects, never image URLs (SPEC §6).
import { z } from "zod";
import { Category, FlightLeg, Place, Source, Stay, Thing } from "@wanderlot/core";
import type { ResearchResult, SearchRequest } from "./types.ts";

const ResearchProposal = z.object({
  place: Place,
  category: Category,
  outbound: FlightLeg,
  inbound: FlightLeg,
  stays: z.array(Stay).max(2),
  todo: z.array(Thing),
  see: z.array(Thing),
  sources: z.array(Source).min(1),
  pros: z.array(z.string()).max(4).default([]),
  cons: z.array(z.string()).max(4).default([]),
  weather: z.string().default(""),
  photoSubjects: z.array(z.string()).max(4).default([]),
});
export const ResearchOutput = z.object({ proposals: z.array(ResearchProposal) });
export type ResearchOutput = z.infer<typeof ResearchOutput>;

export const outputSchema = z.toJSONSchema(ResearchOutput);

export function buildPrompt(req: SearchRequest): string {
  const scope =
    req.scope.kind === "anywhere" ? "cualquier destino" : req.scope.kind === "europe" ? "Europa" : `el aeropuerto ${req.scope.iata}`;
  const stops = { direct: "solo vuelos directos", one: "máximo 1 escala", any: "escalas indiferentes" }[req.stops];
  return [
    `Busca ${req.count} propuestas de viaje de grupo saliendo de ${req.origin} hacia ${scope}.`,
    `Salida el ${req.dateFrom} (±${req.flexDays} días), ${req.nights} noches, ${req.partySize} personas.`,
    `Tope de ${(req.maxPriceCents / 100).toFixed(0)} € por persona en total. ${stops}.`,
    req.estimateStays
      ? "Estima dos opciones de alojamiento para todo el grupo (precio por noche, grupo entero) y marca una como recomendada."
      : "No incluyas alojamiento (stays vacío).",
    req.suggestThings
      ? "Añade cosas concretas que hacer y que ver, cada una con un título y un detalle práctico (no un itinerario por días)."
      : "Deja todo y see vacíos.",
    "Clasifica cada destino como ciudad, escapada, playa o naturaleza. Todos los precios en céntimos de euro, por persona para los vuelos. Fechas ISO 8601 con zona horaria.",
    "Para comparar: hasta 3 pros y 2 contras breves pensando en este grupo y estas fechas, y el tiempo esperado en una línea (por ejemplo «17 °C · lluvioso»).",
    "En photoSubjects, 3 cosas concretas del destino que valga la pena fotografiar, como términos de búsqueda (por ejemplo «Alfama Lisboa», «Torre de Belém»). No des URLs de imágenes.",
    "Cada propuesta debe citar las páginas de donde salen los números en sources. No inventes vuelos: si no encuentras uno real, omite la propuesta.",
  ].join("\n");
}

// One result per proposal, with ids stable within a search.
export function toResults(req: SearchRequest, output: ResearchOutput): ResearchResult[] {
  return output.proposals.map((p, i) => {
    const { sources, pros, cons, weather, photoSubjects, ...rest } = p;
    return {
      proposal: {
        ...rest,
        id: `${p.place.iata.toLowerCase()}-${i + 1}`,
        planId: req.planId,
        provenance: { kind: "claude", sources },
      },
      notes: { pros, cons, weather, photoSubjects },
    };
  });
}
