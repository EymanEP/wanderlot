// The panel's backend played with the mock data from the design canvas. Used
// by previews and tests; behaves like the real server, including a search
// that streams proposals in one by one.
import { addDaysIso, slugify, type GroupSettings, type Photo, type Plan, type Proposal } from "@wanderlot/core";
import {
  MOCK_NOW,
  SITE_URL,
  access as mockAccess,
  editorial as mockEditorial,
  members as mockMembers,
  photoLabels,
  plans as mockPlans,
  proposals as mockProposals,
} from "@wanderlot/mocks";
import type { MemberAccess, PanelBackend, PlanEntry } from "./backend.ts";

// The order proposals "arrive" in during a mock search: the design's list.
const ARRIVAL = ["lis", "nap", "rak", "bud", "tfs", "opo", "edi", "fco", "prg", "krk", "mla", "ath"];

const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new DOMException("aborted", "AbortError"));
    });
  });

function token(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// A stand-in photo: a tinted card with the search written on it, so previews
// never load images from the network.
function mockPhoto(query: string, i: number): Photo {
  const hues = [18, 200, 140, 40, 280, 350, 90, 230];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="533"><rect width="800" height="533" fill="hsl(${hues[i % hues.length]} 45% 72%)"/><text x="400" y="280" font-family="sans-serif" font-size="34" text-anchor="middle" fill="#2b2118">${query.replace(/[<&>"]/g, "")} · ${i + 1}</text></svg>`;
  const source = (["wikimedia", "unsplash", "pexels"] as const)[i % 3]!;
  return {
    url: `data:image/svg+xml,${encodeURIComponent(svg)}`,
    width: 800,
    height: 533,
    source,
    author: ["Ana Pérez", "Rui Silva", "Marta Gómez"][i % 3]!,
    license: source === "wikimedia" ? "CC BY-SA 4.0" : source === "unsplash" ? "Unsplash License" : "Pexels License",
    sourceUrl: "https://example.org/foto",
    alt: `${query} ${i + 1}`,
  };
}

// What research would have suggested photographing, from the design's labels.
const photoQueries = (id: string) => {
  const l = photoLabels[id];
  return l ? [l.hero, ...l.tiles.filter((t) => t !== "El piso")] : [];
};

export function mockBackend({ tickMs = 650, verifyMs = 1200 }: { tickMs?: number; verifyMs?: number } = {}): PanelBackend {
  // Voting in the mocks is open on the site; here the plan is still being
  // curated, as in the Revisar and Comparativa designs.
  const entries = new Map<string, PlanEntry>(
    mockPlans.map((p) => [
      p.id,
      {
        plan: p.id === "noviembre-2026" ? { ...p, status: "draft" as const, voteDeadline: undefined } : p,
        proposals: p.id === "noviembre-2026" ? [...mockProposals].sort((a, b) => ARRIVAL.indexOf(a.id) - ARRIVAL.indexOf(b.id)) : [],
        editorial:
          p.id === "noviembre-2026"
            ? Object.fromEntries(Object.entries(mockEditorial).map(([id, e]) => [id, { ...e, photoQueries: photoQueries(id) }]))
            : {},
      },
    ]),
  );
  let settings: GroupSettings = { groupName: "Grupo 51", organiserName: "Eyman", defaultOrigin: "MAD" };
  let members: MemberAccess[] = mockMembers.map((m) => ({ id: m.id, name: m.name, ...mockAccess.find((a) => a.memberId === m.id)! }));
  const entry = (id: string) => {
    const e = entries.get(id);
    if (!e) throw new Error("not found");
    return e;
  };
  const patchProposal = (planId: string, id: string, fn: (p: Proposal) => Proposal) => {
    const e = entry(planId);
    entries.set(planId, { ...e, proposals: e.proposals.map((p) => (p.id === id ? fn(p) : p)) });
  };
  const patchMember = (id: string, patch: Partial<MemberAccess>) => {
    members = members.map((m) => (m.id === id ? { ...m, ...patch } : m));
  };

  return {
    now: () => MOCK_NOW,
    status: async () => ({ research: "claude-cli", flights: "duffel", photos: ["wikimedia"], site: { url: SITE_URL, reachable: true } }),
    settings: async () => settings,
    saveSettings: async (s) => (settings = s),
    plans: async () => [...entries.values()].map((e) => e.plan),
    plan: async (id) => entries.get(id) ?? null,
    async createPlan(p) {
      const base = slugify(p.name) || "plan";
      let id = base;
      for (let n = 2; entries.has(id); n++) id = `${base}-${n}`;
      const plan: Plan = { ...p, id, dateTo: addDaysIso(p.dateFrom, p.nights), status: "draft" };
      entries.set(id, { plan, proposals: [], editorial: {} });
      return plan;
    },
    async savePlan(p) {
      entries.set(p.id, { ...entry(p.id), plan: p });
      return p;
    },
    async generate(planId, _opts, onProposal, signal) {
      // Re-runs the canvas's twelve, one per tick.
      const e = entry(planId);
      const pool = planId === "noviembre-2026" ? ARRIVAL.map((id) => mockProposals.find((p) => p.id === id)!) : [];
      entries.set(planId, { ...e, proposals: e.proposals.filter((p) => p.review !== "pending") });
      for (const p of pool) {
        await wait(tickMs, signal);
        const fresh: Proposal = { ...p, review: e.proposals.find((x) => x.id === p.id)?.review === "approved" ? "approved" : "pending" };
        const cur = entry(planId);
        entries.set(planId, { ...cur, proposals: [...cur.proposals.filter((x) => x.id !== p.id), fresh] });
        onProposal(fresh);
      }
    },
    review: async (planId, id, review) => patchProposal(planId, id, (p) => ({ ...p, review })),
    async verify(planId, id) {
      await wait(verifyMs);
      patchProposal(planId, id, (p) => ({ ...p, provenance: { kind: "api", provider: "duffel", checkedAt: MOCK_NOW.toISOString() } }));
      return { verified: true, proposal: entry(planId).proposals.find((p) => p.id === id)! };
    },
    async editorial(planId, id, patch) {
      const e = entry(planId);
      entries.set(planId, { ...e, editorial: { ...e.editorial, [id]: { ...e.editorial[id], ...patch } } });
    },
    async searchPhotos(query) {
      await wait(Math.min(tickMs, 400));
      return { photos: Array.from({ length: 8 }, (_, i) => mockPhoto(query, i)), errors: [] };
    },
    publish: async (planId) => ({ published: entry(planId).proposals.filter((p) => p.review === "approved").length }),
    async openVote(planId, deadline) {
      const e = entry(planId);
      entries.set(planId, { ...e, plan: { ...e.plan, status: "voting", voteDeadline: deadline } });
      const pending = members.filter((m) => m.passkeys.length === 0);
      return {
        message: [
          `Abierta la votación de ${e.plan.name}.`,
          "Ordenad vuestros 3 destinos favoritos antes de que se cierre.",
          "",
          `Entrad en ${SITE_URL}/p/${planId}`,
          ...(pending.length ? ["", "Si aún no habéis entrado nunca, vuestra invitación (sirve una vez, no la reenviéis):", ...pending.map((m) => `• ${m.name}: ${m.inviteUrl ?? `${SITE_URL}/i/${token()}`}`)] : []),
        ].join("\n"),
      };
    },
    members: async () => members,
    async putMembers(list) {
      for (const m of list) {
        if (members.some((x) => x.id === m.id)) patchMember(m.id, { name: m.name });
        else members = [...members, { id: m.id, name: m.name, memberId: m.id, invite: null, inviteUrl: null, passkeys: [], sessions: [] }];
      }
    },
    async invite(id) {
      const expiresAt = new Date(MOCK_NOW.getTime() + 7 * 86_400_000).toISOString();
      const url = `${SITE_URL}/i/${token()}`;
      patchMember(id, { inviteUrl: url, invite: { status: "valid", createdAt: MOCK_NOW.toISOString(), expiresAt, usedAt: null } });
      return { url, expiresAt };
    },
    closeSessions: async (id) => patchMember(id, { sessions: [] }),
    async revoke(id) {
      const m = members.find((x) => x.id === id);
      patchMember(id, {
        passkeys: [],
        sessions: [],
        inviteUrl: null,
        invite: m?.invite?.status === "valid" ? { ...m.invite, status: "cancelled" } : (m?.invite ?? null),
      });
    },
  };
}
