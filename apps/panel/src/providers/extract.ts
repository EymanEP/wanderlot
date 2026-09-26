// Reading a screenshot the organiser took of a flight or a stay (the airline,
// Google Flights, Airbnb) into the fields of the price dialog. Shared by the
// `claude` command and the Anthropic API; the organiser reviews the result
// before anything is saved.
import { z } from "zod";
import { FlightLeg } from "@wanderlot/core";

export type ExtractKind = "flight" | "stay";

export interface ExtractImage {
  mediaType: "image/png" | "image/jpeg" | "image/webp" | "image/gif";
  // base64, without the data: prefix
  data: string;
}

export interface ExtractRequest {
  kind: ExtractKind;
  images: ExtractImage[];
  // The trip, to fill in what a screenshot leaves out (the year, the airports).
  context: { origin: string; city: string; iata: string; dateFrom: string; dateTo: string; nights: number; partySize: number };
}

const Leg = FlightLeg.omit({ priceCents: true });

export const FlightExtract = z.object({
  outbound: Leg.nullable(),
  inbound: Leg.nullable(),
  // As the screenshot shows it: per person, or a total for some passengers.
  pricePerPersonEuros: z.number().nonnegative().nullable(),
  totalEuros: z.number().nonnegative().nullable(),
  passengers: z.number().int().positive().nullable(),
});
export type FlightExtract = z.infer<typeof FlightExtract>;

export const StayExtract = z.object({
  name: z.string().min(1).max(120).nullable(),
  description: z.string().max(200).nullable(),
  // The whole stay, every night, with cleaning and fees if shown.
  totalEuros: z.number().nonnegative().nullable(),
  nights: z.number().int().positive().nullable(),
});
export type StayExtract = z.infer<typeof StayExtract>;

export const extractSchemas = { flight: FlightExtract, stay: StayExtract } as const;

// Draft-07, as the `claude` command wants (see research.ts).
export function extractJsonSchema(kind: ExtractKind) {
  return z.toJSONSchema(extractSchemas[kind], { target: "draft-7" });
}

export function extractPrompt(req: ExtractRequest, files?: string[]): string {
  const c = req.context;
  const where = files?.length ? `Las capturas están en estos archivos; léelos: ${files.join(", ")}.` : "Las capturas van adjuntas.";
  const trip = `El viaje: ${c.partySize} personas, de ${c.origin} a ${c.city} (${c.iata}), ida el ${c.dateFrom} y vuelta el ${c.dateTo}, ${c.nights} noches.`;
  const common = "Usa solo lo que se ve en las capturas: si un dato no aparece, pon null. No inventes ni busques nada.";
  if (req.kind === "flight") {
    return [
      "Son capturas de los vuelos de un viaje (de una aerolínea, Google Flights, Skyscanner o similar).",
      where,
      trip,
      "Extrae el vuelo de ida (outbound) y el de vuelta (inbound): aeropuertos (código IATA), hora de salida y de llegada, compañía, número de vuelo y escalas.",
      "Escribe las horas en ISO 8601 con el desfase horario del aeropuerto correspondiente (por ejemplo 2026-11-18T11:55:00+01:00). Si la captura no dice el año, usa el del viaje.",
      "Del precio: si la captura dice el precio por persona, ponlo en pricePerPersonEuros; si dice un total para varios pasajeros, ponlo en totalEuros y el número de pasajeros en passengers. En euros; si está en otra moneda, pon null.",
      common,
    ].join("\n");
  }
  return [
    "Son capturas de un alojamiento (de Airbnb, Booking o similar).",
    where,
    trip,
    "Extrae el nombre del alojamiento tal como aparece, una descripción corta (tipo, habitaciones, barrio) de menos de 200 caracteres, el precio total de la estancia en euros (todas las noches, con limpieza y tasas si aparecen) y el número de noches.",
    common,
  ].join("\n");
}

// What the price dialog fills in, worked out from what was read.
export function extractedFields(kind: ExtractKind, raw: unknown) {
  if (kind === "flight") {
    const f = FlightExtract.parse(raw);
    const perPerson = f.pricePerPersonEuros ?? (f.totalEuros !== null && f.passengers ? f.totalEuros / f.passengers : null);
    return { kind, outbound: f.outbound, inbound: f.inbound, flightCents: perPerson === null ? null : Math.round(perPerson * 100) };
  }
  const s = StayExtract.parse(raw);
  return { kind, name: s.name, description: s.description, stayCents: s.totalEuros === null ? null : Math.round(s.totalEuros * 100), nights: s.nights };
}
export type Extracted = ReturnType<typeof extractedFields>;
