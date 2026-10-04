import type { FlightLeg, FlightProviderName, Locale, Proposal, Source } from "@wanderlot/core";
import type { ExtractRequest } from "./extract.ts";
import type { GuideRequest } from "./guide.ts";
import type { BrowseRequest } from "./browse.ts";
import type { Researcher } from "./research.ts";

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
  // The group's language, for what the AI writes. Absent: Spanish.
  locale?: Locale;
  // Where the group lives: research works out getting to each departure
  // airport and back (ROADMAP 2.3). Absent: it doesn't.
  home?: string;
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

// An AI doing web research: Claude, or another the organiser chose (ROADMAP
// 3.3). Its results always carry `claude` provenance (research, whoever did
// it), even when it quotes an airline price (SPEC §8).
export interface ResearchProvider {
  // Which AI this is, when not Claude searching the web (ROADMAP 3.3).
  who?: Researcher;
  research(req: SearchRequest, signal?: AbortSignal, onProgress?: (p: ResearchProgress) => void): AsyncIterable<ResearchResult>;
  // Reads a screenshot of a flight or a stay; resolves to the raw answer,
  // shaped by extract.ts's schema for that kind.
  extract(req: ExtractRequest, signal?: AbortSignal): Promise<unknown>;
  // "Preparar el viaje": the trip page's guide and how to get there, shaped
  // by guide.ts's schema. Optional: without it the organiser writes it.
  guide?(req: GuideRequest, signal?: AbortSignal, onProgress?: (p: ResearchProgress) => void): Promise<unknown>;
  // "Mirar en Google Flights / Airbnb": reads the real page in a browser on
  // the organiser's laptop; resolves to the raw answer, shaped by browse.ts's
  // schema for that kind. Only with the `claude` command and Playwright MCP.
  browse?(req: BrowseRequest, signal?: AbortSignal, onProgress?: (p: ResearchProgress) => void): Promise<unknown>;
  // The same work, handed to the AI's own servers to run in the background
  // and checked on later (ROADMAP 3.3): how the panel at /admin searches,
  // since a Worker request can't wait minutes. Absent: not possible.
  background?: BackgroundAi;
}

// What a background job does: research for a trip, or its guide.
export type BackgroundTask = { kind: "research"; req: SearchRequest } | { kind: "guide"; req: GuideRequest };

// "running" may name a new id: the job went on in a new request (a search
// that paused and was resumed).
export type BackgroundCheck = { state: "running"; id?: string } | { state: "done"; raw: unknown } | { state: "failed"; error: string };

export interface BackgroundAi {
  // Resolves to the AI's id for the job.
  start(task: BackgroundTask): Promise<string>;
  check(id: string, task: BackgroundTask): Promise<BackgroundCheck>;
  cancel(id: string): Promise<void>;
}

export type { Source };
