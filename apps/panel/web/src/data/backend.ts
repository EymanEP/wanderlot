// Where the panel's data lives: its local server (apps/panel/src/app.ts), or
// the mocks for previews and tests. Screens never call either directly; they
// go through usePanel().
import type { GroupSettings, Photo, Plan, Proposal, VoteState } from "@wanderlot/core";
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
  site: { url: string; reachable: boolean; error?: string };
}

export interface PlanEntry {
  plan: Plan;
  proposals: Proposal[];
  editorial: Record<string, Partial<Editorial>>;
  // Member ids on this trip (SPEC §5).
  participants?: string[];
}

export interface SearchOptions {
  source: "api" | "claude";
  scope: { kind: "anywhere" } | { kind: "europe" } | { kind: "place"; iata: string };
  stops: "direct" | "one" | "any";
  estimateStays: boolean;
  suggestThings: boolean;
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

export type NewPlan = Pick<Plan, "name" | "origin" | "dateFrom" | "nights" | "flexDays" | "partySize" | "maxPriceCents"> & { participants: string[] };

export interface PanelBackend {
  now(): Date;
  status(): Promise<Status>;
  settings(): Promise<GroupSettings>;
  saveSettings(s: GroupSettings): Promise<GroupSettings>;
  plans(): Promise<Plan[]>;
  plan(planId: string): Promise<PlanEntry | null>;
  createPlan(p: NewPlan): Promise<Plan>;
  savePlan(p: Plan): Promise<Plan>;
  setParticipants(planId: string, memberIds: string[]): Promise<PlanEntry>;
  // Calls onProposal as each one arrives; resolves when the search ends.
  generate(planId: string, opts: SearchOptions, onProposal: (p: Proposal) => void, signal: AbortSignal): Promise<void>;
  review(planId: string, id: string, review: Review): Promise<void>;
  verify(planId: string, id: string): Promise<{ verified: true; proposal: Proposal } | { verified: false; reason: string }>;
  editorial(planId: string, id: string, patch: Partial<Editorial>): Promise<void>;
  searchPhotos(query: string): Promise<PhotoResults>;
  publish(planId: string): Promise<{ published: number }>;
  openVote(planId: string, deadline: string): Promise<{ message: string }>;
  vote(planId: string): Promise<VoteView>;
  closeVote(planId: string): Promise<VoteView>;
  pickWinner(planId: string, destinationId: string): Promise<VoteView>;
  members(): Promise<MemberAccess[]>;
  putMembers(members: { id: string; name: string }[]): Promise<void>;
  invite(memberId: string): Promise<{ url: string; expiresAt: string }>;
  closeSessions(memberId: string): Promise<void>;
  revoke(memberId: string): Promise<void>;
}

// Something to show the organiser, in their words.
export class BackendError extends Error {}

async function call<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const res = await fetch(path, {
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
  savePlan: (p) => call<Plan>(`/api/plans/${enc(p.id)}`, "PUT", p),
  setParticipants: (planId, ids) => call<PlanEntry>(`/api/plans/${enc(planId)}/participants`, "PUT", ids),
  async generate(planId, opts, onProposal, signal) {
    const res = await fetch(`/api/plans/${enc(planId)}/generate`, {
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
        const msg = JSON.parse(line) as { proposal?: Proposal; error?: string; done?: true };
        if (msg.error) throw new BackendError(msg.error);
        if (msg.proposal) onProposal(msg.proposal);
      }
    }
  },
  review: async (planId, id, review) => void (await call(`/api/plans/${enc(planId)}/proposals/${enc(id)}/review`, "POST", { review })),
  verify: (planId, id) => call(`/api/plans/${enc(planId)}/proposals/${enc(id)}/verify`, "POST"),
  editorial: async (planId, id, patch) => void (await call(`/api/plans/${enc(planId)}/proposals/${enc(id)}/editorial`, "PATCH", patch)),
  searchPhotos: (q) => call<PhotoResults>(`/api/photos?q=${enc(q)}`),
  // The screens confirm unverified prices themselves before calling this.
  publish: (planId) => call<{ published: number }>(`/api/plans/${enc(planId)}/publish`, "POST", { confirm: true }),
  openVote: (planId, deadline) => call<{ message: string }>(`/api/plans/${enc(planId)}/open-vote`, "POST", { deadline }),
  vote: (planId) => call<VoteView>(`/api/plans/${enc(planId)}/vote`),
  closeVote: (planId) => call<VoteView>(`/api/plans/${enc(planId)}/close`, "POST"),
  pickWinner: (planId, destinationId) => call<VoteView>(`/api/plans/${enc(planId)}/winner`, "PUT", { destinationId }),
  members: () => call<MemberAccess[]>("/api/members"),
  putMembers: async (members) => void (await call("/api/members", "PUT", members)),
  invite: (id) => call<{ url: string; expiresAt: string }>(`/api/members/${enc(id)}/invite`, "POST"),
  closeSessions: async (id) => void (await call(`/api/members/${enc(id)}/sessions`, "DELETE")),
  revoke: async (id) => void (await call(`/api/members/${enc(id)}/revoke`, "POST")),
};
