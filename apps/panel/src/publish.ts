// Builds the snapshot the site receives and checks what the organiser should
// confirm before it goes out (SPEC §2, §3).
import { Snapshot, totalPerPersonCents, trustState, type Destination } from "@wanderlot/core";
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

export interface SiteClient {
  publish(s: Snapshot): Promise<void>;
  openVote(planId: string, deadline: string): Promise<void>;
  issueLinks(members: { id: string; name: string }[]): Promise<{ id: string; name: string; token: string }[]>;
}

export function siteClient(baseUrl: string, adminToken: string, fetchImpl: typeof fetch = fetch): SiteClient {
  async function call(path: string, method: string, body: unknown) {
    const res = await fetchImpl(new URL(`/api/admin${path}`, baseUrl), {
      method,
      headers: { authorization: `Bearer ${adminToken}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) throw new Error(`sitio ${res.status}: ${data.error ?? res.statusText}`);
    return data;
  }
  return {
    publish: async (s) => void (await call(`/plans/${s.plan.id}`, "PUT", s)),
    openVote: async (planId, deadline) => void (await call(`/plans/${planId}/open-vote`, "POST", { deadline })),
    issueLinks: async (members) => (await call("/members", "POST", members)) as unknown as { id: string; name: string; token: string }[],
  };
}
