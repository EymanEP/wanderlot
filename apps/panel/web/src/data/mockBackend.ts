// The panel's backend played with the mock data from the design canvas. Used
// by previews and tests; behaves like the real server, including a search
// that streams proposals in one by one.
import { addDaysIso, baseStay, slugify, tally, type GroupSettings, type Photo, type Plan, type Proposal, type SuggestionView, type VoteState } from "@wanderlot/core";
import {
  MOCK_NOW,
  SITE_URL,
  access as mockAccess,
  editorial as mockEditorial,
  ballots as mockBallots,
  members as mockMembers,
  photoLabels,
  placeName,
  plans as mockPlans,
  proposals as mockProposals,
} from "@wanderlot/mocks";
import type { MemberAccess, PanelBackend, PlanEntry, VoteView } from "./backend.ts";

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
  // Whoever is inside in the design signed up with a PIN (and a passkey, as drawn).
  let members: MemberAccess[] = mockMembers.map((m) => {
    const a = mockAccess.find((x) => x.memberId === m.id)!;
    return { id: m.id, name: m.name, ...a, pin: a.passkeys[0] ? { setAt: a.passkeys[0].createdAt, locked: false } : null };
  });
  // Two friends' ideas waiting in Generar.
  let ideas: SuggestionView[] = [
    { id: "s1", place: "Oporto", note: "Vuelos baratos y se come de lujo", createdAt: "2026-09-23T18:10:00Z", status: "new", member: { id: "marta", name: "Marta" }, proposalId: null },
    { id: "s2", place: "Azores", note: "Naturaleza a lo bestia, y en noviembre no hay nadie", createdAt: "2026-09-24T09:30:00Z", status: "new", member: { id: "ivan", name: "Iván" }, proposalId: null },
  ];
  // Who goes on each trip: everyone on the design's plans.
  const participants = new Map<string, string[]>(mockPlans.map((p) => [p.id, mockMembers.map((m) => m.id)]));
  const entry = (id: string) => {
    const e = entries.get(id);
    if (!e) throw new Error("not found");
    return e;
  };
  const patchProposal = (planId: string, id: string, fn: (p: Proposal) => Proposal) => {
    const e = entry(planId);
    entries.set(planId, { ...e, proposals: e.proposals.map((p) => (p.id === id ? fn(p) : p)) });
  };
  // Once a vote opens, the design's four ballots are "in" (4 of 6).
  const ballotsFor = (planId: string) => (planId === "noviembre-2026" ? mockBallots : []);
  const voteView = (planId: string): VoteView => {
    const { plan, proposals, editorial } = entry(planId);
    const ballots = ballotsFor(planId);
    const inVote = proposals.filter((p) => p.review === "approved" && editorial[p.id]?.inVote !== false);
    const counted = tally(
      inVote.map((p) => ({ id: p.id, totalPerPersonCents: p.outbound.priceCents + p.inbound.priceCents })),
      ballots.map((b) => b.ranking).filter((r) => r.every((id) => inVote.some((p) => p.id === id))),
    );
    const state: VoteState = {
      status: plan.status,
      voteDeadline: plan.voteDeadline ?? null,
      partySize: plan.partySize,
      voted: ballots.map((b) => b.memberId),
      tally: counted,
      ballots: [...ballots].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(({ memberId, ranking, updatedAt }) => ({ memberId, ranking, updatedAt })),
      result: plan.status === "closed" ? { ...counted, winnerId: plan.winnerDestinationId ?? counted.winnerId } : null,
    };
    const going = participants.get(planId) ?? [];
    const people = members.filter((m) => going.includes(m.id)).map((m) => ({ id: m.id, name: m.name, voted: state.voted.includes(m.id) }));
    const missing = people.filter((p) => !p.voted).map((p) => p.name);
    const winner = state.result?.winnerId;
    return {
      ...state,
      people,
      cities: Object.fromEntries([...proposals, ...mockProposals].map((p) => [p.id, p.place.city])),
      reminder:
        plan.status === "voting" && missing.length
          ? `Faltan ${missing.join(", ")} por votar ${plan.name}.\nOrdenad vuestros 3 favoritos: ${SITE_URL}/p/${planId}/votacion`
          : null,
      announcement:
        plan.status === "closed" && (winner || !state.result?.tiedForFirst.length)
          ? winner
            ? `Votación de ${plan.name} cerrada: nos vamos a ${placeName(winner)}. Recuento completo en ${SITE_URL}/p/${planId}`
            : `Votación de ${plan.name} cerrada con empate. Recuento en ${SITE_URL}/p/${planId}`
          : null,
    };
  };
  const setPlan = (planId: string, patch: Partial<Plan>) => {
    const e = entry(planId);
    entries.set(planId, { ...e, plan: { ...e.plan, ...patch } });
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
    plan: async (id) => {
      const e = entries.get(id);
      return e ? { ...e, participants: participants.get(id) ?? [] } : null;
    },
    async createPlan(p) {
      const base = slugify(p.name) || "plan";
      let id = base;
      for (let n = 2; entries.has(id); n++) id = `${base}-${n}`;
      const { participants: going, ...fields } = p;
      const plan: Plan = { ...fields, id, dateTo: addDaysIso(p.dateFrom, p.nights), status: "draft" };
      entries.set(id, { plan, proposals: [], editorial: {} });
      participants.set(id, going);
      return plan;
    },
    async setParticipants(planId, ids) {
      participants.set(planId, ids);
      setPlan(planId, { partySize: Math.max(1, ids.length) });
      return { ...entry(planId), participants: ids };
    },
    async savePlan(p) {
      entries.set(p.id, { ...entry(p.id), plan: p });
      return p;
    },
    async generate(planId, opts, onProposal, signal) {
      // A friend's idea: one proposal for that place, credited to them.
      const idea = opts.suggestionId ? ideas.find((i) => i.id === opts.suggestionId) : undefined;
      if (idea) {
        await wait(tickMs * 2, signal);
        const known = mockProposals.find((p) => p.place.city.toLowerCase() === idea.place.toLowerCase());
        const base = known ?? { ...mockProposals[0]!, place: { city: idea.place, country: "", iata: idea.place.slice(0, 3).toUpperCase() } };
        const taken = new Set(entry(planId).proposals.map((p) => p.id));
        let id = base.place.iata.toLowerCase();
        for (let n = 2; taken.has(id); n++) id = `${base.place.iata.toLowerCase()}-${n}`;
        const fresh: Proposal = { ...base, id, planId, review: "pending", suggestedBy: idea.member.name };
        const cur = entry(planId);
        entries.set(planId, { ...cur, proposals: [...cur.proposals, fresh] });
        ideas = ideas.map((i) => (i.id === idea.id ? { ...i, status: "researched", proposalId: id } : i));
        onProposal(fresh);
        return;
      }
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
    suggestions: async () => ideas,
    async setSuggestion(_planId, id, status) {
      ideas = ideas.map((i) => (i.id === id ? { ...i, status } : i));
      return ideas;
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
    async setPrices(planId, id, { outboundCents, inboundCents, stayNightlyCents }) {
      patchProposal(planId, id, (p) => {
        const stay = baseStay(p.stays);
        return {
          ...p,
          outbound: { ...p.outbound, priceCents: outboundCents },
          inbound: { ...p.inbound, priceCents: inboundCents },
          stays: p.stays.map((s) => (s === stay && stayNightlyCents !== undefined ? { ...s, nightlyCents: stayNightlyCents } : s)),
          provenance: { kind: "organiser", checkedAt: MOCK_NOW.toISOString(), sources: p.provenance.kind === "api" ? [] : p.provenance.sources },
        };
      });
      return entry(planId).proposals.find((p) => p.id === id)!;
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
    async vote(planId) {
      if (entry(planId).plan.status === "draft") throw new Error("la votación no está abierta");
      return voteView(planId);
    },
    async closeVote(planId) {
      if (entry(planId).plan.status !== "voting") throw new Error("la votación no está abierta");
      setPlan(planId, { status: "closed" });
      const v = voteView(planId);
      if (v.result?.winnerId) setPlan(planId, { winnerDestinationId: v.result.winnerId });
      return voteView(planId);
    },
    async pickWinner(planId, destinationId) {
      const v = voteView(planId);
      if (!v.result?.tiedForFirst.includes(destinationId)) throw new Error("solo se elige entre los empatados");
      setPlan(planId, { winnerDestinationId: destinationId });
      return voteView(planId);
    },
    members: async () => members,
    async putMembers(list) {
      for (const m of list) {
        if (members.some((x) => x.id === m.id)) patchMember(m.id, { name: m.name });
        else members = [...members, { id: m.id, name: m.name, memberId: m.id, invite: null, inviteUrl: null, passkeys: [], pin: null, sessions: [] }];
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
        pin: null,
        sessions: [],
        inviteUrl: null,
        invite: m?.invite?.status === "valid" ? { ...m.invite, status: "cancelled" } : (m?.invite ?? null),
      });
    },
  };
}
