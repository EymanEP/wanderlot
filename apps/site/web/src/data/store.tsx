// What the screens read and change. <SourceProvider> picks where data comes
// from (the real API or the mocks); <PlanProvider> loads one plan through it
// and hands screens a ready view with useSite().
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { avatarTint, initials, type CommentView, type Destination, type Plan, type PlanSummary, type TallyResult } from "@wanderlot/core";
import { EmptyState, Main, Skeleton, buttonClasses } from "@wanderlot/ui";
import type { Results, SiteSource } from "./source.ts";

// A person as the screens draw them.
export interface Person {
  id: string;
  name: string;
  initials: string;
  tint: "accent" | "sand" | "lilac" | "mint" | "sky" | "rose";
}

export function person(m: { id: string; name: string }, meId?: string): Person {
  return { id: m.id, name: m.name, initials: initials(m.name), tint: m.id === meId ? "accent" : avatarTint(m.id) };
}

// --- the source --------------------------------------------------------------

const SourceCtx = createContext<SiteSource | null>(null);

export function SourceProvider({ source, children }: { source: SiteSource; children: ReactNode }) {
  return <SourceCtx.Provider value={source}>{children}</SourceCtx.Provider>;
}

export function useSource(): SiteSource {
  const s = useContext(SourceCtx);
  if (!s) throw new Error("useSource needs a <SourceProvider>");
  return s;
}

// Every plan, for the footer and for choosing where "/" goes.
export function usePlans(): PlanSummary[] | null {
  const source = useSource();
  const [plans, setPlans] = useState<PlanSummary[] | null>(null);
  useEffect(() => {
    let live = true;
    source.plans().then(
      (p) => live && setPlans(p),
      () => live && setPlans([]),
    );
    return () => {
      live = false;
    };
  }, [source]);
  return plans;
}

// The plan "/" should open: the one being voted on, else the newest.
export function currentPlan(plans: PlanSummary[]): PlanSummary | undefined {
  return plans.find((p) => p.status === "voting") ?? plans[0];
}

// --- one plan ----------------------------------------------------------------

export interface SiteApi {
  now: Date;
  plan: Plan;
  otherPlans: PlanSummary[];
  destinations: Destination[];
  members: Person[];
  me: Person;
  // Who has voted, never what (SPEC §4).
  voted: Set<string>;
  myRanking: string[];
  myBallot: { ranking: string[]; updatedAt: string } | null;
  closed: boolean;
  // Only once closed.
  result: TallyResult | null;
  closedBallots: Results["ballots"] | null;
  comments: CommentView[];
  liked: string[];
  saved: string[];
  saveRanking: (ranking: string[]) => Promise<void>;
  addComment: (destinationId: string, body: string, parentId?: string) => Promise<void>;
  toggleLike: (id: string) => void;
  toggleSave: (id: string) => void;
}

const PlanCtx = createContext<SiteApi | null>(null);

// Bookmarks are a per-device convenience, kept in the browser.
const SAVED_KEY = "wanderlot:saved";
function readSaved(): string[] {
  try {
    return JSON.parse(localStorage.getItem(SAVED_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}
function writeSaved(ids: string[]) {
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(ids));
  } catch {}
}

interface Loaded {
  plans: PlanSummary[];
  view: NonNullable<Awaited<ReturnType<SiteSource["plan"]>>>;
  results: Results | null;
  comments: CommentView[];
}

export function PlanProvider({ planId, children }: { planId: string; children: ReactNode }) {
  const source = useSource();
  const [data, setData] = useState<Loaded | null | "missing" | Error>(null);
  const [saved, setSaved] = useState<string[]>(readSaved);

  const load = useCallback(async () => {
    const view = await source.plan(planId);
    if (!view) return "missing" as const;
    const [plans, comments, results] = await Promise.all([
      source.plans(),
      source.comments(planId),
      view.plan.status === "closed" ? source.results(planId) : Promise.resolve(null),
    ]);
    return { view, plans, comments, results };
  }, [source, planId]);

  useEffect(() => {
    let live = true;
    setData(null);
    load().then(
      (d) => live && setData(d),
      (e: Error) => live && setData(e),
    );
    return () => {
      live = false;
    };
  }, [load]);

  const api = useMemo<SiteApi | null>(() => {
    if (!data || data === "missing" || data instanceof Error) return null;
    const { view, plans, comments, results } = data;
    const me = person(view.me, view.me.id);
    const closed = view.plan.status === "closed";
    const patchComments = (fn: (cs: CommentView[]) => CommentView[]) => setData((d) => (d && typeof d === "object" && !(d instanceof Error) ? { ...d, comments: fn(d.comments) } : d));
    return {
      now: source.now(),
      plan: view.plan,
      otherPlans: plans.filter((p) => p.id !== view.plan.id),
      destinations: view.destinations,
      members: view.participation.map((m) => person(m, view.me.id)),
      me,
      voted: new Set(view.participation.filter((p) => p.voted).map((p) => p.id)),
      myRanking: view.myBallot?.ranking ?? [],
      myBallot: view.myBallot,
      closed,
      result: results,
      closedBallots: results?.ballots ?? null,
      comments,
      liked: comments.filter((c) => c.likedByMe).map((c) => c.id),
      saved,
      async saveRanking(ranking) {
        await source.saveBallot(view.plan.id, ranking);
        // The vote may have just closed with this ballot: reload everything.
        setData(await load());
      },
      async addComment(destinationId, body, parentId) {
        const c = await source.addComment(view.plan.id, destinationId, body, parentId);
        patchComments((cs) => [c, ...cs]);
      },
      toggleLike(id) {
        const current = comments.find((c) => c.id === id);
        if (!current) return;
        const on = !current.likedByMe;
        patchComments((cs) => cs.map((c) => (c.id === id ? { ...c, likedByMe: on, likes: c.likes + (on ? 1 : -1) } : c)));
        source.like(view.plan.id, id, on).then(
          (r) => patchComments((cs) => cs.map((c) => (c.id === id ? { ...c, ...r } : c))),
          () => patchComments((cs) => cs.map((c) => (c.id === id ? current : c))),
        );
      },
      toggleSave(id) {
        setSaved((s) => {
          const next = s.includes(id) ? s.filter((x) => x !== id) : [...s, id];
          writeSaved(next);
          return next;
        });
      },
    };
  }, [data, saved, source, load]);

  if (data === null) {
    return (
      <Main aria-busy="true">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </Main>
    );
  }
  if (data === "missing") {
    return (
      <Main>
        <EmptyState title="Este plan no existe" action={<a href="/" className={buttonClasses({ variant: "primary" })}>Ir al plan actual</a>}>
          Puede que el enlace esté mal o que el plan aún no se haya publicado.
        </EmptyState>
      </Main>
    );
  }
  if (data instanceof Error) {
    return (
      <Main>
        <EmptyState title="No se pudo cargar el plan">{data.message}</EmptyState>
      </Main>
    );
  }
  return <PlanCtx.Provider value={api}>{children}</PlanCtx.Provider>;
}

export function useSite(): SiteApi {
  const api = useContext(PlanCtx);
  if (!api) throw new Error("useSite needs a <PlanProvider>");
  return api;
}
