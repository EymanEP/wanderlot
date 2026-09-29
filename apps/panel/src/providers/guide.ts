// "Preparar el viaje" (ROADMAP 2.2, 2.3): once the destination is decided,
// Claude drafts the trip page's guide and how to get there. A push to start
// from, not an itinerary; the organiser edits it before publishing.
import { z } from "zod";
import { Source, TransportMode, type TripPage } from "@wanderlot/core";

export interface GuideRequest {
  city: string;
  country: string;
  // Arrival airport, and the one the group flies from.
  iata: string;
  origin: string;
  // Where the group lives: to get to the departure airport. Empty: skip it.
  home: string;
  dateFrom: string;
  dateTo: string;
  nights: number;
  partySize: number;
  // The stay, when known, to plan airport → stay.
  stay?: { name: string; description?: string; url?: string };
}

const euros = z.number().nonnegative().nullable();
const Item = z.object({ title: z.string(), detail: z.string() });
const Transport = z.object({
  mode: TransportMode,
  title: z.string(),
  detail: z.string(),
  minutes: z.number().int().positive().nullable(),
  // Per person.
  priceEuros: euros,
});

export const GuideOutput = z.object({
  intro: z.string(),
  todo: z.array(Item.extend({ priceEuros: euros })).max(10),
  food: z.array(Item.extend({ where: z.string() })).max(8),
  sights: z.array(Item).max(8),
  beforeYouGo: z.array(Item).max(8),
  toAirport: z.array(Transport).max(4),
  fromAirport: z.array(Transport).max(4),
  sources: z.array(Source).min(1),
});
export type GuideOutput = z.infer<typeof GuideOutput>;

// From an AI without web search: nothing to cite (ROADMAP 3.3).
export const GuideEstimate = GuideOutput.extend({ sources: z.array(Source).default([]) });

// Draft-07, as for research: the `claude` command's validator needs it.
export const guideJsonSchema = z.toJSONSchema(GuideOutput, { target: "draft-7" });

export function guidePrompt(req: GuideRequest, estimate = false): string {
  return [
    `Un grupo de ${req.partySize} amigos va a ${req.city} (${req.country}) del ${req.dateFrom} al ${req.dateTo} (${req.nights} noches). Vuelan desde ${req.origin} a ${req.iata}.`,
    req.stay ? `Se alojan en «${req.stay.name}»${req.stay.description ? ` (${req.stay.description})` : ""}${req.stay.url ? `, ${req.stay.url}` : ""}.` : "Aún no sabemos dónde se alojan; supón el centro.",
    "Prepara la guía del viaje para la página que verá el grupo. Es un empujón para empezar, no un itinerario: nada de horarios ni plan por días, y sin destripar el viaje. Di qué buscar, no cada detalle.",
    "- intro: dos o tres frases sobre qué tiene de especial el destino en esas fechas.",
    "- todo (qué hacer): hasta 8 cosas concretas, cada una con un detalle práctico y lo que cuesta aproximadamente por persona en euros (null si es gratis o no se sabe).",
    "- food (qué comer): hasta 6 platos o bebidas típicos, con dónde es típico probarlos (un barrio, un tipo de sitio o un mercado; no inventes nombres de restaurantes).",
    "- sights (sitios que ver): hasta 6.",
    "- beforeYouGo (antes de ir): el país en pocas líneas: moneda y efectivo, enchufes, propinas, unas frases útiles, seguridad, abonos de transporte y de qué tener cuidado.",
    req.home
      ? `- toAirport (cómo llegar al aeropuerto): desde ${req.home} hasta el aeropuerto ${req.origin} en las fechas del viaje. Opciones: coche (kilómetros y tiempo, gasolina por persona repartida en los coches necesarios con un consumo medio y el precio actual del combustible, peajes y parking en el aeropuerto durante los días del viaje, con dónde aparcar), autobús y tren (operador, salidas típicas esos días, tiempo, precio por persona y dónde para respecto a la terminal). Pon el total por persona en priceEuros y el desglose en detail.`
      : "- toAirport: déjalo vacío.",
    `- fromAirport (del aeropuerto al alojamiento): metro, autobús, tren, taxi o lanzadera desde ${req.iata}, con tiempo y precio por persona, y cuál conviene a un grupo con maletas (menciónalo en el detalle).`,
    estimate
      ? "No puedes buscar en la web: escribe con lo que sabes, con cifras aproximadas y realistas, y deja sources vacío. Todo en español de España."
      : "Los horarios y precios cambian: da cifras aproximadas y realistas. Cita en sources las páginas de donde salen. Todo en español de España.",
  ].join("\n");
}

const toCents = (euros: number | null) => (euros === null ? null : Math.round(euros * 100));

// Research's answer → the trip page's guide, keeping what the organiser
// already added (stay details, Tricount).
export function toTripPage(destinationId: string, home: string, out: z.infer<typeof GuideEstimate>, now: Date, keep?: Partial<TripPage>, by?: string): TripPage {
  const transport = (t: GuideOutput["toAirport"][number]) => ({ mode: t.mode, title: t.title, detail: t.detail, minutes: t.minutes, priceCents: toCents(t.priceEuros) });
  return {
    destinationId,
    intro: out.intro,
    todo: out.todo.map((t) => ({ title: t.title, detail: t.detail, priceCents: toCents(t.priceEuros) })),
    food: out.food.map((f) => ({ title: f.title, detail: f.detail, ...(f.where ? { where: f.where } : {}) })),
    sights: out.sights.map((s) => ({ title: s.title, detail: s.detail })),
    beforeYouGo: out.beforeYouGo.map((b) => ({ title: b.title, detail: b.detail })),
    home,
    toAirport: home ? out.toAirport.map(transport) : [],
    fromAirport: out.fromAirport.map(transport),
    stay: keep?.stay ?? { address: "", checkIn: "", checkOut: "" },
    tricountUrl: keep?.tricountUrl ?? null,
    sources: out.sources,
    ...(by ? { by } : {}),
    preparedAt: now.toISOString(),
  };
}
