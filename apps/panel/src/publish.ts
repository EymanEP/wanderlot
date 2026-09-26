// Builds the snapshot the site receives and checks what the organiser should
// confirm before it goes out (SPEC §2, §3).
import { Snapshot, totalPerPersonCents, trustState, type Destination, type GroupSettings, type VoteState } from "@wanderlot/core";
import type { PlanEntry } from "./store.ts";

export function buildSnapshot(entry: PlanEntry, now: Date): Snapshot {
  const { plan } = entry;
  const destinations: Destination[] = entry.proposals
    .filter((p) => p.review === "approved")
    .map(({ review: _review, planId: _planId, ...p }) => {
      const ed = entry.editorial[p.id] ?? {};
      return {
        ...p,
        pros: ed.pros ?? [],
        cons: ed.cons ?? [],
        weather: ed.weather ?? "",
        photos: ed.photos ?? [],
        inVote: ed.inVote ?? true,
        totalPerPersonCents: totalPerPersonCents(p, plan.nights, plan.partySize),
      };
    });
  const { status: _s, winnerDestinationId: _w, ...planFields } = plan;
  return Snapshot.parse({ plan: planFields, destinations, publishedAt: now.toISOString() });
}

export interface PublishWarning {
  destinationId: string;
  city: string;
  reason: "unverified" | "stale";
}

// Unverified or stale proposals may be published, but only after the
// organiser confirms, and they arrive labelled.
export function publishWarnings(entry: PlanEntry, now: Date): PublishWarning[] {
  return entry.proposals
    .filter((p) => p.review === "approved")
    .flatMap((p) => {
      const t = trustState(p.provenance, now);
      if (t.kind === "verified") return [];
      return [{ destinationId: p.id, city: p.place.city, reason: t.kind === "stale" ? "stale" : "unverified" } as const];
    });
}

export type InviteStatus = "valid" | "used" | "expired" | "cancelled";

// A member as the site reports them to the panel (SPEC §5). No secrets.
export interface MemberStatus {
  id: string;
  name: string;
  invite: { status: InviteStatus; createdAt: string; expiresAt: string; usedAt: string | null } | null;
  passkeys: { device: string | null; createdAt: string; lastUsedAt: string | null }[];
  sessions: { device: string | null; createdAt: string; lastSeenAt: string }[];
}

export interface SiteClient {
  settings(): Promise<GroupSettings>;
  putSettings(s: GroupSettings): Promise<GroupSettings>;
  publish(s: Snapshot): Promise<void>;
  openVote(planId: string, deadline: string): Promise<void>;
  vote(planId: string): Promise<VoteState>;
  closeVote(planId: string): Promise<VoteState>;
  pickWinner(planId: string, destinationId: string): Promise<VoteState>;
  putMembers(members: { id: string; name: string }[]): Promise<void>;
  members(): Promise<MemberStatus[]>;
  // A one-time invite; the token comes back once and the site keeps only its hash.
  invite(memberId: string): Promise<{ token: string; expiresAt: string }>;
  closeSessions(memberId: string): Promise<void>;
  revoke(memberId: string): Promise<void>;
}

// The site said no; the panel passes its answer on.
export class SiteError extends Error {
  constructor(
    readonly status: number,
    readonly reason: string,
  ) {
    super(`sitio ${status}: ${reason}`);
  }
}

export function siteClient(baseUrl: string, adminToken: string, fetchImpl: typeof fetch = fetch): SiteClient {
  async function call<T>(path: string, method: string, body?: unknown): Promise<T> {
    const res = await fetchImpl(new URL(`/api/admin${path}`, baseUrl), {
      method,
      headers: { authorization: `Bearer ${adminToken}`, "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) throw new SiteError(res.status, data.error ?? res.statusText);
    return data as T;
  }
  return {
    settings: () => call<GroupSettings>("/settings", "GET"),
    putSettings: (s) => call<GroupSettings>("/settings", "PUT", s),
    publish: async (s) => void (await call(`/plans/${s.plan.id}`, "PUT", s)),
    openVote: async (planId, deadline) => void (await call(`/plans/${planId}/open-vote`, "POST", { deadline })),
    vote: (planId) => call<VoteState>(`/plans/${planId}/vote`, "GET"),
    closeVote: (planId) => call<VoteState>(`/plans/${planId}/close`, "POST"),
    pickWinner: (planId, destinationId) => call<VoteState>(`/plans/${planId}/winner`, "PUT", { destinationId }),
    putMembers: async (members) => void (await call("/members", "PUT", members)),
    members: () => call<MemberStatus[]>("/members", "GET"),
    invite: (id) => call<{ token: string; expiresAt: string }>(`/members/${id}/invite`, "POST"),
    closeSessions: async (id) => void (await call(`/members/${id}/sessions`, "DELETE")),
    revoke: async (id) => void (await call(`/members/${id}/revoke`, "POST")),
  };
}
