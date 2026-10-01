// The panel's state. <PanelProvider> loads everything through a backend (the
// local server, or the mocks) and screens read and change it with usePanel().
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { avatarTint, initials, slugify, type GroupSettings, type LeaveStatus, type Plan, type Proposal, type SuggestionView, type TripPage } from "@wanderlot/core";
import type { Editorial } from "@wanderlot/mocks";
import type { AiId, AiView, Browsed, BrowserView, LeavePage, PriceCheck, ManualProposal, PanelJob, PriceSave, Access, MemberAccess, NewPlan, CheckedPrices, PanelBackend, DatesPage, DateWindow, OrganiserAccess, TripView, Extracted, PhotoResults, PublishStatus, Review, ScreenshotImage, TripSummary, SearchOptions, SearchStep, Status, VoteView } from "./backend.ts";

export type { Review } from "./backend.ts";

export interface Person {
  id: string;
  name: string;
  initials: string;
  tint: "accent" | "sand" | "lilac" | "mint" | "sky" | "rose";
}

export interface GenerationState {
  running: boolean;
  received: number;
  requested: number;
  // Stopped by the organiser, rather than finished.
  stopped: boolean;
  error: string | null;
  // When it started (ms), and what research has done so far, oldest first.
  source: SearchOptions["source"];
  startedAt: number;
  steps: SearchStep[];
  // Researching one friend's idea rather than a full search.
  idea: string | null;
}

// Work the AI does for a while (preparing the trip's guide, reading Google
// Flights or Airbnb in the browser): kept here rather than in a screen, so it
// carries on while the organiser moves around the panel, and its result waits
// for them.
export interface Task {
  id: string;
  planId: string;
  // prices: "Comprobar precios", both sites in a row, saved when read whole.
  kind: "guide" | "browse" | "prices";
  // browse and prices: which proposal, and which site (prices: the one
  // being read now).
  proposalId?: string;
  site?: "flight" | "stay";
  city: string;
  startedAt: number;
  steps: SearchStep[];
  status: "running" | "done" | "failed";
  error?: string;
  result?: TripPage | Browsed | PriceCheck;
  // Its result was picked up (by the price dialog, or El viaje).
  taken?: boolean;
}

export interface PanelState {
  loading: boolean;
  error: string | null;
  status: Status | null;
  settings: GroupSettings | null;
  plans: Plan[];
  plan: Plan | null;
  // Member ids on the selected trip.
  participants: string[];
  proposals: Proposal[];
  editorial: Record<string, Editorial>;
  generation: GenerationState | null;
  verifying: string[];
  members: Person[];
  access: Access[];
  // A search or guide running in the background (the panel at /admin), or
  // how the last one ended.
  job: PanelJob | null;
  // Cuándo is done for the selected trip.
  datesDecided: boolean;
  tasks: Task[];
}

export interface PanelApi {
  state: PanelState;
  // What each screen last loaded (see useLoad), kept between visits.
  cache: Map<string, unknown>;
  now: Date;
  selectPlan: (id: string) => Promise<void>;
  createPlan: (p: NewPlan) => Promise<Plan>;
  trips: () => Promise<TripSummary[]>;
  // Here and on the site; if it was the open one, the panel moves to another.
  deletePlan: (id: string) => Promise<void>;
  savePlan: (p: Plan) => Promise<void>;
  setParticipants: (memberIds: string[]) => Promise<void>;
  startGeneration: (opts: SearchOptions) => void;
  stopGeneration: () => void;
  setReview: (id: string, review: Review) => void;
  // Deletes every proposal not approved; resolves to how many went.
  clearUnapproved: () => Promise<number>;
  verify: (id: string) => Promise<{ verified: boolean; reason?: string }>;
  setEditorial: (id: string, patch: Partial<Editorial>) => void;
  searchPhotos: (query: string) => Promise<PhotoResults>;
  setPrices: (id: string, prices: PriceSave) => Promise<void>;
  // Starts reading Google Flights or Airbnb for a finalist; see Task.
  browse: (id: string, kind: "flight" | "stay") => void;
  // "Comprobar precios": both sites for a finalist, saved when read whole;
  // otherwise its readings wait for the price dialog. See Task.
  checkPrices: (id: string) => void;
  // A task's result was used, or its outcome seen: it can go.
  takeTask: (id: string) => void;
  browsers: () => Promise<BrowserView>;
  chooseBrowser: (id: string) => Promise<BrowserView>;
  addProposal: (p: ManualProposal) => Promise<Proposal>;
  ai: () => Promise<AiView>;
  chooseAi: (id: AiId) => Promise<AiView>;
  extract: (id: string, kind: "flight" | "stay", images: ScreenshotImage[]) => Promise<Extracted>;
  suggestions: () => Promise<SuggestionView[]>;
  dismissSuggestion: (id: string) => Promise<SuggestionView[]>;
  publish: () => Promise<number>;
  publishStatus: () => Promise<PublishStatus>;
  openVote: (deadline: string) => Promise<string>;
  vote: () => Promise<VoteView>;
  closeVote: () => Promise<VoteView>;
  pickWinner: (destinationId: string, opts?: { override?: boolean; note?: string }) => Promise<VoteView>;
  saveSettings: (s: GroupSettings) => Promise<void>;
  refreshMembers: () => Promise<void>;
  addMember: (name: string) => Promise<Person | null>;
  invite: (memberId: string) => Promise<string>;
  closeSessions: (memberId: string) => Promise<void>;
  revoke: (memberId: string) => Promise<void>;
  exportData: (planId?: string) => Promise<unknown>;
  dates: () => Promise<DatesPage>;
  proposeDates: (windows: DateWindow[], deadline: string | null) => Promise<DatesPage & { message: string }>;
  chooseDates: (optionId: string) => Promise<DatesPage>;
  cancelDates: () => Promise<DatesPage>;
  fixDates: (window: DateWindow | null) => Promise<void>;
  // Days off: who has them, and the organiser's say on someone's behalf.
  leave: () => Promise<LeavePage>;
  setLeave: (memberId: string, status: LeaveStatus) => Promise<LeavePage>;
  organiser: () => Promise<OrganiserAccess>;
  setOrganiserPassword: (password: string | null) => Promise<OrganiserAccess>;
  trip: () => Promise<TripView>;
  // Starts preparing the guide: a task here, or on the site a background
  // job (see PanelJob). Resolves once started.
  prepareTrip: (home: string) => Promise<void>;
  // Cancels a running job, or clears how the last one ended.
  clearJob: () => Promise<void>;
  saveTrip: (trip: TripPage) => Promise<TripView>;
  publishTrip: (published: boolean) => Promise<TripView>;
}

const EMPTY_EDITORIAL: Editorial = { pros: [], cons: [], weather: "", inVote: true };

function editorialOf(e: Record<string, Partial<Editorial>>): Record<string, Editorial> {
  return Object.fromEntries(Object.entries(e).map(([k, v]) => [k, { ...EMPTY_EDITORIAL, ...v }]));
}

function person(m: { id: string; name: string }): Person {
  return { id: m.id, name: m.name, initials: initials(m.name), tint: avatarTint(m.id) };
}

function splitMembers(list: MemberAccess[]) {
  return {
    members: list.map(person),
    access: list.map(({ id, invite, inviteUrl, passkeys, pin, sessions }): Access => ({ memberId: id, invite, inviteUrl, passkeys, pin, sessions })),
  };
}

// The organiser's last chosen plan, per browser.
const PLAN_KEY = "wanderlot:panel-plan";
const remembered = () => {
  try {
    return localStorage.getItem(PLAN_KEY);
  } catch {
    return null;
  }
};
const remember = (id: string) => {
  try {
    localStorage.setItem(PLAN_KEY, id);
  } catch {}
};

const INITIAL: PanelState = {
  loading: true,
  error: null,
  status: null,
  settings: null,
  plans: [],
  plan: null,
  participants: [],
  proposals: [],
  editorial: {},
  generation: null,
  verifying: [],
  members: [],
  access: [],
  job: null,
  datesDecided: false,
  tasks: [],
};

const Ctx = createContext<PanelApi | null>(null);

// How often a background job is checked on while it runs.
export function PanelProvider({ backend, children, jobPollMs = 8000 }: { backend: PanelBackend; children: ReactNode; jobPollMs?: number }) {
  const [state, setState] = useState<PanelState>(INITIAL);
  const abort = useRef<AbortController | null>(null);
  const planId = state.plan?.id ?? null;
  const patch = useCallback((fn: (s: PanelState) => Partial<PanelState>) => setState((s) => ({ ...s, ...fn(s) })), []);
  const taskSeq = useRef(0);
  const cache = useRef(new Map<string, unknown>()).current;
  const patchTask = useCallback(
    (id: string, fn: (t: Task) => Partial<Task>) => patch((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...fn(t) } : t)) })),
    [patch],
  );
  // Runs a task: steps as they come, then its result or error.
  const runTask = useCallback(
    (
      task: Omit<Task, "id" | "startedAt" | "steps" | "status">,
      work: (onStep: (s: SearchStep) => void, update: (change: Partial<Task>) => void) => Promise<TripPage | Browsed | PriceCheck>,
    ) => {
      const id = `t${++taskSeq.current}`;
      // One of each at a time: a new one replaces what the last left behind.
      patch((s) => ({
        tasks: [
          ...s.tasks.filter((t) => !(t.planId === task.planId && t.kind === task.kind && t.proposalId === task.proposalId && t.site === task.site)),
          { ...task, id, startedAt: Date.now(), steps: [], status: "running" },
        ],
      }));
      work(
        (step) => patchTask(id, (t) => ({ steps: [...t.steps.slice(-99), step] })),
        (change) => patchTask(id, () => change),
      ).then(
        (result) => patchTask(id, () => ({ status: "done", result })),
        (e: Error) => patchTask(id, () => ({ status: "failed", error: e.message })),
      );
    },
    [patch, patchTask],
  );

  const loadPlan = useCallback(
    async (id: string) => {
      const entry = await backend.plan(id);
      if (!entry) return;
      remember(id);
      patch(() => ({ plan: entry.plan, participants: entry.participants ?? [], proposals: entry.proposals, editorial: editorialOf(entry.editorial), generation: null, job: entry.job ?? null, datesDecided: !!entry.datesDecided }));
    },
    [backend, patch],
  );

  // After a change on the site: the plan and its entry in the switcher.
  const syncPlan = useCallback(
    async (id: string) => {
      const entry = await backend.plan(id);
      if (!entry) return;
      patch((s) => ({ plan: entry.plan, plans: s.plans.map((p) => (p.id === id ? entry.plan : p)) }));
    },
    [backend, patch],
  );

  const loadMembers = useCallback(async () => {
    try {
      const list = await backend.members();
      patch(() => splitMembers(list));
    } catch {
      // The site may be unreachable; Personas says so.
    }
  }, [backend, patch]);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const [status, plans] = await Promise.all([backend.status(), backend.plans()]);
        const settings = await backend.settings().catch(() => null);
        if (!live) return;
        patch(() => ({ status, plans, settings }));
        const first = plans.find((p) => p.id === remembered()) ?? plans.find((p) => p.status !== "closed") ?? plans[0];
        if (first) await loadPlan(first.id);
        await loadMembers();
        if (live) patch(() => ({ loading: false }));
      } catch (e) {
        if (live) patch(() => ({ loading: false, error: (e as Error).message }));
      }
    })();
    return () => {
      live = false;
      abort.current?.abort();
    };
  }, [backend, patch, loadPlan, loadMembers]);

  // A background job (a search from the panel at /admin): checked while it
  // runs, here or on another device; once it ends, the trip is read again
  // for what it added.
  const jobRunning = state.job?.status === "running";
  useEffect(() => {
    if (!planId || !jobRunning) return;
    let live = true;
    const t = setInterval(() => {
      backend.job(planId).then(
        (job) => {
          if (!live) return;
          if (job?.status === "running") patch(() => ({ job }));
          else void loadPlan(planId);
        },
        () => {},
      );
    }, jobPollMs);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [backend, planId, jobRunning, jobPollMs, loadPlan, patch]);

  const api = useMemo<PanelApi>(() => {
    const need = () => {
      if (!planId) throw new Error("No hay plan seleccionado");
      return planId;
    };
    return {
      state,
      cache,
      now: backend.now(),
      selectPlan: loadPlan,
      async createPlan(p) {
        const plan = await backend.createPlan(p);
        patch((s) => ({ plans: [plan, ...s.plans] }));
        await loadPlan(plan.id);
        return plan;
      },
      trips: () => backend.trips(),
      async deletePlan(id) {
        await backend.deletePlan(id);
        const rest = state.plans.filter((p) => p.id !== id);
        patch(() => ({ plans: rest }));
        if (planId !== id) return;
        const next = rest.find((p) => p.status !== "closed") ?? rest[0];
        if (next) await loadPlan(next.id);
        else patch(() => ({ plan: null, participants: [], proposals: [], editorial: {}, generation: null }));
      },
      async savePlan(p) {
        const plan = await backend.savePlan(p);
        // Editing another trip from Viajes leaves the open one as it is.
        patch((s) => ({ plan: s.plan?.id === plan.id ? plan : s.plan, plans: s.plans.map((x) => (x.id === plan.id ? plan : x)) }));
      },
      async setParticipants(ids) {
        const entry = await backend.setParticipants(need(), ids);
        patch((s) => ({
          participants: entry.participants ?? ids,
          plan: entry.plan,
          plans: s.plans.map((p) => (p.id === entry.plan.id ? entry.plan : p)),
        }));
      },
      startGeneration(opts) {
        const id = need();
        abort.current?.abort();
        const ctl = new AbortController();
        abort.current = ctl;
        patch((s) => ({
          generation: { running: true, received: 0, requested: opts.count, stopped: false, error: null, source: opts.source, startedAt: Date.now(), steps: [], idea: opts.idea ?? null },
        }));
        backend
          .generate(
            id,
            opts,
            (p) =>
              patch((s) => ({
                proposals: [...s.proposals.filter((x) => x.id !== p.id), p],
                generation: s.generation ? { ...s.generation, received: s.generation.received + 1 } : s.generation,
              })),
            ctl.signal,
            (step) => patch((s) => ({ generation: s.generation && { ...s.generation, steps: [...s.generation.steps.slice(-199), step] } })),
          )
          .then(
            // On the site: the search runs in the background, followed below.
            (job) => patch((s) => (job ? { job, generation: null } : { generation: s.generation && { ...s.generation, running: false } })),
            (e: Error) =>
              patch((s) => ({
                generation: s.generation && { ...s.generation, running: false, error: e.name === "AbortError" ? null : e.message },
              })),
          );
      },
      stopGeneration() {
        abort.current?.abort();
        patch((s) => ({ generation: s.generation && { ...s.generation, running: false, stopped: true } }));
      },
      setReview(id, review) {
        const pid = need();
        patch((s) => ({ proposals: s.proposals.map((p) => (p.id === id ? { ...p, review } : p)) }));
        backend.review(pid, id, review).catch(() => loadPlan(pid));
      },
      async verify(id) {
        const pid = need();
        patch((s) => ({ verifying: [...s.verifying, id] }));
        try {
          const r = await backend.verify(pid, id);
          if (r.verified) patch((s) => ({ proposals: s.proposals.map((p) => (p.id === id ? r.proposal : p)) }));
          return r.verified ? { verified: true } : { verified: false, reason: r.reason };
        } catch (e) {
          return { verified: false, reason: (e as Error).message };
        } finally {
          patch((s) => ({ verifying: s.verifying.filter((x) => x !== id) }));
        }
      },
      setEditorial(id, change) {
        const pid = need();
        patch((s) => ({ editorial: { ...s.editorial, [id]: { ...EMPTY_EDITORIAL, ...s.editorial[id], ...change } } }));
        backend.editorial(pid, id, change).catch(() => loadPlan(pid));
      },
      searchPhotos: (q) => backend.searchPhotos(q),
      suggestions: () => backend.suggestions(need()),
      dismissSuggestion: (id) => backend.setSuggestion(need(), id, "dismissed"),
      async clearUnapproved() {
        const pid = need();
        const { removed } = await backend.clearUnapproved(pid);
        patch((s) => ({ proposals: s.proposals.filter((p) => p.review === "approved") }));
        return removed;
      },
      extract: (id, kind, images) => backend.extract(need(), id, kind, images),
      browse(id, kind) {
        const pid = need();
        const p = state.proposals.find((x) => x.id === id);
        if (state.tasks.some((t) => t.status === "running" && t.kind === "browse" && t.planId === pid && t.proposalId === id && t.site === kind)) return;
        runTask({ planId: pid, kind: "browse", proposalId: id, site: kind, city: p?.place.city ?? "" }, (onStep) => backend.browse(pid, id, kind, onStep));
      },
      checkPrices(id) {
        const pid = need();
        const p = state.proposals.find((x) => x.id === id);
        if (state.tasks.some((t) => t.status === "running" && t.kind === "prices" && t.planId === pid && t.proposalId === id)) return;
        runTask({ planId: pid, kind: "prices", proposalId: id, site: "flight", city: p?.place.city ?? "" }, async (onStep, update) => {
          const out = await backend.checkPrices(pid, id, onStep, (site) => update({ site }));
          if (out.saved) {
            const saved = out.saved;
            patch((s) => ({ proposals: s.proposals.map((x) => (x.id === id ? saved : x)) }));
          } else {
            // Incomplete: each reading waits for the price dialog, as if
            // read with "Mirar en…".
            const now = Date.now();
            patch((s) => ({
              tasks: [
                ...s.tasks.filter((t) => !(t.kind === "browse" && t.planId === pid && t.proposalId === id)),
                ...(["flight", "stay"] as const).map((site): Task => ({ id: `t${++taskSeq.current}`, planId: pid, kind: "browse", proposalId: id, site, city: p?.place.city ?? "", startedAt: now, steps: [], status: "done", result: out.readings[site] })),
              ],
            }));
          }
          return out;
        });
      },
      takeTask: (id) => patch((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),
      browsers: () => backend.browsers(),
      chooseBrowser: async (id) => {
        const view = await backend.chooseBrowser(id);
        patch((s) => ({ status: s.status ? { ...s.status, browser: view.options.find((o) => o.id === view.active)?.name ?? s.status.browser } : s.status }));
        return view;
      },
      async addProposal(p) {
        const added = await backend.addProposal(need(), p);
        patch((s) => ({ proposals: [...s.proposals, added], editorial: { ...s.editorial, [added.id]: { ...EMPTY_EDITORIAL, photoQueries: [added.place.city] } } }));
        return added;
      },
      ai: () => backend.ai(),
      async chooseAi(id) {
        const view = await backend.chooseAi(id);
        const status = await backend.status();
        patch(() => ({ status }));
        return view;
      },
      async setPrices(id, prices) {
        const updated = await backend.setPrices(need(), id, prices);
        patch((s) => ({ proposals: s.proposals.map((p) => (p.id === id ? updated : p)) }));
      },
      async publish() {
        return (await backend.publish(need())).published;
      },
      publishStatus: () => backend.publishStatus(need()),
      async openVote(deadline) {
        const pid = need();
        const { message } = await backend.openVote(pid, deadline);
        await loadPlan(pid);
        await loadMembers();
        return message;
      },
      vote: () => backend.vote(need()),
      async closeVote() {
        const pid = need();
        const v = await backend.closeVote(pid);
        await syncPlan(pid);
        return v;
      },
      async pickWinner(destinationId, opts) {
        const pid = need();
        const v = await backend.pickWinner(pid, destinationId, opts);
        await syncPlan(pid);
        return v;
      },
      refreshMembers: loadMembers,
      async saveSettings(s) {
        const settings = await backend.saveSettings(s);
        patch(() => ({ settings }));
      },
      async addMember(name) {
        const id = slugify(name);
        if (!id || state.members.some((m) => m.id === id)) return null;
        await backend.putMembers([{ id, name: name.trim() }]);
        await loadMembers();
        return person({ id, name: name.trim() });
      },
      async invite(memberId) {
        const { url } = await backend.invite(memberId);
        await loadMembers();
        return url;
      },
      async closeSessions(memberId) {
        await backend.closeSessions(memberId);
        await loadMembers();
      },
      async revoke(memberId) {
        await backend.revoke(memberId);
        await loadMembers();
      },
      exportData: (id) => backend.exportData(id),
      dates: () => backend.dates(need()),
      leave: () => backend.leave(need()),
      setLeave: (memberId, status) => backend.setLeave(need(), memberId, status),
      async proposeDates(windows, deadline) {
        const pid = need();
        const page = await backend.proposeDates(pid, windows, deadline);
        await loadMembers();
        return page;
      },
      async chooseDates(optionId) {
        const pid = need();
        const page = await backend.chooseDates(pid, optionId);
        // New dates: the plan and its flagged prices.
        await loadPlan(pid);
        patch((s) => ({ plans: s.plans.map((x) => (x.id === pid ? page.plan : x)) }));
        return page;
      },
      cancelDates: () => backend.cancelDates(need()),
      async fixDates(window) {
        const entry = await backend.fixDates(need(), window);
        patch((s) => ({
          plan: entry.plan,
          plans: s.plans.map((x) => (x.id === entry.plan.id ? entry.plan : x)),
          proposals: entry.proposals,
          datesDecided: !!entry.datesDecided,
        }));
      },
      organiser: () => backend.organiser(),
      setOrganiserPassword: (password) => backend.setOrganiserPassword(password),
      trip: () => backend.trip(need()),
      async prepareTrip(home) {
        const pid = need();
        const city = state.proposals.find((p) => p.id === state.plan?.winnerDestinationId)?.place.city ?? "";
        // The server keeps the home town in the group's settings.
        if (home) patch((s) => ({ settings: s.settings ? { ...s.settings, homeTown: home } : s.settings }));
        // On the site it's a background job, answered at once.
        if (state.status?.hosted) {
          const r = await backend.prepareTrip(pid, home);
          if ("job" in r) patch(() => ({ job: r.job }));
          return;
        }
        runTask({ planId: pid, kind: "guide", city }, async (onStep) => {
          const r = await backend.prepareTrip(pid, home, onStep);
          if ("job" in r) throw new Error("El panel del sitio prepara la guía en segundo plano");
          return r;
        });
      },
      async clearJob() {
        await backend.clearJob(need());
        patch(() => ({ job: null }));
      },
      saveTrip: (trip) => backend.saveTrip(need(), trip),
      publishTrip: (published) => backend.publishTrip(need(), published),
    };
  }, [state, cache, backend, planId, patch, loadPlan, loadMembers, syncPlan, runTask]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function usePanel(): PanelApi {
  const api = useContext(Ctx);
  if (!api) throw new Error("usePanel needs a <PanelProvider>");
  return api;
}

// For screens that only render with a plan selected (see RequirePlan).
export function usePlan(): Plan {
  const plan = usePanel().state.plan;
  if (!plan) throw new Error("usePlan needs a selected plan");
  return plan;
}

// A screen's data, loaded through the panel: shown at once from the last
// visit while it's read again, so moving around the panel doesn't flash
// empty screens. `key` names the data (and its trip); `set` keeps a change.
export function useLoad<T>(key: string, load: () => Promise<T>) {
  const { cache } = usePanel();
  const [data, setData] = useState<T | null>(() => (cache.get(key) as T | undefined) ?? null);
  const [error, setError] = useState<string | null>(null);
  const current = useRef({ key, load });
  current.current = { key, load };
  const reload = useCallback(async () => {
    const asked = current.current.key;
    try {
      const v = await current.current.load();
      cache.set(asked, v);
      if (current.current.key === asked) {
        setData(v);
        setError(null);
      }
    } catch (e) {
      if (current.current.key === asked) setError((e as Error).message);
    }
  }, [cache]);
  useEffect(() => {
    setData((cache.get(key) as T | undefined) ?? null);
    setError(null);
    void reload();
  }, [key, cache, reload]);
  const set = useCallback(
    (v: T) => {
      cache.set(current.current.key, v);
      setData(v);
    },
    [cache],
  );
  return { data, error, reload, set };
}

// --- derived views ---------------------------------------------------------

export function useCounts() {
  const { proposals } = usePanel().state;
  const by = (r: Review) => proposals.filter((p) => p.review === r).length;
  return { all: proposals.length, pending: by("pending"), approved: by("approved"), discarded: by("discarded") };
}

export function useApproved(): Proposal[] {
  return usePanel().state.proposals.filter((p) => p.review === "approved");
}
