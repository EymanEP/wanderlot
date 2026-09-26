// The panel's state. <PanelProvider> loads everything through a backend (the
// local server, or the mocks) and screens read and change it with usePanel().
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { avatarTint, initials, slugify, type GroupSettings, type Plan, type Proposal, type SuggestionView } from "@wanderlot/core";
import type { Editorial } from "@wanderlot/mocks";
import type { Access, MemberAccess, NewPlan, CheckedPrices, PanelBackend, PhotoResults, Review, SearchOptions, Status, VoteView } from "./backend.ts";

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
}

export interface PanelApi {
  state: PanelState;
  now: Date;
  selectPlan: (id: string) => Promise<void>;
  createPlan: (p: NewPlan) => Promise<Plan>;
  savePlan: (p: Plan) => Promise<void>;
  setParticipants: (memberIds: string[]) => Promise<void>;
  startGeneration: (opts: SearchOptions) => void;
  stopGeneration: () => void;
  setReview: (id: string, review: Review) => void;
  verify: (id: string) => Promise<{ verified: boolean; reason?: string }>;
  setEditorial: (id: string, patch: Partial<Editorial>) => void;
  searchPhotos: (query: string) => Promise<PhotoResults>;
  setPrices: (id: string, prices: CheckedPrices) => Promise<void>;
  suggestions: () => Promise<SuggestionView[]>;
  dismissSuggestion: (id: string) => Promise<SuggestionView[]>;
  publish: () => Promise<number>;
  openVote: (deadline: string) => Promise<string>;
  vote: () => Promise<VoteView>;
  closeVote: () => Promise<VoteView>;
  pickWinner: (destinationId: string) => Promise<VoteView>;
  saveSettings: (s: GroupSettings) => Promise<void>;
  refreshMembers: () => Promise<void>;
  addMember: (name: string) => Promise<Person | null>;
  invite: (memberId: string) => Promise<string>;
  closeSessions: (memberId: string) => Promise<void>;
  revoke: (memberId: string) => Promise<void>;
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
};

const Ctx = createContext<PanelApi | null>(null);

export function PanelProvider({ backend, children }: { backend: PanelBackend; children: ReactNode }) {
  const [state, setState] = useState<PanelState>(INITIAL);
  const abort = useRef<AbortController | null>(null);
  const planId = state.plan?.id ?? null;
  const patch = useCallback((fn: (s: PanelState) => Partial<PanelState>) => setState((s) => ({ ...s, ...fn(s) })), []);

  const loadPlan = useCallback(
    async (id: string) => {
      const entry = await backend.plan(id);
      if (!entry) return;
      remember(id);
      patch(() => ({ plan: entry.plan, participants: entry.participants ?? [], proposals: entry.proposals, editorial: editorialOf(entry.editorial), generation: null }));
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

  const api = useMemo<PanelApi>(() => {
    const need = () => {
      if (!planId) throw new Error("No hay plan seleccionado");
      return planId;
    };
    return {
      state,
      now: backend.now(),
      selectPlan: loadPlan,
      async createPlan(p) {
        const plan = await backend.createPlan(p);
        patch((s) => ({ plans: [plan, ...s.plans] }));
        await loadPlan(plan.id);
        return plan;
      },
      async savePlan(p) {
        const plan = await backend.savePlan(p);
        patch((s) => ({ plan, plans: s.plans.map((x) => (x.id === plan.id ? plan : x)) }));
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
          generation: { running: true, received: 0, requested: opts.count, stopped: false, error: null },
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
          )
          .then(
            () => patch((s) => ({ generation: s.generation && { ...s.generation, running: false } })),
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
      async setPrices(id, prices) {
        const updated = await backend.setPrices(need(), id, prices);
        patch((s) => ({ proposals: s.proposals.map((p) => (p.id === id ? updated : p)) }));
      },
      async publish() {
        return (await backend.publish(need())).published;
      },
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
      async pickWinner(destinationId) {
        const pid = need();
        const v = await backend.pickWinner(pid, destinationId);
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
    };
  }, [state, backend, planId, patch, loadPlan, loadMembers, syncPlan]);

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

// --- derived views ---------------------------------------------------------

export function useCounts() {
  const { proposals } = usePanel().state;
  const by = (r: Review) => proposals.filter((p) => p.review === r).length;
  return { all: proposals.length, pending: by("pending"), approved: by("approved"), discarded: by("discarded") };
}

export function useApproved(): Proposal[] {
  return usePanel().state.proposals.filter((p) => p.review === "approved");
}
