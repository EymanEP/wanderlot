// Shared data model. The snapshot schema is the contract between panel and
// site: the panel builds one on publish, the site validates it verbatim.
// See docs/SPEC.md §1.
import { z } from "zod";

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
  name: z.string().min(1),
  kind: z.string().min(1), // "Apartamento", "Hotel", …
  nightlyCents: cents, // whole group, per night
  url: z.url().optional(),
  recommended: z.boolean().default(false),
});
export type Stay = z.infer<typeof Stay>;

export const Source = z.object({ label: z.string().min(1), url: z.url() });
export type Source = z.infer<typeof Source>;

export const FlightProviderName = z.enum(["duffel", "amadeus", "kiwi"]);
export type FlightProviderName = z.infer<typeof FlightProviderName>;

// Exactly two kinds. Staleness is derived from checkedAt, never stored (§3).
export const Provenance = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("api"),
    provider: FlightProviderName,
    checkedAt: isoDateTime,
  }),
  z.object({
    kind: z.literal("claude"),
    sources: z.array(Source).min(1),
  }),
]);
export type Provenance = z.infer<typeof Provenance>;

export const Place = z.object({
  city: z.string().min(1),
  country: z.string().min(1),
  iata,
});
export type Place = z.infer<typeof Place>;

export const Photo = z.object({
  url: z.url(),
  source: z.enum(["unsplash", "pexels", "wikimedia"]),
  author: z.string().min(1),
  license: z.string().min(1),
  sourceUrl: z.url(),
});
export type Photo = z.infer<typeof Photo>;

// What research produces. Lives only in the panel.
export const Proposal = z.object({
  id,
  planId: id,
  place: Place,
  outbound: FlightLeg,
  inbound: FlightLeg,
  stays: z.array(Stay).max(2),
  todo: z.array(z.string().min(1)),
  see: z.array(z.string().min(1)),
  provenance: Provenance,
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
});
export type Destination = z.infer<typeof Destination>;

export const Plan = z.object({
  id,
  name: z.string().min(1),
  origin: iata,
  dateFrom: isoDate,
  dateTo: isoDate,
  nights: z.union([z.literal(3), z.literal(5), z.literal(7), z.literal(10)]),
  flexDays: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  partySize: z.number().int().min(1),
  maxPriceCents: cents,
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
