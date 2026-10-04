// Shared data model. The snapshot schema is the contract between panel and
// site: the panel builds one on publish, the site validates it verbatim.
// See docs/SPEC.md §1.
import { z } from "zod";
import { Locale } from "./i18n.ts";

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
    // The trip's dates changed after this check: the price was for others.
    forOtherDates: z.boolean().optional(),
  }),
  z.object({
    kind: z.literal("organiser"),
    checkedAt: isoDateTime,
    // Research's links, kept for reference.
    sources: z.array(Source).default([]),
    // The flights' times, dates and numbers were checked too (read from a
    // screenshot), not only the price. Without it they're research's guess,
    // and the site shows the price alone.
    flightDetails: z.boolean().optional(),
    // Read off these sites in a browser, then reviewed by the organiser
    // ("Mirar en Google Flights / Airbnb"): the site says where.
    seenOn: z.array(z.enum(["google-flights", "airbnb"])).optional(),
    // The trip's dates changed after this check: the price was for others.
    forOtherDates: z.boolean().optional(),
  }),
  // Researched by an AI: Claude, or another the organiser chose (ROADMAP
  // 3.3). The kind keeps its first name so older data still reads.
  z
    .object({
      kind: z.literal("claude"),
      sources: z.array(Source),
      // Which AI, as friends see it ("OpenAI"); absent means Claude.
      by: z.string().min(1).max(40).optional(),
      // It couldn't search the web: the prices are what the model knows, not
      // quotes from a page, so there's nothing to cite.
      estimate: z.boolean().optional(),
    })
    .refine((p) => p.estimate === true || p.sources.length > 0, { message: "cite at least one source", path: ["sources"] }),
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

export const TransportMode = z.enum(["car", "bus", "train", "metro", "taxi", "shuttle", "walk", "other"]);
export type TransportMode = z.infer<typeof TransportMode>;

// Getting from home to the departure airport and back (ROADMAP 2.3, phase
// 2): it goes into the per-person total, so flying from further away only
// wins when it really is cheaper.
export const Access = z.object({
  // Where the group sets off from: "Logroño".
  home: z.string().trim().min(1).max(60),
  mode: TransportMode,
  // "Coche hasta Bilbao, 2 coches"
  title: z.string().trim().min(1).max(120),
  detail: z.string().max(600).optional(),
  // One way.
  minutes: z.number().int().positive().nullable(),
  // Per person, there and back: fuel, tolls and parking shared, or tickets.
  cents,
  // Typed or corrected by the organiser rather than estimated by research.
  checked: z.boolean().optional(),
});
export type Access = z.infer<typeof Access>;

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
  // Absent: not worked out (no home town known when it was researched).
  access: Access.optional(),
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
  // Where they're going: the vote's winner, or another destination the
  // organiser chose after it, with a note saying why.
  winnerDestinationId: id.optional(),
  decidedNote: z.string().max(300).optional(),
});
export type Plan = z.infer<typeof Plan>;

// --- El viaje (ROADMAP 2.2–2.4) -------------------------------------------

// One way to cover a stretch: home → departure airport, or arrival airport →
// the stay. Prices per person, estimated by research unless the organiser
// changes them.

export const TransportOption = z.object({
  mode: TransportMode,
  title: z.string().min(1).max(120), // "Coche hasta Bilbao"
  detail: z.string().max(600).default(""), // "250 km por la AP-68 · 2 coches · 32 € de peaje · parking P3"
  minutes: z.number().int().positive().nullable().default(null),
  priceCents: cents.nullable().default(null),
});
export type TransportOption = z.infer<typeof TransportOption>;

// One entry in the guide: something to do, eat, see, or know before going.
export const GuideItem = z.object({
  title: z.string().min(1).max(120),
  detail: z.string().max(600).default(""),
  // Qué hacer: roughly what it costs a person; null when free or unknown.
  priceCents: cents.nullable().optional(),
  // Qué comer: where it's typical to try it.
  where: z.string().max(200).optional(),
});
export type GuideItem = z.infer<typeof GuideItem>;

// The trip page, once the destination is decided: what the group needs in
// one place. Research drafts the guide and how to get there; the organiser
// edits it and adds the stay's details and the Tricount link.
export const TripPage = z.object({
  destinationId: id,
  intro: z.string().max(1000).default(""),
  todo: z.array(GuideItem).max(15).default([]),
  food: z.array(GuideItem).max(15).default([]),
  sights: z.array(GuideItem).max(15).default([]),
  beforeYouGo: z.array(GuideItem).max(15).default([]),
  // Cómo llegar: from the group's home town to the airport, and from the
  // destination's airport to the stay.
  home: z.string().max(60).default(""),
  toAirport: z.array(TransportOption).max(6).default([]),
  fromAirport: z.array(TransportOption).max(6).default([]),
  stay: z
    .object({ address: z.string().max(200).default(""), checkIn: z.string().max(60).default(""), checkOut: z.string().max(60).default("") })
    .default({ address: "", checkIn: "", checkOut: "" }),
  tricountUrl: webUrl.nullable().default(null),
  // Where the guide's facts and prices came from.
  sources: z.array(Source).default([]),
  // Which AI drafted it, when not Claude (ROADMAP 3.3).
  by: z.string().min(1).max(40).optional(),
  preparedAt: isoDateTime.nullable().default(null),
});
export type TripPage = z.infer<typeof TripPage>;

// Panel → site. The only thing that ever crosses the boundary (§2).
export const Snapshot = z
  .object({
    plan: Plan.omit({ status: true, winnerDestinationId: true, decidedNote: true }),
    destinations: z.array(Destination),
    // The trip page, once published; older snapshots don't have one.
    trip: TripPage.optional(),
    // The organiser settled the dates without a vote ("Fijar estas fechas"):
    // the group is asked about days off from then on.
    datesDecided: z.boolean().optional(),
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
    if (s.trip && !ids.has(s.trip.destinationId)) {
      ctx.addIssue({ code: "custom", message: `trip page for ${s.trip.destinationId}, which isn't published` });
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
  // "Salimos desde": the group's home town, for Cómo llegar (ROADMAP 2.3).
  homeTown: z.string().trim().max(60).optional(),
  // The group's language (ROADMAP 4): the site's, until someone picks their
  // own, and the messages' and the guide's. Spanish when unset.
  locale: Locale.optional(),
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
  // For the trips page: how many destinations, until when the vote runs and
  // whether this person has voted. Older sites leave them out.
  destinations: z.number().int().optional(),
  voteDeadline: isoDateTime.nullable().optional(),
  votedByMe: z.boolean().optional(),
  // A date vote is open (ROADMAP 2.1), and whether this person has answered it.
  datesOpen: z.boolean().optional(),
  datesAnsweredByMe: z.boolean().optional(),
  // The trip page is published (ROADMAP 2.2).
  tripReady: z.boolean().optional(),
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

// The site's admin API version. Bumped whenever the panel starts needing
// something new from the site, so it can tell the organiser to redeploy
// (npm run deploy:site). 5: trips, PINs, suggestions, vote state with ballots.
// 6: deleting a trip. 7: going somewhere other than the vote's winner; export.
// 8: the date vote. 9: the trip page. 10: the panel's data on the site, and
// the panel at /admin. 11: research by other AIs, including estimates
// without sources. 12: searching from /admin in the background. 13: days off,
// and settling the dates on the site without publishing. 14: the group's
// language, and the site in English. 15: getting to the departure airport
// in each destination's total.
export const SITE_API_VERSION = 15;
