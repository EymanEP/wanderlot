// Shared data model. The snapshot schema is the contract between panel and
// site: the panel builds one on publish, the site validates it verbatim.
// See docs/SPEC.md §1.
import { z } from "zod";

// Links end up in hrefs and <img src>: web addresses only, never javascript:
// or data: (some come from Claude's web research).
const webUrl = z.url({ protocol: /^https?$/ });

const iata = z.string().regex(/^[A-Z]{3}$/, "IATA code");
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD");
const isoDateTime = z.iso.datetime({ offset: true });
const id = z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/, "slug id");
const cents = z.number().int().nonnegative();

export const PlanStatus = z.enum(["draft", "voting", "closed"]);
export type PlanStatus = z.infer<typeof PlanStatus>;

export const FlightLeg = z.object({
  from: iata,
  to: iata,
  departAt: isoDateTime,
  arriveAt: isoDateTime,
  carrier: z.string().min(1),
  flightNumber: z.string().min(1),
  stops: z.number().int().min(0).max(3),
  priceCents: cents,
});
export type FlightLeg = z.infer<typeof FlightLeg>;

export const Stay = z.object({
  name: z.string().min(1), // "Piso entero, 3 habitaciones · Chiaia"
  kind: z.string().min(1), // "Apartamento", "Hotel", …
  description: z.string().optional(), // "A 15 min andando del centro"
  nightlyCents: cents, // whole group, per night
  url: webUrl.optional(),
  recommended: z.boolean().default(false),
});
export type Stay = z.infer<typeof Stay>;

export const Source = z.object({ label: z.string().min(1), url: webUrl });
export type Source = z.infer<typeof Source>;

export const FlightProviderName = z.enum(["duffel", "amadeus", "kiwi"]);
export type FlightProviderName = z.infer<typeof FlightProviderName>;

// Where a proposal's prices come from (SPEC §3): a flight API, the organiser
// checking the real prices by hand, or Claude's web research. Staleness is
// derived from checkedAt, never stored.
export const Provenance = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("api"),
    provider: FlightProviderName,
    checkedAt: isoDateTime,
  }),
  z.object({
    kind: z.literal("organiser"),
    checkedAt: isoDateTime,
    // Research's links, kept for reference.
    sources: z.array(Source).default([]),
  }),
  z.object({
    kind: z.literal("claude"),
    sources: z.array(Source).min(1),
  }),
]);
export type Provenance = z.infer<typeof Provenance>;

// The Plan page's filter row groups destinations by these.
export const Category = z.enum(["ciudad", "escapada", "playa", "naturaleza"]);
export type Category = z.infer<typeof Category>;

// One entry in "Qué hacer" / "Qué ver": a specific thing, not an itinerary slot.
export const Thing = z.object({
  title: z.string().min(1),
  detail: z.string().optional(),
});
export type Thing = z.infer<typeof Thing>;

export const Place = z.object({
  city: z.string().min(1),
  country: z.string().min(1),
  iata,
});
export type Place = z.infer<typeof Place>;

// Linked, never hosted, and only from services that allow it (SPEC §6).
export const Photo = z.object({
  url: webUrl,
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  source: z.enum(["unsplash", "pexels", "wikimedia"]),
  author: z.string().min(1),
  authorUrl: webUrl.optional(),
  license: z.string().min(1),
  sourceUrl: webUrl,
  alt: z.string(),
  // Unsplash only: the event URL to call when the organiser picks the photo.
  downloadLocation: webUrl.optional(),
});
export type Photo = z.infer<typeof Photo>;

// What research produces. Lives only in the panel.
export const Proposal = z.object({
  id,
  planId: id,
  place: Place,
  category: Category,
  outbound: FlightLeg,
  inbound: FlightLeg,
  stays: z.array(Stay).max(2),
  todo: z.array(Thing),
  see: z.array(Thing),
  provenance: Provenance,
  // The friend whose idea it was, when researched from a suggestion.
  suggestedBy: z.string().min(1).max(60).optional(),
  review: z.enum(["pending", "approved", "discarded"]),
});
export type Proposal = z.infer<typeof Proposal>;

// An approved proposal as the site sees it.
export const Destination = Proposal.omit({ review: true, planId: true }).extend({
  pros: z.array(z.string()),
  cons: z.array(z.string()),
  weather: z.string(),
  photos: z.array(Photo),
  inVote: z.boolean(),
  totalPerPersonCents: cents,
  approvedAt: isoDateTime.optional(),
});
export type Destination = z.infer<typeof Destination>;

export const Plan = z.object({
  id,
  name: z.string().min(1),
  origin: iata,
  dateFrom: isoDate,
  dateTo: isoDate,
  nights: z.number().int().min(1).max(30),
  flexDays: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  partySize: z.number().int().min(1),
  // Per person, flights and stay; null means no limit.
  maxPriceCents: cents.nullable(),
  status: PlanStatus,
  voteDeadline: isoDateTime.optional(),
  winnerDestinationId: id.optional(),
});
export type Plan = z.infer<typeof Plan>;

// Panel → site. The only thing that ever crosses the boundary (§2).
export const Snapshot = z
  .object({
    plan: Plan.omit({ status: true, winnerDestinationId: true }),
    destinations: z.array(Destination),
    publishedAt: isoDateTime,
  })
  .superRefine((s, ctx) => {
    const ids = new Set<string>();
    for (const d of s.destinations) {
      if (ids.has(d.id)) {
        ctx.addIssue({ code: "custom", message: `duplicate destination ${d.id}` });
      }
      ids.add(d.id);
      if (d.stays.filter((st) => st.recommended).length > 1) {
        ctx.addIssue({ code: "custom", message: `${d.id}: more than one recommended stay` });
      }
    }
  });
export type Snapshot = z.infer<typeof Snapshot>;

export const Member = z.object({ id, name: z.string().min(1) });
export type Member = z.infer<typeof Member>;

export const Ballot = z.object({
  memberId: id,
  ranking: z.array(id),
  castAt: isoDateTime,
  updatedAt: isoDateTime,
});
export type Ballot = z.infer<typeof Ballot>;

export const Comment = z.object({
  id: z.string(),
  planId: id,
  destinationId: id,
  memberId: id,
  parentId: z.string().optional(),
  body: z.string().min(1).max(4000),
  createdAt: isoDateTime,
});
export type Comment = z.infer<typeof Comment>;

// Who the site belongs to (SPEC §11): set by the organiser from the panel.
export const GroupSettings = z.object({
  groupName: z.string().trim().min(1).max(60),
  organiserName: z.string().trim().min(1).max(60),
  defaultOrigin: iata.optional(),
});
export type GroupSettings = z.infer<typeof GroupSettings>;

export const DEFAULT_SETTINGS: GroupSettings = { groupName: "Wanderlot", organiserName: "quien organiza" };

// A plan as the site lists it, without its destinations.
export const PlanSummary = z.object({
  id,
  name: z.string(),
  status: PlanStatus,
  dateFrom: isoDate,
  dateTo: isoDate,
  partySize: z.number().int(),
  winnerCity: z.string().nullable(),
});
export type PlanSummary = z.infer<typeof PlanSummary>;

// A comment as members see it.
export type CommentView = Comment & { likes: number; likedByMe: boolean };

// A destination a friend suggested for a trip (SPEC §4): what the site lists
// and the panel researches.
export interface SuggestionView {
  id: string;
  place: string;
  note: string | null;
  createdAt: string;
  status: "new" | "researched" | "dismissed";
  member: { id: string; name: string };
  // The proposal researched from it, once there is one.
  proposalId: string | null;
}
