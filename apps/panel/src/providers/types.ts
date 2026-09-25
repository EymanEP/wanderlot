import type { FlightLeg, FlightProviderName, Proposal, Source } from "@wanderlot/core";

// What Generar asks for (SPEC §1, Plan).
export interface SearchRequest {
  planId: string;
  origin: string;
  scope: { kind: "anywhere" } | { kind: "europe" } | { kind: "place"; iata: string };
  dateFrom: string;
  nights: number;
  flexDays: number;
  partySize: number;
  maxPriceCents: number;
  stops: "direct" | "one" | "any";
  estimateStays: boolean;
  suggestThings: boolean;
  count: number;
}

export interface Itinerary {
  outbound: FlightLeg;
  inbound: FlightLeg;
}

// A real fare source. Its results carry `api` provenance.
export interface FlightProvider {
  name: FlightProviderName;
  search(req: SearchRequest, signal?: AbortSignal): AsyncIterable<Omit<Proposal, "review">>;
  // "Verificar con la API": re-price one route and dates. null = no match.
  verify(route: { origin: string; destination: string; outboundDate: string; inboundDate: string; partySize: number }): Promise<Itinerary | null>;
}

// Claude doing web research. Its results always carry `claude` provenance,
// even when it quotes an airline price (SPEC §8).
export interface ResearchProvider {
  research(req: SearchRequest, signal?: AbortSignal): AsyncIterable<Omit<Proposal, "review">>;
}

export type { Source };
