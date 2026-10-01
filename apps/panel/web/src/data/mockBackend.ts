// The panel's backend played with the mock data from the design canvas. Used
// by previews and tests; behaves like the real server, including a search
// that streams proposals in one by one.
import { DateWindows, TripPage, addDaysIso, answeredAll, applyCheckedPrices, markForOtherDates, nightsOf, rangeLabel, slugify, tally, type DatesView, type GroupSettings, type LeaveStatus, type Photo, type Plan, type Proposal, type SuggestionView, type VoteState } from "@wanderlot/core";
import {
  DATES_PLAN_ID,
  MOCK_NOW,
  SITE_URL,
  dates as mockDates,
  tripPage as mockTripPage,
  access as mockAccess,
  editorial as mockEditorial,
  ballots as mockBallots,
  members as mockMembers,
  photoLabels,
  placeName,
  plans as mockPlans,
  proposals as mockProposals,
} from "@wanderlot/mocks";
import type { AiOption, AiView, BrowserView, LeavePage, DatesPage, MemberAccess, OrganiserAccess, PanelBackend, PanelJob, PlanEntry, Status, TripView, VoteView } from "./backend.ts";

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

// hosted: as the panel the site serves at /admin, without AI.
// hostedAi: the site has an OpenAI key, so the panel at /admin can search in
// the background; a job ends on the second check.
export function mockBackend({ tickMs = 650, verifyMs = 1200, hosted = false, hostedAi = false }: { tickMs?: number; verifyMs?: number; hosted?: boolean; hostedAi?: boolean } = {}): PanelBackend {
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
  // What the site last got, per plan: the approved proposals and their notes.
  const published = new Map<string, { at: string; key: string }>();
  const publishKey = (planId: string) => {
    const e = entry(planId);
    const approved = e.proposals.filter((p) => p.review === "approved");
    const t = trips.get(planId);
    return JSON.stringify([e.plan, approved, approved.map((p) => e.editorial[p.id] ?? null), t?.published ? t.trip : null]);
  };
  // The panel at /admin: off until a password is set.
  let organiser: OrganiserAccess = { enabled: false, setAt: null, url: `${SITE_URL}/admin/` };
  // Date votes on the site, per plan.
  const datesBy = new Map<string, DatesView>([[DATES_PLAN_ID, mockDates]]);
  // Days off: answers per plan, for the dates they were given for.
  const leaveBy = new Map<string, Map<string, { status: LeaveStatus; dateFrom: string; dateTo: string; at: string; byOrganiser: boolean }>>();
  const leavePage = (planId: string): LeavePage => {
    const e = entry(planId);
    const d = datesBy.get(planId);
    const settled = d ? d.status === "closed" && !!d.chosenOptionId : !!e.datesDecided;
    if (!settled) return { leave: null, reminder: null };
    const { dateFrom, dateTo } = e.plan;
    const going = participants.get(planId) ?? [];
    const answers = leaveBy.get(planId) ?? new Map();
    const people = members
      .filter((m) => going.includes(m.id))
      .map((m) => {
        const a = answers.get(m.id);
        const current = !!a && a.dateFrom === dateFrom && a.dateTo === dateTo;
        return { id: m.id, name: m.name, status: current ? a!.status : ("not-asked" as const), at: current ? a!.at : null, byOrganiser: current && a!.byOrganiser, forOtherDates: !!a && !current };
      });
    const missing = people.filter((p) => p.status !== "approved" && p.status !== "denied").map((p) => p.name);
    const who = missing.length === 1 ? `Falta ${missing[0]}` : `Faltan ${missing.slice(0, -1).join(", ")} y ${missing.at(-1)}`;
    return {
      leave: { dateFrom, dateTo, people },
      reminder: missing.length ? `${e.plan.name}, ${rangeLabel(dateFrom, dateTo)}: antes de reservar nada, ¿os han aprobado los días en el trabajo? ${who} por confirmarlo. Se marca aquí: ${SITE_URL}/p/${planId}` : null,
    };
  };

  const datesPage = (planId: string): DatesPage => {
    const d = datesBy.get(planId) ?? null;
    const going = participants.get(planId) ?? [];
    const people = members.filter((m) => going.includes(m.id)).map((m) => ({ id: m.id, name: m.name }));
    const missing = d ? people.filter((p) => !answeredAll(d, p.id)).map((p) => p.name) : [];
    const chosen = d?.options.find((o) => o.id === d.chosenOptionId);
    const { name } = entry(planId).plan;
    const link = `${SITE_URL}/p/${planId}/fechas`;
    return {
      dates: d,
      people,
      reminder: d?.status === "open" && missing.length ? `${missing.length === 1 ? `Falta ${missing[0]}` : `Faltan ${missing.slice(0, -1).join(", ")} y ${missing.at(-1)}`} por decir qué fechas le vienen bien para ${name}. Es un minuto: ${link}` : null,
      announcement: chosen ? `Fechas de ${name} decididas: ${rangeLabel(chosen.dateFrom, chosen.dateTo)}. Ya podéis pedir los días. ${link}` : null,
    };
  };
  // El viaje, per plan: the page being prepared and whether it's published.
  const trips = new Map<string, { trip: TripPage; published: boolean }>();
  const tripView = (planId: string): TripView => {
    const e = entry(planId);
    const destination = e.proposals.find((p) => p.id === e.plan.winnerDestinationId) ?? null;
    const t = trips.get(planId);
    const trip = t && t.trip.destinationId === destination?.id ? t.trip : null;
    return { destination, trip, published: !!trip && !!t?.published };
  };
  // A trip whose vote already ran was published when it opened.
  for (const e of entries.values()) if (e.plan.status !== "draft") published.set(e.plan.id, { at: MOCK_NOW.toISOString(), key: publishKey(e.plan.id) });
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
      result:
        plan.status === "closed"
          ? { ...counted, winnerId: plan.winnerDestinationId ?? counted.winnerId, voteWinnerId: counted.winnerId, decidedNote: plan.decidedNote ?? null }
          : null,
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

  // Ajustes: the laptop has the claude command; the site, no key yet.
  const aiOptions: AiOption[] = [
    ...(hosted ? [] : [{ id: "claude-cli" as const, name: "Claude (comando claude)", model: null, ready: true, setup: "", search: true, images: true, background: false }]),
    { id: "anthropic-api", name: "Claude (API de Anthropic)", model: null, ready: false, setup: hosted ? "Guárdala en el sitio: npx wrangler secret put ANTHROPIC_API_KEY (en apps/site)." : "Añade ANTHROPIC_API_KEY a .env (npm run setup) y reinicia el panel.", search: true, images: true, background: true },
    { id: "openai-api", name: "OpenAI", model: "gpt-5", ready: !hosted || hostedAi, setup: hosted ? "Guárdala en el sitio: npx wrangler secret put OPENAI_API_KEY (en apps/site)." : "Añade OPENAI_API_KEY a .env (npm run setup) y reinicia el panel.", search: true, images: true, background: true },
    { id: "compatible-api", name: "Otra IA compatible con OpenAI", model: null, ready: false, setup: "Añade AI_BASE_URL, AI_API_KEY y AI_MODEL a .env (OpenRouter, por ejemplo: https://openrouter.ai/api/v1) y reinicia el panel.", search: false, images: true, background: false },
  ];
  let aiActive: AiView["active"] = hosted ? (hostedAi ? "openai-api" : null) : "claude-cli";

  // Background jobs (the panel at /admin): what each saves once it ends.
  const finishers = new Map<string, { checks: number; finish: () => Partial<PanelJob> }>();
  const startJob = (planId: string, kind: PanelJob["kind"], finish: () => Partial<PanelJob>): PanelJob => {
    const e = entry(planId);
    if (e.job?.status === "running") throw new Error("Ya hay una búsqueda en marcha en este viaje: espera a que termine o cancélala.");
    const job: PanelJob = { kind, ai: "openai-api", aiName: "OpenAI", startedAt: MOCK_NOW.toISOString(), status: "running" };
    entries.set(planId, { ...e, job });
    finishers.set(planId, { checks: 0, finish });
    return job;
  };
  const aiView = (): AiView => ({ options: aiOptions, active: aiActive, canChoose: !hosted });
  // Brave and Chrome on this pretend laptop.
  let browserView: BrowserView = {
    options: [
      { id: "chrome", name: "Chrome", path: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" },
      { id: "brave", name: "Brave", path: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" },
    ],
    active: "chrome",
  };

  const patchMember = (id: string, patch: Partial<MemberAccess>) => {
    members = members.map((m) => (m.id === id ? { ...m, ...patch } : m));
  };

  return {
    now: () => MOCK_NOW,
    async status(): Promise<Status> {
      const a = aiOptions.find((o) => o.id === aiActive);
      const name = a?.id === "claude-cli" || a?.id === "anthropic-api" ? "Claude" : a?.name;
      const ai = a && name ? { research: a.id, ai: { name, search: a.search, images: a.images, background: a.background } } : { research: "none" as const };
      return hosted
        ? { ...ai, flights: "none", photos: ["wikimedia"], site: { url: SITE_URL, reachable: true }, hosted: true, store: "site" }
        : { ...ai, browse: true, browser: browserView.options.find((o) => o.id === browserView.active)?.name ?? "Chrome", flights: "duffel", photos: ["wikimedia"], site: { url: SITE_URL, reachable: true } };
    },
    ai: async () => aiView(),
    browsers: async () => browserView,
    async chooseBrowser(id) {
      if (!browserView.options.some((o) => o.id === id)) throw new Error("Ese navegador no está instalado en este ordenador");
      browserView = { ...browserView, active: id };
      return browserView;
    },
    // "Comprobar precios": both pages, for the dialog, as the server does.
    async checkPrices(planId, id, onStep, onSite) {
      onSite?.("flight");
      const flight = await this.browse(planId, id, "flight", onStep);
      onSite?.("stay");
      const stay = await this.browse(planId, id, "stay", onStep);
      return { readings: { flight, stay } };
    },
    async chooseAi(id) {
      if (hosted || !aiOptions.find((o) => o.id === id)?.ready) throw new Error("Esa IA no está configurada");
      aiActive = id;
      return aiView();
    },
    async addProposal(planId, { place, category, ...prices }) {
      const e = entry(planId);
      const base = slugify(place.city) || place.iata.toLowerCase();
      let id = base;
      for (let n = 2; e.proposals.some((p) => p.id === id); n++) id = `${base}-${n}`;
      const leg = (from: string, to: string, day: string) => ({ from, to, departAt: `${day}T12:00:00Z`, arriveAt: `${day}T12:00:00Z`, carrier: "Por confirmar", flightNumber: "—", stops: 0, priceCents: 0 });
      const proposal: Proposal = applyCheckedPrices(
        {
          id,
          planId,
          place,
          category,
          outbound: leg(e.plan.origin, place.iata, e.plan.dateFrom),
          inbound: leg(place.iata, e.plan.origin, e.plan.dateTo),
          stays: [],
          todo: [],
          see: [],
          provenance: { kind: "organiser", checkedAt: MOCK_NOW.toISOString(), sources: [], ...(prices.outbound ? { flightDetails: true } : {}) },
          review: "approved",
        },
        prices,
        e.plan.nights,
      );
      entries.set(planId, { ...e, proposals: [...e.proposals, proposal], editorial: { ...e.editorial, [id]: { photoQueries: [place.city] } } });
      return proposal;
    },
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
    async trips() {
      const list = await Promise.all(
        [...entries.values()].map(async ({ plan, proposals }) => {
          const status = await this.publishStatus(plan.id);
          return {
            plan,
            proposals: proposals.length,
            approved: proposals.filter((p) => p.review === "approved").length,
            pending: proposals.filter((p) => p.review === "pending").length,
            participants: participants.get(plan.id)?.length ?? 0,
            ...status,
          };
        }),
      );
      return list.reverse();
    },
    async deletePlan(planId) {
      entries.delete(planId);
      participants.delete(planId);
      published.delete(planId);
    },
    async setParticipants(planId, ids) {
      participants.set(planId, ids);
      setPlan(planId, { partySize: Math.max(1, ids.length) });
      return { ...entry(planId), participants: ids };
    },
    async savePlan(p) {
      const e = entry(p.id);
      const moved = e.plan.dateFrom !== p.dateFrom || e.plan.dateTo !== p.dateTo;
      entries.set(p.id, { ...e, plan: p, proposals: moved ? e.proposals.map(markForOtherDates) : e.proposals });
      return p;
    },
    async job(planId) {
      const e = entry(planId);
      const f = finishers.get(planId);
      if (e.job?.status === "running" && f && ++f.checks >= 2) {
        finishers.delete(planId);
        entries.set(planId, { ...entry(planId), job: { ...e.job, status: "done", finishedAt: MOCK_NOW.toISOString(), ...f.finish() } });
      }
      return entry(planId).job ?? null;
    },
    async clearJob(planId) {
      finishers.delete(planId);
      const { job: _gone, ...rest } = entry(planId);
      entries.set(planId, rest);
    },
    async generate(planId, opts, onProposal, signal, onStep) {
      // The panel at /admin: three of the canvas's proposals, found in the
      // background, each with an unused id.
      if (hosted) {
        if (!hostedAi) throw new Error("Para buscar desde el panel del sitio hace falta una clave de Claude (API de Anthropic) u OpenAI en el sitio.");
        return startJob(planId, "research", () => {
          const e = entry(planId);
          const taken = new Set(e.proposals.map((p) => p.id));
          const fresh = mockProposals.slice(0, 3).map((p): Proposal => {
            let id = p.id;
            for (let n = 2; taken.has(id); n++) id = `${p.id}-${n}`;
            taken.add(id);
            return { ...p, id, planId, review: "pending", provenance: { kind: "claude", sources: p.provenance.kind === "claude" ? p.provenance.sources : [{ label: "OpenAI", url: "https://openai.com" }], by: "OpenAI" } };
          });
          entries.set(planId, { ...e, proposals: [...e.proposals, ...fresh] });
          return { added: fresh.length };
        });
      }
      // One named place, typed by the organiser or a friend's idea (credited
      // to them): one proposal for it.
      const idea = opts.suggestionId ? ideas.find((i) => i.id === opts.suggestionId) : undefined;
      const place = idea?.place ?? (opts.scope.kind === "named" ? opts.scope.name : undefined);
      if (place) {
        onStep?.({ kind: "note", text: `Busco cómo ir a ${place} desde Madrid en esas fechas.` });
        await wait(tickMs, signal);
        onStep?.({ kind: "search", query: `vuelos Madrid ${place} noviembre 2026` });
        await wait(tickMs, signal);
        const known = mockProposals.find((p) => p.place.city.toLowerCase() === place.toLowerCase());
        const base = known ?? { ...mockProposals[0]!, place: { city: place, country: "", iata: place.slice(0, 3).toUpperCase() } };
        const taken = new Set(entry(planId).proposals.map((p) => p.id));
        let id = base.place.iata.toLowerCase();
        for (let n = 2; taken.has(id); n++) id = `${base.place.iata.toLowerCase()}-${n}`;
        const fresh: Proposal = { ...base, id, planId, review: "pending", ...(idea ? { suggestedBy: idea.member.name } : {}) };
        const cur = entry(planId);
        entries.set(planId, { ...cur, proposals: [...cur.proposals, fresh] });
        if (idea) ideas = ideas.map((i) => (i.id === idea.id ? { ...i, status: "researched", proposalId: id } : i));
        onProposal(fresh);
        return;
      }
      // Re-runs the canvas's twelve, one per tick.
      const e = entry(planId);
      const pool = planId === "noviembre-2026" ? ARRIVAL.map((id) => mockProposals.find((p) => p.id === id)!) : [];
      entries.set(planId, { ...e, proposals: e.proposals.filter((p) => p.review !== "pending") });
      onStep?.({ kind: "note", text: "Voy a buscar vuelos directos desde Madrid para esas fechas y comparar precios." });
      for (const p of pool) {
        onStep?.({ kind: "search", query: `vuelos directos Madrid ${p.place.city} noviembre 2026 precio` });
        await wait(tickMs / 2, signal);
        onStep?.({ kind: "read", host: "skyscanner.es", url: `https://www.skyscanner.es/vuelos/mad/${p.place.iata.toLowerCase()}` });
        await wait(tickMs / 2, signal);
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
    async clearUnapproved(planId) {
      const e = entry(planId);
      const kept = e.proposals.filter((p) => p.review === "approved");
      const editorial = Object.fromEntries(Object.entries(e.editorial).filter(([id]) => kept.some((p) => p.id === id)));
      entries.set(planId, { ...e, proposals: kept, editorial });
      return { removed: e.proposals.length - kept.length };
    },
    async verify(planId, id) {
      await wait(verifyMs);
      patchProposal(planId, id, (p) => ({ ...p, provenance: { kind: "api", provider: "duffel", checkedAt: MOCK_NOW.toISOString() } }));
      return { verified: true, proposal: entry(planId).proposals.find((p) => p.id === id)! };
    },
    async editorial(planId, id, patch) {
      const e = entry(planId);
      entries.set(planId, { ...e, editorial: { ...e.editorial, [id]: { ...e.editorial[id], ...patch } } });
    },
    async setPrices(planId, id, prices) {
      const { plan } = entry(planId);
      patchProposal(planId, id, (p) => ({
        ...applyCheckedPrices(p, prices, plan.nights),
        provenance: {
          kind: "organiser",
          checkedAt: MOCK_NOW.toISOString(),
          sources: [...(p.provenance.kind === "api" ? [] : p.provenance.sources), ...(prices.sources ?? [])],
          // As the server: where it was seen, now or on an earlier check.
          ...((): { seenOn?: ("google-flights" | "airbnb")[] } => {
            const kept = p.provenance.kind === "organiser" && !p.provenance.forOtherDates ? (p.provenance.seenOn ?? []) : [];
            const seenOn = [...new Set([...kept, ...(prices.seenOn ?? [])])];
            return seenOn.length ? { seenOn } : {};
          })(),
          // As the server: times checked now, earlier, or by the API.
          ...(prices.outbound || (p.provenance.kind !== "claude" && !p.provenance.forOtherDates && (p.provenance.kind === "api" || p.provenance.flightDetails))
            ? { flightDetails: true }
            : {}),
        },
      }));
      return entry(planId).proposals.find((p) => p.id === id)!;
    },
    // "Mirar en…": the same answers as a screenshot, after a few steps.
    async browse(planId, id, kind, onStep) {
      const p = entry(planId).proposals.find((x) => x.id === id)!;
      if (p.review !== "approved") throw new Error("Mira en el navegador solo las propuestas que vais a usar: apruébala primero.");
      const page = kind === "flight" ? "google.com" : "airbnb.es";
      onStep?.({ kind: "read", host: page, url: `https://www.${page}/` });
      await wait(Math.min(tickMs, 400));
      onStep?.({ kind: "note", text: kind === "flight" ? "Elijo el vuelo directo de la mañana." : "Abro un piso entero con sitio para todos." });
      const got = await this.extract(planId, id, kind, []);
      if (got.kind === "flight") {
        // The KLM flight, and four more for the organiser to pick from.
        const shift = (iso: string, h: number) => new Date(Date.parse(iso) + h * 3_600_000).toISOString().replace(".000Z", "+00:00");
        const alt = (h: number, cents: number, carrier: string, n: string, note: string, stops = 0) => ({
          outbound: got.outbound && { ...got.outbound, departAt: shift(got.outbound.departAt, h), arriveAt: shift(got.outbound.arriveAt, h + stops), carrier, flightNumber: `${n}1`, stops },
          inbound: got.inbound && { ...got.inbound, departAt: shift(got.inbound.departAt, -h), arriveAt: shift(got.inbound.arriveAt, -h + stops), carrier, flightNumber: `${n}2`, stops },
          flightCents: cents,
          note,
        });
        const options = [
          { outbound: got.outbound, inbound: got.inbound, flightCents: got.flightCents!, note: "Directo, a buena hora" },
          alt(-3, got.flightCents! - 2400, "Vueling", "VY 81", "El más barato, sale temprano"),
          alt(4, got.flightCents! + 1100, "Iberia", "IB 34", "Directo, por la tarde"),
          alt(2, got.flightCents! - 900, "Transavia", "HV 50", "Con una escala corta", 1),
          alt(6, got.flightCents! + 3800, "Air Europa", "UX 11", "Directo, el más tarde"),
        ];
        return { ...got, options, pageUrl: "https://www.google.com/travel/flights" };
      }
      if (p.stays.some((s) => s.url?.includes("airbnb."))) return { ...got, url: "https://www.airbnb.es/rooms/12345", pageUrl: "https://www.airbnb.es/rooms/12345" };
      // No stay chosen: the search's typical price and three to pick.
      const nights = entry(planId).plan.nights;
      return {
        kind: "stay",
        name: null,
        description: null,
        stayCents: null,
        nights: null,
        url: null,
        pageUrl: "https://www.airbnb.es/s/homes",
        market: {
          medianCents: 142800,
          minCents: 98000,
          maxCents: 231000,
          count: 18,
          picks: [
            { name: "Apartamento con terraza en De Pijp", description: "3 habitaciones · 6 huéspedes", rating: 4.92, url: "https://www.airbnb.es/rooms/12345", stayCents: 151200 },
            { name: "Casa junto al canal en Jordaan", description: "3 habitaciones · 7 huéspedes", rating: 4.88, url: "https://www.airbnb.es/rooms/23456", stayCents: 168000 },
            { name: "Piso amplio en Oost", description: "4 habitaciones · 8 huéspedes", rating: 4.81, url: "https://www.airbnb.es/rooms/34567", stayCents: nights * 17000 },
          ],
        },
      };
    },
    // Reads any screenshot as the same KLM flight or Amsterdam flat.
    async extract(planId, id, kind) {
      await wait(Math.min(tickMs, 400));
      const p = entry(planId).proposals.find((x) => x.id === id)!;
      if (kind === "stay") return { kind, name: "Apartamento con terraza en De Pijp", description: "3 habitaciones · 6 huéspedes", stayCents: 151200, nights: entry(planId).plan.nights };
      const leg = (from: string, to: string, day: string, dep: string, arr: string, n: string) => ({
        from,
        to,
        departAt: `${day}T${dep}:00+01:00`,
        arriveAt: `${day}T${arr}:00+01:00`,
        carrier: "KLM",
        flightNumber: n,
        stops: 0,
      });
      const { plan } = entry(planId);
      return {
        kind,
        outbound: leg(plan.origin, p.place.iata, plan.dateFrom, "11:55", "14:05", "KL1524"),
        inbound: leg(p.place.iata, plan.origin, plan.dateTo, "14:25", "16:30", "KL1525"),
        flightCents: 27200,
      };
    },
    async searchPhotos(query) {
      await wait(Math.min(tickMs, 400));
      return { photos: Array.from({ length: 8 }, (_, i) => mockPhoto(query, i)), errors: [] };
    },
    async publish(planId) {
      published.set(planId, { at: MOCK_NOW.toISOString(), key: publishKey(planId) });
      return { published: entry(planId).proposals.filter((p) => p.review === "approved").length };
    },
    async publishStatus(planId) {
      const last = published.get(planId);
      const approved = entry(planId).proposals.some((p) => p.review === "approved");
      return { publishedAt: last?.at ?? null, changed: last ? last.key !== publishKey(planId) : approved };
    },
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
    async pickWinner(planId, destinationId, opts = {}) {
      const v = voteView(planId);
      if (!v.result) throw new Error("la votación sigue abierta");
      if (!opts.override && !v.result.tiedForFirst.includes(destinationId)) throw new Error("solo se elige entre los empatados");
      const own = destinationId === v.result.voteWinnerId;
      setPlan(planId, { winnerDestinationId: destinationId, decidedNote: opts.override && !own ? opts.note || undefined : undefined });
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
    organiser: async () => organiser,
    async setOrganiserPassword(password) {
      if (password !== null && password.length < 10) throw new Error("Usa al menos 10 caracteres");
      organiser = { ...organiser, enabled: password !== null, setAt: password ? MOCK_NOW.toISOString() : null };
      return organiser;
    },
    dates: async (planId) => datesPage(planId),
    async proposeDates(planId, windows, deadline) {
      const parsed = DateWindows.safeParse(windows);
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Fechas no válidas");
      if (!(participants.get(planId) ?? []).length) throw new Error("elige quién va al viaje (en Personas) antes de proponer fechas");
      const before = datesBy.get(planId);
      datesBy.set(planId, { status: "open", options: parsed.data, deadline, chosenOptionId: null, responses: before?.responses ?? [] });
      const { name } = entry(planId).plan;
      const labels = parsed.data.map((o) => rangeLabel(o.dateFrom, o.dateTo));
      const message = [
        `¿Cuándo nos vamos? (${name})`,
        `Decid qué fechas os vienen bien: ${labels.slice(0, -1).join(", ")} o ${labels.at(-1)}. Para cada una: sí, si hace falta o no.`,
        "",
        `Entrad en ${SITE_URL}/p/${planId}/fechas`,
      ].join("\n");
      return { ...datesPage(planId), message };
    },
    async chooseDates(planId, optionId) {
      const d = datesBy.get(planId);
      const option = d?.options.find((o) => o.id === optionId);
      if (!d || !option) throw new Error("esas fechas no están entre las propuestas");
      datesBy.set(planId, { ...d, status: "closed", chosenOptionId: optionId });
      const e = entry(planId);
      const moved = e.plan.dateFrom !== option.dateFrom || e.plan.dateTo !== option.dateTo;
      const plan = { ...e.plan, dateFrom: option.dateFrom, dateTo: option.dateTo, nights: nightsOf(option) };
      entries.set(planId, { ...e, plan, datesDecided: true, proposals: moved ? e.proposals.map(markForOtherDates) : e.proposals });
      return { ...datesPage(planId), plan };
    },
    leave: async (planId) => leavePage(planId),
    async setLeave(planId, memberId, status) {
      const page = leavePage(planId);
      if (!page.leave) throw new Error("las fechas del viaje aún no están decididas");
      if (!page.leave.people.some((p) => p.id === memberId)) throw new Error("esa persona no va a este viaje");
      const answers = leaveBy.get(planId) ?? new Map();
      answers.set(memberId, { status, dateFrom: page.leave.dateFrom, dateTo: page.leave.dateTo, at: MOCK_NOW.toISOString(), byOrganiser: true });
      leaveBy.set(planId, answers);
      return leavePage(planId);
    },
    async fixDates(planId, window) {
      const e = entry(planId);
      if (!window) {
        entries.set(planId, { ...e, datesDecided: false });
        return entry(planId);
      }
      if (datesBy.get(planId)?.status === "open") throw new Error("Hay una votación de fechas abierta: elige una de sus opciones o quítala primero.");
      const moved = e.plan.dateFrom !== window.dateFrom || e.plan.dateTo !== window.dateTo;
      const plan = { ...e.plan, dateFrom: window.dateFrom, dateTo: window.dateTo, nights: nightsOf(window) };
      entries.set(planId, { ...e, plan, datesDecided: true, proposals: moved ? e.proposals.map(markForOtherDates) : e.proposals });
      return entry(planId);
    },
    async cancelDates(planId) {
      datesBy.delete(planId);
      return datesPage(planId);
    },
    trip: async (planId) => tripView(planId),
    async prepareTrip(planId, home, onStep) {
      const destination = tripView(planId).destination;
      if (!destination) throw new Error("primero decide el destino en Votación");
      if (hosted) {
        if (!hostedAi) throw new Error("Para preparar la guía desde el panel del sitio hace falta una clave de Claude u OpenAI en el sitio.");
        const before = trips.get(planId)?.trip;
        return {
          job: startJob(planId, "guide", () => {
            const trip: TripPage = { ...mockTripPage, destinationId: destination.id, home, toAirport: home ? mockTripPage.toAirport : [], by: "OpenAI", stay: before?.stay ?? { address: "", checkIn: "", checkOut: "" }, tricountUrl: before?.tricountUrl ?? null, preparedAt: MOCK_NOW.toISOString() };
            trips.set(planId, { trip, published: trips.get(planId)?.published ?? false });
            return {};
          }),
        };
      }
      for (const query of [`qué hacer en ${destination.place.city}`, `aeropuerto ${destination.place.iata} al centro`]) {
        await wait(tickMs);
        onStep?.({ kind: "search", query });
      }
      await wait(tickMs);
      const before = trips.get(planId)?.trip;
      // The mocks have one guide, Nápoles's; other destinations borrow it.
      const trip: TripPage = {
        ...mockTripPage,
        destinationId: destination.id,
        home,
        toAirport: home ? mockTripPage.toAirport : [],
        stay: before?.stay ?? { address: "", checkIn: "", checkOut: "" },
        tricountUrl: before?.tricountUrl ?? null,
        preparedAt: MOCK_NOW.toISOString(),
      };
      trips.set(planId, { trip, published: trips.get(planId)?.published ?? false });
      if (home) settings = { ...settings, homeTown: home };
      return trip;
    },
    async saveTrip(planId, trip) {
      const destination = tripView(planId).destination;
      if (!destination) throw new Error("primero decide el destino en Votación");
      const parsed = TripPage.safeParse({ ...trip, destinationId: destination.id });
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "página del viaje no válida");
      trips.set(planId, { trip: parsed.data, published: trips.get(planId)?.published ?? false });
      return tripView(planId);
    },
    async publishTrip(planId, on) {
      const t = trips.get(planId);
      if (on && !tripView(planId).trip) throw new Error("prepara la página del viaje antes de publicarla");
      if (t) trips.set(planId, { ...t, published: on });
      // The whole trip goes, as on the server.
      published.set(planId, { at: MOCK_NOW.toISOString(), key: publishKey(planId) });
      return tripView(planId);
    },
    async exportData(planId) {
      const trips = [...entries.values()].filter((e) => published.has(e.plan.id) && (!planId || e.plan.id === planId));
      if (planId && !trips.length) throw new Error("not found");
      return {
        format: "wanderlot-export",
        version: 1,
        exportedAt: MOCK_NOW.toISOString(),
        settings,
        members: members.map(({ id, name }) => ({ id, name })),
        trips: trips.map((e) => ({ plan: e.plan, destinations: e.proposals.filter((p) => p.review === "approved"), status: e.plan.status })),
      };
    },
  };
}
