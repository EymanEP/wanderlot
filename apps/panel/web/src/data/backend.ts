// Where the panel's data lives: its local server (apps/panel/src/app.ts), or
// the mocks for previews and tests. Screens never call either directly; they
// go through usePanel().
import type { CheckedPrices, DatesView, FlightLeg, GroupSettings, Photo, Plan, Proposal, SuggestionView, TripPage, VoteState } from "@wanderlot/core";
import type { Editorial } from "@wanderlot/mocks";

export type Review = Proposal["review"];

export interface Access {
  memberId: string;
  invite: { status: "valid" | "used" | "expired" | "cancelled"; createdAt: string; expiresAt: string; usedAt: string | null } | null;
  inviteUrl: string | null;
  passkeys: { device: string | null; createdAt: string; lastUsedAt: string | null }[];
  pin: { setAt: string; locked: boolean } | null;
  sessions: { device: string | null; createdAt: string; lastSeenAt: string }[];
}

export interface MemberAccess extends Access {
  id: string;
  name: string;
}

export interface Status {
  research: "claude-cli" | "anthropic-api" | "none";
  flights: "duffel" | "none";
  photos: string[];
  // outdated: deployed from older code; some panel features need a redeploy.
  site: { url: string; reachable: boolean; outdated?: boolean; error?: string };
  // The panel the site serves at /admin (ROADMAP 3.1): no AI there.
  hosted?: boolean;
  // Where trips are kept: on the site, or (with an older site) on this laptop.
  store?: "site" | "file";
}

// The panel at /admin: on or off, and where it is.
export interface OrganiserAccess {
  enabled: boolean;
  setAt: string | null;
  url: string;
}

export interface PlanEntry {
  plan: Plan;
  proposals: Proposal[];
  editorial: Record<string, Partial<Editorial>>;
  // Member ids on this trip (SPEC §5).
  participants?: string[];
}

// What a search is doing right now (the panel server relays it as it happens).
export type SearchStep = { kind: "note"; text: string } | { kind: "search"; query: string } | { kind: "read"; host: string; url: string };

export interface SearchOptions {
  source: "api" | "claude";
  // "named": one place the organiser typed, researched once, by name.
  scope: { kind: "anywhere" } | { kind: "europe" } | { kind: "named"; name: string };
  // Research one friend's idea (the server searches that place by name).
  suggestionId?: string;
  // Its name, for the progress view.
  idea?: string;
  stops: "direct" | "one" | "any";
  estimateStays: boolean;
  suggestThings: boolean;
  nearbyAirports: boolean;
  count: number;
}

export interface PhotoResults {
  photos: Photo[];
  // Sources that failed this time; the rest still answered.
  errors: { source: Photo["source"]; message: string }[];
}

// A vote as the panel follows it (apps/panel/src/app.ts voteView).
export interface VoteView extends VoteState {
  people: { id: string; name: string; voted: boolean }[];
  cities: Record<string, string>;
  // Ready-to-paste messages, when there's something to say.
  reminder: string | null;
  announcement: string | null;
}

export type { CheckedPrices };

// The date vote as Fechas follows it (apps/panel/src/app.ts datesPage).
export interface DatesPage {
  // null: the trip has no date vote.
  dates: DatesView | null;
  people: { id: string; name: string }[];
  // Ready-to-paste messages, when there's something to say.
  reminder: string | null;
  announcement: string | null;
}

// El viaje (apps/panel/src/app.ts tripView): the decided destination, the
// trip page being prepared, and whether the site shows it.
export interface TripView {
  destination: Proposal | null;
  trip: TripPage | null;
  published: boolean;
}

export interface DateWindow {
  dateFrom: string;
  dateTo: string;
}

export interface ScreenshotImage {
  mediaType: "image/png" | "image/jpeg" | "image/webp" | "image/gif";
  data: string; // base64
}

// What Claude read from a screenshot; null where it didn't see it.
export type ExtractedLeg = Omit<FlightLeg, "priceCents">;
export type Extracted =
  | { kind: "flight"; outbound: ExtractedLeg | null; inbound: ExtractedLeg | null; flightCents: number | null }
  | { kind: "stay"; name: string | null; description: string | null; stayCents: number | null; nights: number | null };

export interface TripSummary {
  plan: Plan;
  proposals: number;
  approved: number;
  pending: number;
  participants: number;
  publishedAt: string | null;
  // Something that would go to the site changed since the last publish.
  changed: boolean;
}

// When the trip was last published (null: never), and whether anything that
// would go to the site has changed since.
export interface PublishStatus {
  publishedAt: string | null;
  changed: boolean;
}

export type NewPlan = Pick<Plan, "name" | "origin" | "dateFrom" | "nights" | "flexDays" | "partySize" | "maxPriceCents"> & { participants: string[] };

export interface PanelBackend {
  now(): Date;
  status(): Promise<Status>;
  settings(): Promise<GroupSettings>;
  saveSettings(s: GroupSettings): Promise<GroupSettings>;
  plans(): Promise<Plan[]>;
  plan(planId: string): Promise<PlanEntry | null>;
  createPlan(p: NewPlan): Promise<Plan>;
  // The trips page: each trip with how far along it is.
  trips(): Promise<TripSummary[]>;
  // Here and on the site, with its votes and comments there.
  deletePlan(planId: string): Promise<void>;
  savePlan(p: Plan): Promise<Plan>;
  setParticipants(planId: string, memberIds: string[]): Promise<PlanEntry>;
  // Calls onProposal as each one arrives; resolves when the search ends.
  generate(planId: string, opts: SearchOptions, onProposal: (p: Proposal) => void, signal: AbortSignal, onStep?: (s: SearchStep) => void): Promise<void>;
  review(planId: string, id: string, review: Review): Promise<void>;
  // Deletes every proposal not approved; how many went.
  clearUnapproved(planId: string): Promise<{ removed: number }>;
  verify(planId: string, id: string): Promise<{ verified: true; proposal: Proposal } | { verified: false; reason: string }>;
  editorial(planId: string, id: string, patch: Partial<Editorial>): Promise<void>;
  setPrices(planId: string, id: string, prices: CheckedPrices): Promise<Proposal>;
  // Claude reads screenshots of the flights or the stay; nothing is saved.
  extract(planId: string, id: string, kind: "flight" | "stay", images: ScreenshotImage[]): Promise<Extracted>;
  suggestions(planId: string): Promise<SuggestionView[]>;
  setSuggestion(planId: string, id: string, status: SuggestionView["status"]): Promise<SuggestionView[]>;
  searchPhotos(query: string): Promise<PhotoResults>;
  publish(planId: string): Promise<{ published: number }>;
  // Whether the site shows what a publish would send now.
  publishStatus(planId: string): Promise<PublishStatus>;
  openVote(planId: string, deadline: string): Promise<{ message: string }>;
  vote(planId: string): Promise<VoteView>;
  closeVote(planId: string): Promise<VoteView>;
  // Between tied destinations; with override, any destination in the vote.
  pickWinner(planId: string, destinationId: string, opts?: { override?: boolean; note?: string }): Promise<VoteView>;
  members(): Promise<MemberAccess[]>;
  putMembers(members: { id: string; name: string }[]): Promise<void>;
  invite(memberId: string): Promise<{ url: string; expiresAt: string }>;
  closeSessions(memberId: string): Promise<void>;
  revoke(memberId: string): Promise<void>;
  // The site's data as JSON: one trip, or everything.
  exportData(planId?: string): Promise<unknown>;
  // The panel at /admin (ROADMAP 3.1): its password; null turns it off.
  organiser(): Promise<OrganiserAccess>;
  setOrganiserPassword(password: string | null): Promise<OrganiserAccess>;
  // Cuándo (ROADMAP 2.1).
  dates(planId: string): Promise<DatesPage>;
  // Proposes (or changes) the windows; returns the message for the group.
  proposeDates(planId: string, windows: DateWindow[], deadline: string | null): Promise<DatesPage & { message: string }>;
  // The trip takes these dates; prices checked for others are flagged.
  chooseDates(planId: string, optionId: string): Promise<DatesPage & { plan: Plan }>;
  cancelDates(planId: string): Promise<DatesPage>;
  // El viaje (ROADMAP 2.2–2.4).
  trip(planId: string): Promise<TripView>;
  // Claude drafts the guide and how to get there; steps arrive as it works.
  prepareTrip(planId: string, home: string, onStep?: (s: SearchStep) => void): Promise<TripPage>;
  saveTrip(planId: string, trip: TripPage): Promise<TripView>;
  publishTrip(planId: string, published: boolean): Promise<TripView>;
}

// Something to show the organiser, in their words.
export class BackendError extends Error {}

// "/api" on the laptop; "/admin/api" in the panel the site serves (ROADMAP 3.1).
const ROOT = import.meta.env.BASE_URL.replace(/\/$/, "");

async function call<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const res = await fetch(ROOT + path, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new BackendError(data.error ?? `Error ${res.status}`);
  return data as T;
}

const enc = encodeURIComponent;

export const httpBackend: PanelBackend = {
  now: () => new Date(),
  status: () => call<Status>("/api/status"),
  settings: () => call<GroupSettings>("/api/settings"),
  saveSettings: (s) => call<GroupSettings>("/api/settings", "PUT", s),
  plans: () => call<Plan[]>("/api/plans"),
  async plan(planId) {
    try {
      return await call<PlanEntry>(`/api/plans/${enc(planId)}`);
    } catch (e) {
      if (e instanceof BackendError && /not found/.test(e.message)) return null;
      throw e;
    }
  },
  createPlan: (p) => call<Plan>("/api/plans", "POST", p),
  trips: () => call<TripSummary[]>("/api/trips"),
  deletePlan: async (planId) => void (await call(`/api/plans/${enc(planId)}`, "DELETE")),
  savePlan: (p) => call<Plan>(`/api/plans/${enc(p.id)}`, "PUT", p),
  setParticipants: (planId, ids) => call<PlanEntry>(`/api/plans/${enc(planId)}/participants`, "PUT", ids),
  async generate(planId, opts, onProposal, signal, onStep) {
    const res = await fetch(`${ROOT}/api/plans/${enc(planId)}/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(opts),
      signal,
    });
    if (!res.ok || !res.body) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      throw new BackendError(data.error ?? `Error ${res.status}`);
    }
    // NDJSON: one {proposal}, {done} or {error} per line.
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      let nl: number;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line) continue;
        const msg = JSON.parse(line) as { proposal?: Proposal; progress?: SearchStep; error?: string; done?: true };
        if (msg.error) throw new BackendError(msg.error);
        if (msg.progress) onStep?.(msg.progress);
        if (msg.proposal) onProposal(msg.proposal);
      }
    }
  },
  review: async (planId, id, review) => void (await call(`/api/plans/${enc(planId)}/proposals/${enc(id)}/review`, "POST", { review })),
  clearUnapproved: (planId) => call(`/api/plans/${enc(planId)}/proposals/clear-unapproved`, "POST"),
  verify: (planId, id) => call(`/api/plans/${enc(planId)}/proposals/${enc(id)}/verify`, "POST"),
  editorial: async (planId, id, patch) => void (await call(`/api/plans/${enc(planId)}/proposals/${enc(id)}/editorial`, "PATCH", patch)),
  setPrices: (planId, id, prices) => call<Proposal>(`/api/plans/${enc(planId)}/proposals/${enc(id)}/prices`, "POST", prices),
  extract: (planId, id, kind, images) => call<Extracted>(`/api/plans/${enc(planId)}/proposals/${enc(id)}/extract`, "POST", { kind, images }),
  suggestions: (planId) => call<SuggestionView[]>(`/api/plans/${enc(planId)}/suggestions`),
  setSuggestion: (planId, id, status) => call<SuggestionView[]>(`/api/plans/${enc(planId)}/suggestions/${enc(id)}`, "PUT", { status }),
  searchPhotos: (q) => call<PhotoResults>(`/api/photos?q=${enc(q)}`),
  // The screens confirm unverified prices themselves before calling this.
  publish: (planId) => call<{ published: number }>(`/api/plans/${enc(planId)}/publish`, "POST", { confirm: true }),
  publishStatus: (planId) => call<PublishStatus>(`/api/plans/${enc(planId)}/publish-status`),
  openVote: (planId, deadline) => call<{ message: string }>(`/api/plans/${enc(planId)}/open-vote`, "POST", { deadline }),
  vote: (planId) => call<VoteView>(`/api/plans/${enc(planId)}/vote`),
  closeVote: (planId) => call<VoteView>(`/api/plans/${enc(planId)}/close`, "POST"),
  pickWinner: (planId, destinationId, opts = {}) => call<VoteView>(`/api/plans/${enc(planId)}/winner`, "PUT", { destinationId, ...opts }),
  members: () => call<MemberAccess[]>("/api/members"),
  putMembers: async (members) => void (await call("/api/members", "PUT", members)),
  invite: (id) => call<{ url: string; expiresAt: string }>(`/api/members/${enc(id)}/invite`, "POST"),
  closeSessions: async (id) => void (await call(`/api/members/${enc(id)}/sessions`, "DELETE")),
  revoke: async (id) => void (await call(`/api/members/${enc(id)}/revoke`, "POST")),
  organiser: () => call<OrganiserAccess>("/api/organiser"),
  setOrganiserPassword: (password) => call<OrganiserAccess>("/api/organiser", "PUT", { password }),
  dates: (planId) => call<DatesPage>(`/api/plans/${enc(planId)}/dates`),
  proposeDates: (planId, options, deadline) => call<DatesPage & { message: string }>(`/api/plans/${enc(planId)}/dates`, "PUT", { options, deadline }),
  chooseDates: (planId, optionId) => call<DatesPage & { plan: Plan }>(`/api/plans/${enc(planId)}/dates/choose`, "POST", { optionId }),
  cancelDates: (planId) => call<DatesPage>(`/api/plans/${enc(planId)}/dates`, "DELETE"),
  trip: (planId) => call<TripView>(`/api/plans/${enc(planId)}/trip`),
  async prepareTrip(planId, home, onStep) {
    const res = await fetch(`${ROOT}/api/plans/${enc(planId)}/trip/prepare`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ home }) });
    if (!res.ok || !res.body) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      throw new BackendError(data.error ?? `Error ${res.status}`);
    }
    // NDJSON: {progress} lines, then {trip} or {error}.
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      let nl: number;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line) continue;
        const msg = JSON.parse(line) as { progress?: SearchStep; trip?: TripPage; error?: string };
        if (msg.error) throw new BackendError(msg.error);
        if (msg.progress) onStep?.(msg.progress);
        if (msg.trip) return msg.trip;
      }
    }
    throw new BackendError("La preparación terminó sin resultado");
  },
  saveTrip: (planId, trip) => call<TripView>(`/api/plans/${enc(planId)}/trip`, "PUT", trip),
  publishTrip: (planId, published) => call<TripView>(`/api/plans/${enc(planId)}/trip/publish`, "POST", { published }),
  exportData: (planId) => call<unknown>(`/api/export${planId ? `?plan=${enc(planId)}` : ""}`),
};
