import type { FlightLeg, FlightProviderName, Proposal, Source } from "@wanderlot/core";
import type { ExtractRequest } from "./extract.ts";

// What Generar asks for (SPEC §1, Plan).
export interface SearchRequest {
  planId: string;
  origin: string;
  // "named": a place a friend suggested, in their words ("Oporto", "Azores").
  scope: { kind: "anywhere" } | { kind: "europe" } | { kind: "place"; iata: string } | { kind: "named"; name: string; note?: string; by?: string };
  dateFrom: string;
  nights: number;
  flexDays: number;
  partySize: number;
  // null: no limit.
  maxPriceCents: number | null;
  stops: "direct" | "one" | "any";
  estimateStays: boolean;
  suggestThings: boolean;
  // Also consider airports within about two hours of the origin.
  nearbyAirports: boolean;
  count: number;
  // Destinations already proposed for this trip: look for others.
  exclude?: string[];
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

// What research adds for Comparativa, beside the proposal itself.
export interface ResearchNotes {
  pros: string[];
  cons: string[];
  weather: string;
  // Search terms for the photo picker; Claude never supplies image URLs.
  photoSubjects: string[];
}

export interface ResearchResult {
  proposal: Omit<Proposal, "review">;
  notes?: ResearchNotes;
}

// What research is doing right now, for Generar's live view.
export type ResearchProgress =
  | { kind: "note"; text: string } // Claude saying what it's about to do
  | { kind: "search"; query: string } // a web search
  | { kind: "read"; host: string; url: string }; // a page it's reading

// Claude doing web research. Its results always carry `claude` provenance,
// even when it quotes an airline price (SPEC §8).
export interface ResearchProvider {
  research(req: SearchRequest, signal?: AbortSignal, onProgress?: (p: ResearchProgress) => void): AsyncIterable<ResearchResult>;
  // Reads a screenshot of a flight or a stay; resolves to the raw answer,
  // shaped by extract.ts's schema for that kind.
  extract(req: ExtractRequest, signal?: AbortSignal): Promise<unknown>;
}

export type { Source };
