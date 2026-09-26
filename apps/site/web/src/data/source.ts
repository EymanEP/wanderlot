// Where the site's data comes from: the real API (SPEC §9) or the mocks. Both
// follow the API's rules, so screens behave the same on either: while a vote
// is open you see who has voted and your own ballot, never anyone else's.
import {
  tally,
  type Ballot,
  type CommentView,
  type Destination,
  type Plan,
  type PlanSummary,
  type SuggestionView,
  type TallyResult,
} from "@wanderlot/core";
import {
  MOCK_NOW,
  ME,
  ballots as mockBallots,
  comments as mockComments,
  destinations as mockDestinations,
  lateBallots,
  members as mockMembers,
  placeName,
  plan as mockPlan,
  plans as mockPlans,
} from "@wanderlot/mocks";

export interface PlanView {
  plan: Plan;
  destinations: Destination[];
  me: { id: string; name: string };
  myBallot: { ranking: string[]; updatedAt: string } | null;
  participation: { id: string; name: string; voted: boolean }[];
}

export interface Results extends TallyResult {
  ballots: { memberId: string; name?: string; ranking: string[] }[];
}

export interface SiteSource {
  now(): Date;
  plans(): Promise<PlanSummary[]>;
  plan(planId: string): Promise<PlanView | null>;
  // Only once the vote has closed; null before.
  results(planId: string): Promise<Results | null>;
  comments(planId: string): Promise<CommentView[]>;
  saveBallot(planId: string, ranking: string[]): Promise<void>;
  addComment(planId: string, destinationId: string, body: string, parentId?: string): Promise<CommentView>;
  like(planId: string, commentId: string, on: boolean): Promise<{ likes: number; likedByMe: boolean }>;
  // Ideas for where to go, from anyone on the trip.
  suggestions(planId: string): Promise<SuggestionView[]>;
  suggest(planId: string, place: string, note: string): Promise<SuggestionView[]>;
}

// Something the person should see, in their words.
export class SourceError extends Error {}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    credentials: "same-origin",
    ...init,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new SourceError(data.error ?? `Error ${res.status}`);
  return data as T;
}

export const httpSource: SiteSource = {
  now: () => new Date(),
  plans: () => request<PlanSummary[]>("/api/plans"),
  async plan(planId) {
    try {
      return await request<PlanView>(`/api/plans/${encodeURIComponent(planId)}`);
    } catch (e) {
      if (e instanceof SourceError && /not found/.test(e.message)) return null;
      throw e;
    }
  },
  async results(planId) {
    const res = await fetch(`/api/plans/${encodeURIComponent(planId)}/results`, { credentials: "same-origin" });
    return res.ok ? ((await res.json()) as Results) : null;
  },
  comments: (planId) => request<CommentView[]>(`/api/plans/${encodeURIComponent(planId)}/comments`),
  saveBallot: async (planId, ranking) => void (await request(`/api/plans/${encodeURIComponent(planId)}/ballot`, { method: "PUT", body: JSON.stringify({ ranking }) })),
  addComment: (planId, destinationId, body, parentId) =>
    request<CommentView>(`/api/plans/${encodeURIComponent(planId)}/comments`, {
      method: "POST",
      body: JSON.stringify({ destinationId, body, ...(parentId ? { parentId } : {}) }),
    }),
  like: (planId, commentId, on) =>
    request(`/api/plans/${encodeURIComponent(planId)}/comments/${encodeURIComponent(commentId)}/like`, { method: "PUT", body: JSON.stringify({ on }) }),
  suggestions: (planId) => request<SuggestionView[]>(`/api/plans/${encodeURIComponent(planId)}/suggestions`),
  suggest: (planId, place, note) =>
    request<SuggestionView[]>(`/api/plans/${encodeURIComponent(planId)}/suggestions`, {
      method: "POST",
      body: JSON.stringify({ place, ...(note.trim() ? { note } : {}) }),
    }),
};

// The mocks, played by the API's rules. `closed` previews the site after the vote.
export function mockSource({ closed = false }: { closed?: boolean } = {}): SiteSource {
  let ballots: Ballot[] = closed ? [...mockBallots, ...lateBallots] : [...mockBallots];
  let comments: CommentView[] = mockComments.map((c) => ({ ...c, likedByMe: false }));
  let suggestions: SuggestionView[] = [
    {
      id: "s0",
      place: "Oporto",
      note: "Vuelos baratos y se come de lujo",
      createdAt: "2026-09-23T18:10:00Z",
      status: "new",
      member: { id: "marta", name: "Marta" },
      proposalId: null,
    },
  ];
  const plan: Plan = closed ? { ...mockPlan, status: "closed", winnerDestinationId: "nap" } : mockPlan;
  const inVote = mockDestinations.filter((d) => d.inVote);
  const tallied = () =>
    tally(
      inVote.map((d) => ({ id: d.id, totalPerPersonCents: d.totalPerPersonCents })),
      ballots.map((b) => b.ranking),
    );

  return {
    now: () => MOCK_NOW,
    async plans() {
      return mockPlans.map((p) => ({
        id: p.id,
        name: p.name,
        status: p.id === plan.id ? plan.status : p.status,
        dateFrom: p.dateFrom,
        dateTo: p.dateTo,
        partySize: p.partySize,
        winnerCity: p.id === plan.id ? (closed ? "Nápoles" : null) : p.winnerDestinationId ? placeName(p.winnerDestinationId) : null,
      }));
    },
    async plan(planId) {
      const other = mockPlans.find((p) => p.id === planId);
      if (!other) return null;
      const isMain = planId === plan.id;
      const mine = isMain ? ballots.find((b) => b.memberId === ME.id) : undefined;
      return {
        plan: isMain ? plan : other,
        // The other mock plans carry only their headline.
        destinations: isMain ? mockDestinations : [],
        me: { id: ME.id, name: ME.name },
        myBallot: mine ? { ranking: mine.ranking, updatedAt: mine.updatedAt } : null,
        participation: mockMembers.map((m) => ({ id: m.id, name: m.name, voted: isMain && ballots.some((b) => b.memberId === m.id) })),
      };
    },
    async results(planId) {
      if (planId !== plan.id || plan.status !== "closed") return null;
      return { ...tallied(), ballots: ballots.map((b) => ({ memberId: b.memberId, ranking: b.ranking })) };
    },
    async comments(planId) {
      return planId === plan.id ? [...comments].sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : [];
    },
    async saveBallot(_planId, ranking) {
      const at = MOCK_NOW.toISOString();
      const mine = ballots.find((b) => b.memberId === ME.id);
      const next: Ballot = { memberId: ME.id, ranking, castAt: mine?.castAt ?? at, updatedAt: at };
      ballots = mine ? ballots.map((b) => (b.memberId === ME.id ? next : b)) : [...ballots, next];
    },
    async addComment(planId, destinationId, body, parentId) {
      const c: CommentView = {
        id: `local-${comments.length + 1}-${Date.now()}`,
        planId,
        destinationId,
        memberId: ME.id,
        body,
        createdAt: MOCK_NOW.toISOString(),
        likes: 0,
        likedByMe: false,
        ...(parentId ? { parentId } : {}),
      };
      comments = [...comments, c];
      return c;
    },
    async like(_planId, commentId, on) {
      comments = comments.map((c) => (c.id === commentId && c.likedByMe !== on ? { ...c, likedByMe: on, likes: c.likes + (on ? 1 : -1) } : c));
      const c = comments.find((x) => x.id === commentId)!;
      return { likes: c.likes, likedByMe: c.likedByMe };
    },
    suggestions: async () => suggestions,
    async suggest(_planId, place, note) {
      if (!place.trim()) throw new SourceError("Escribe el destino");
      suggestions = [
        ...suggestions,
        { id: `s${suggestions.length + 1}`, place: place.trim(), note: note.trim() || null, createdAt: MOCK_NOW.toISOString(), status: "new", member: { id: ME.id, name: ME.name }, proposalId: null },
      ];
      return suggestions;
    },
  };
}
