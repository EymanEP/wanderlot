// What research asks Claude for and what comes back, shared by the `claude`
// command and the Anthropic API. Besides the trip itself, each proposal brings
// the Comparativa notes (pros, cons, weather) and what to photograph: Claude
// names subjects, never image URLs (SPEC §6).
import { z } from "zod";
import { Category, FlightLeg, Place, Source, Stay, Thing, TransportMode, type Access } from "@wanderlot/core";
import type { ResearchResult, SearchRequest } from "./types.ts";
import { languageLine } from "./language.ts";

// Getting from home to the departure airport and back (ROADMAP 2.3): asked
// for only when the group's home town is known.
const ResearchAccess = z.object({
  mode: TransportMode,
  title: z.string(),
  detail: z.string(),
  // One way.
  minutes: z.number().nullable(),
  // Per person, there and back.
  priceEuros: z.number().nonnegative(),
});

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
  access: ResearchAccess.nullable().default(null),
});
export const ResearchOutput = z.object({ proposals: z.array(ResearchProposal) });
export type ResearchOutput = z.infer<typeof ResearchOutput>;

// An AI that can't search the web has nothing to cite (ROADMAP 3.3).
export const EstimateOutput = z.object({ proposals: z.array(ResearchProposal.extend({ sources: z.array(Source).default([]) })) });

// Who's researching, for provenance: absent means Claude, searching the web.
export interface Researcher {
  by?: string;
  // No web search: prices from what the model knows, marked as estimates.
  estimate?: boolean;
}

export const SYSTEM =
  "Planificas viajes para un grupo de amigos. Buscas en la web vuelos, alojamientos y precios reales y citas las páginas de donde salen. " +
  "Escribes en el idioma que te pida cada encargo.";

// For an AI that can't search the web (ROADMAP 3.3).
export const SYSTEM_ESTIMATE =
  "Planificas viajes para un grupo de amigos. No puedes buscar en la web: estimas vuelos, alojamientos y precios realistas con lo que sabes, sin inventar rutas que no existan. " +
  "Escribes en el idioma que te pida cada encargo.";

// Draft-07: the `claude` command validates --json-schema with a validator
// that doesn't know draft 2020-12, zod's default, and refuses to start.
export const outputSchema = z.toJSONSchema(ResearchOutput, { target: "draft-7" });

export function buildPrompt(req: SearchRequest, who: Researcher = {}): string {
  const scope =
    req.scope.kind === "anywhere"
      ? "cualquier destino"
      : req.scope.kind === "europe"
        ? "Europa"
        : req.scope.kind === "named"
          ? `«${req.scope.name}»`
          : `el aeropuerto ${req.scope.iata}`;
  const stops = { direct: "solo vuelos directos", one: "máximo 1 escala", any: "escalas indiferentes" }[req.stops];
  return [
    `Busca ${req.count === 1 ? "una propuesta" : `${req.count} propuestas`} de viaje de grupo saliendo de ${req.origin} hacia ${scope}.`,
    req.nearbyAirports
      ? `También vale salir de otro aeropuerto a unas 2 horas de ${req.origin} por carretera o tren si el vuelo sale mejor; pon el aeropuerto real de salida en outbound.from y el de llegada de vuelta en inbound.to, y menciónalo en los contras.`
      : `Sal siempre de ${req.origin}.`,
    ...(req.scope.kind === "named"
      ? [
          ...(req.scope.by ? [`Es una idea de ${req.scope.by}${req.scope.note ? `, que dice: «${req.scope.note}»` : ""}.`] : []),
          "Si es una región o isla, elige el aeropuerto que mejor le sirva; si no hay forma razonable de ir, omite la propuesta.",
        ]
      : []),
    ...(req.exclude?.length ? [`Ya tenemos propuestas para: ${req.exclude.join(", ")}. Busca destinos distintos a esos.`] : []),
    `Salida el ${req.dateFrom} (±${req.flexDays} días), ${req.nights} noches, ${req.partySize} personas.`,
    req.maxPriceCents === null
      ? `Sin tope de precio, pero busca buena relación calidad-precio. ${stops}.`
      : `Tope de ${(req.maxPriceCents / 100).toFixed(0)} € por persona en total. ${stops}.`,
    req.estimateStays
      ? "Estima dos opciones de alojamiento para todo el grupo (precio por noche, grupo entero) y marca una como recomendada."
      : "No incluyas alojamiento (stays vacío).",
    req.suggestThings
      ? "Añade cosas concretas que hacer y que ver, cada una con un título y un detalle práctico (no un itinerario por días)."
      : "Deja todo y see vacíos.",
    "Clasifica cada destino como ciudad, escapada, playa o naturaleza. Todos los precios en céntimos de euro, por persona para los vuelos. Fechas ISO 8601 con zona horaria.",
    "Para comparar: hasta 3 pros y 2 contras breves pensando en este grupo y estas fechas, y el tiempo esperado en una línea (por ejemplo «17 °C · lluvioso»).",
    ...(req.home
      ? [
          `El grupo vive en ${req.home}. En access, para cada propuesta: cómo ir desde ${req.home} hasta el aeropuerto de salida (outbound.from) y volver desde el de llegada de vuelta (inbound.to), la forma más razonable para ${req.partySize} personas con maletas. En coche: kilómetros, gasolina repartida entre los coches necesarios con un consumo medio y el precio actual del combustible, peajes y parking en el aeropuerto durante los días del viaje; si no, autobús o tren. mode es car, bus, train u other; title, una línea («Coche hasta Bilbao, 2 coches»); detail, el desglose; minutes, un trayecto; priceEuros, el total por persona de ida y vuelta.`,
          `Ese coste cuenta en el precio por persona: tenlo en cuenta al elegir desde qué aeropuerto salir. Si ${req.home} tiene aeropuerto propio y se sale de ahí, access es lo que cuesta llegar a él.`,
        ]
      : ["Deja access a null."]),
    "En photoSubjects, 3 cosas concretas del destino que valga la pena fotografiar, como términos de búsqueda (por ejemplo «Alfama Lisboa», «Torre de Belém»). No des URLs de imágenes.",
    who.estimate
      ? "No puedes buscar en la web: da precios y horarios realistas según lo que sabes, solo en rutas que alguna aerolínea opere de verdad, y deja sources vacío. Se marcarán como estimados."
      : "Cada propuesta debe citar las páginas de donde salen los números en sources. No inventes vuelos: si no encuentras uno real, omite la propuesta.",
    languageLine(req.locale),
  ].join("\n");
}

// One result per proposal, with ids stable within a search.
export function toResults(req: SearchRequest, output: ResearchOutput | z.infer<typeof EstimateOutput>, who: Researcher = {}): ResearchResult[] {
  return output.proposals.map((p, i) => {
    const { sources, pros, cons, weather, photoSubjects, access, ...rest } = p;
    const reach = req.home && access ? toAccess(req.home, access) : null;
    return {
      proposal: {
        ...rest,
        ...(reach ? { access: reach } : {}),
        id: `${p.place.iata.toLowerCase()}-${i + 1}`,
        planId: req.planId,
        provenance: { kind: "claude", sources, ...(who.by ? { by: who.by } : {}), ...(who.estimate ? { estimate: true } : {}) },
      },
      notes: { pros, cons, weather, photoSubjects },
    };
  });
}

// Research's estimate → what a proposal keeps; nothing when it makes no sense.
export function toAccess(home: string, a: z.infer<typeof ResearchAccess>): Access | null {
  const title = a.title.trim().slice(0, 120);
  if (!title || !Number.isFinite(a.priceEuros)) return null;
  const detail = a.detail.trim().slice(0, 600);
  return {
    home: home.trim().slice(0, 60),
    mode: a.mode,
    title,
    ...(detail ? { detail } : {}),
    minutes: a.minutes && a.minutes > 0 ? Math.round(a.minutes) : null,
    cents: Math.round(a.priceEuros * 100),
  };
}
