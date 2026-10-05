import { createContext, useContext, useLayoutEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { Activity } from "./Activity.tsx";
import { copy, decidesPlaceFirst, rangeLabel } from "@wanderlot/core";
import { Brand, CheckIcon, ExternalIcon, Page, PageTransition, Select, StatusDot, TopBar, chipClasses, cn, useCopy, useToast } from "@wanderlot/ui";
import { usePanel } from "../data/store.tsx";
import { signOutHosted } from "./HostedGate.tsx";

const COPY = copy({
  es: {
    trips: "Viajes",
    people: "Personas",
    settings: "Ajustes",
    generate: "Generar",
    review: "Revisar",
    compare: "Comparativa",
    vote: "Votación",
    viewSite: "Ver sitio",
    newTrip: "+ Nuevo viaje",
    trip: "Viaje",
    when: "Cuándo",
    where: "Dónde",
    whereWhen: "Dónde y cuándo",
    theTrip: "El viaje",
    open: "abierta",
    closed: "cerrada",
    persons: (n: number): string => `${n} ${n === 1 ? "persona" : "personas"}`,
    tripSteps: "Pasos del viaje",
    later: "Cuando el destino esté decidido",
    noAiHosted: "sin IA: busca desde tu ordenador",
    readsShots: (name: string) => `${name}: lee capturas`,
    siteOffline: "sitio sin conexión",
    claudeOn: "claude conectado",
    anthropicApi: "API de Anthropic",
    noAi: "sin IA",
    outdated: (url: string) =>
      `Tu sitio (${url}) tiene una versión anterior al panel: las ideas del grupo, los PIN y otras novedades no funcionarán hasta que lo actualices con `,
    panel: "Panel",
    localPanel: "Panel local",
    signOut: "Salir",
  },
  en: {
    trips: "Trips",
    people: "People",
    settings: "Settings",
    generate: "Generate",
    review: "Review",
    compare: "Compare",
    vote: "Vote",
    viewSite: "View site",
    newTrip: "+ New trip",
    trip: "Trip",
    when: "When",
    where: "Where",
    whereWhen: "Where and when",
    theTrip: "The trip",
    open: "open",
    closed: "closed",
    persons: (n: number): string => `${n} ${n === 1 ? "person" : "people"}`,
    tripSteps: "Trip steps",
    later: "Once the destination is decided",
    noAiHosted: "no AI: search from your computer",
    readsShots: (name: string) => `${name}: reads screenshots`,
    siteOffline: "site offline",
    claudeOn: "claude connected",
    anthropicApi: "Anthropic API",
    noAi: "no AI",
    outdated: (url: string) =>
      `Your site (${url}) is running an older version than the panel: the group's ideas, PINs and other new features won't work until you update it with `,
    panel: "Panel",
    localPanel: "Local panel",
    signOut: "Sign out",
  },
});

// The preview build points "Ver sitio" at the site preview; otherwise the
// site's own address comes from the panel's status.
const PREVIEW_SITE_URL = import.meta.env.VITE_SITE_URL as string | undefined;

// The whole group: every trip, and the people.
const NAV = [
  { to: "/", label: "trips" },
  { to: "/personas", label: "people" },
  { to: "/ajustes", label: "settings" },
] as const;

// Dónde, step by step: find, review, compare, vote.
const DONDE = [
  { to: "/generar", label: "generate" },
  { to: "/revisar", label: "review" },
  { to: "/comparativa", label: "compare" },
  { to: "/votacion", label: "vote" },
] as const;

export function PanelNav({ className }: { className?: string }) {
  const t = useCopy(COPY);
  const { state } = usePanel();
  const siteUrl = PREVIEW_SITE_URL ?? state.status?.site.url ?? "/";
  return (
    <nav aria-label="Panel" className={cn("flex items-center gap-1.5", className)}>
      {NAV.map((n) => (
        <NavLink key={n.to} to={n.to} end={n.to === "/"} className={({ isActive }) => chipClasses("nav", isActive)}>
          {t[n.label]}
        </NavLink>
      ))}
      <a href={siteUrl} target="_blank" rel="noreferrer" className={chipClasses("nav", false)}>
        {t.viewSite}
        <ExternalIcon size={14} />
      </a>
    </nav>
  );
}

export interface PanelShellProps {
  // The page's main action, if it has one: in the trip bar on a trip's
  // pages, in the top bar otherwise.
  end?: ReactNode;
  // A page about one trip (the default): shows the trip bar.
  trip?: boolean;
  children: ReactNode;
  tone?: "white" | "canvas";
}

const NEW_PLAN = "__nuevo__";

// Which trip the panel is working on; switching reloads its proposals.
function TripSwitcher() {
  const t = useCopy(COPY);
  const { state, selectPlan } = usePanel();
  const navigate = useNavigate();
  const toast = useToast();
  if (!state.plan) return null;
  const options = [...state.plans.map((p) => ({ value: p.id, label: p.name })), { value: NEW_PLAN, label: t.newTrip }];
  return (
    <Select
      className="w-56 max-w-full"
      size="sm"
      label={t.trip}
      value={state.plan.id}
      options={options}
      onChange={(id) => (id === NEW_PLAN ? navigate("/planes/nuevo") : selectPlan(id).catch((e: Error) => toast(e.message)))}
    />
  );
}

// Under the top bar on a trip's pages: which trip, its three steps (when,
// where, the trip) and, inside Dónde, its own four.
function TripBar({ end }: { end?: ReactNode }) {
  const t = useCopy(COPY);
  const { state } = usePanel();
  const { pathname } = useLocation();
  const plan = state.plan;
  if (!plan) return null;
  const inDonde = DONDE.some((d) => pathname.startsWith(d.to));
  const decided = !!plan.winnerDestinationId;
  const pending = state.proposals.filter((p) => p.review === "pending").length;
  // Dónde opens where the trip is: searching, reviewing, or voting.
  const dondeHome = plan.status !== "draft" ? "/votacion" : state.proposals.length ? "/revisar" : "/generar";
  // Deciding the place and the dates together (ROADMAP 2.7): one step for
  // both, and the window until a destination brings its dates.
  const together = decidesPlaceFirst(plan);
  const steps = together
    ? [
        { n: 1, label: t.whereWhen, to: dondeHome, active: inDonde, done: decided, later: false },
        { n: 2, label: t.theTrip, to: "/viaje", active: pathname.startsWith("/viaje"), done: false, later: !decided },
      ]
    : [
        { n: 1, label: t.when, to: "/fechas", active: pathname.startsWith("/fechas"), done: state.datesDecided, later: false },
        { n: 2, label: t.where, to: dondeHome, active: inDonde, done: decided, later: false },
        { n: 3, label: t.theTrip, to: "/viaje", active: pathname.startsWith("/viaje"), done: false, later: !decided },
      ];
  const range = together && !state.datesDecided && plan.window ? rangeLabel(plan.window.from, plan.window.to) : rangeLabel(plan.dateFrom, plan.dateTo);
  const extra = (to: string) =>
    to === "/revisar" && pending > 0 ? String(pending) : to === "/votacion" && plan.status === "voting" ? t.open : to === "/votacion" && decided ? t.closed : null;

  return (
    <div className="border-b border-line-soft bg-surface">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2.5 px-4 py-2.5 sm:px-8 xl:px-14">
        <div className="flex min-w-0 items-center gap-3">
          <TripSwitcher />
          <span className="hidden text-sm whitespace-nowrap text-muted xl:inline">
            {range} · {t.persons(plan.partySize)}
          </span>
        </div>
        <nav aria-label={t.tripSteps} className="flex items-center gap-1 max-sm:w-full">
          {steps.map((s, i) => (
            <span key={s.n} className="flex items-center gap-1 max-sm:flex-1">
              {i > 0 && <span aria-hidden className="h-px w-3 bg-line sm:w-5" />}
              <NavLink
                to={s.to}
                aria-current={s.active ? "page" : undefined}
                title={s.later ? t.later : undefined}
                className={cn(chipClasses("nav", s.active), "gap-2 max-sm:flex-1 max-sm:px-2", s.later && !s.active && "text-faint")}
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                    s.done ? "bg-accent text-white" : s.active ? "bg-ink text-white" : "bg-surface-3 text-ink-2",
                  )}
                >
                  {s.done ? <CheckIcon size={11} /> : s.n}
                </span>
                {s.label}
              </NavLink>
            </span>
          ))}
        </nav>
        {end && <div className="ml-auto flex items-center gap-2">{end}</div>}
      </div>
      {inDonde && (
        <nav aria-label={t.where} className="flex items-center gap-1.5 overflow-x-auto border-t border-line-faint px-4 py-2 sm:px-8 xl:px-14">
          {DONDE.map((d, i) => (
            <span key={d.to} className="flex shrink-0 items-center gap-1.5">
              {i > 0 && (
                <span aria-hidden className="text-xs text-faint">
                  →
                </span>
              )}
              <NavLink to={d.to} className={({ isActive }) => chipClasses("nav", isActive, "sm")}>
                {t[d.label]}
                {extra(d.to) && <span className="rounded-full bg-surface-3 px-1.5 text-[11px] font-semibold text-ink-2">{extra(d.to)}</span>}
              </NavLink>
            </span>
          ))}
        </nav>
      )}
    </div>
  );
}

// "claude conectado", the AI in use, or what's missing (ROADMAP 3.3).
function Status() {
  const t = useCopy(COPY);
  const { status } = usePanel().state;
  if (!status) return null;
  if (status.hosted) {
    if (!status.ai) return <StatusDot>{t.noAiHosted}</StatusDot>;
    return <StatusDot tone="on">{status.ai.background ? status.ai.name : t.readsShots(status.ai.name)}</StatusDot>;
  }
  if (!status.site.reachable) return <StatusDot>{t.siteOffline}</StatusDot>;
  if (status.research === "claude-cli") return <StatusDot tone="on">{t.claudeOn}</StatusDot>;
  if (status.research === "anthropic-api") return <StatusDot tone="on">{t.anthropicApi}</StatusDot>;
  if (status.ai) return <StatusDot tone="on">{status.ai.name}</StatusDot>;
  return <StatusDot>{t.noAi}</StatusDot>;
}

// The site runs older code than this panel: say so everywhere, since several
// screens quietly depend on it.
function SiteOutdated() {
  const t = useCopy(COPY);
  const { status } = usePanel().state;
  if (!status?.site.reachable || !status.site.outdated) return null;
  return (
    <div role="status" className="border-b border-claude/20 bg-claude-soft px-4 py-2.5 text-center text-sm text-claude sm:px-8">
      {t.outdated(status.site.url)}
      <code className="font-semibold">npm run deploy:site</code>.
    </div>
  );
}

// The frame every screen sits in: the top bar, the trip bar on a trip's
// screens, and a place for the screen's main action. It stays put while the
// organiser moves between screens (ShellLayout), so only the page changes.
interface Chrome {
  trip: boolean;
  tone: "white" | "canvas";
  // Where the screen's main action goes, in the top bar or the trip bar.
  slot: HTMLElement | null;
  set: (c: { trip: boolean; tone: "white" | "canvas" }) => void;
}
const ChromeCtx = createContext<Chrome | null>(null);

function Frame({ trip, tone, children, onSlot }: { trip: boolean; tone: "white" | "canvas"; children: ReactNode; onSlot: (el: HTMLElement | null) => void }) {
  const t = useCopy(COPY);
  const { state } = usePanel();
  const withTrip = trip && !!state.plan;
  const hosted = !!state.status?.hosted;
  const slot = <span ref={onSlot} className="flex items-center gap-2 empty:hidden" />;
  return (
    <Page className={tone === "canvas" ? "bg-canvas" : undefined}>
      <TopBar
        brand={<Brand sub={<span className="hidden sm:inline">{hosted ? t.panel : t.localPanel}</span>} />}
        nav={<PanelNav className="hidden md:flex" />}
        end={
          <>
            <Activity />
            <span className="hidden md:inline-flex">
              <Status />
            </span>
            {!withTrip && slot}
            {hosted && (
              <button type="button" onClick={() => void signOutHosted()} className={chipClasses("nav", false)}>
                {t.signOut}
              </button>
            )}
          </>
        }
      />
      <div className="border-b border-line-soft bg-surface px-4 py-2 md:hidden">
        <PanelNav className="overflow-x-auto" />
      </div>
      {withTrip && <TripBar end={slot} />}
      <SiteOutdated />
      {children}
    </Page>
  );
}

// The panel's screens as one layout route: the frame stays mounted, each
// screen comes in below it (PageTransition).
export function ShellLayout() {
  const [chrome, setChrome] = useState<{ trip: boolean; tone: "white" | "canvas" }>({ trip: true, tone: "white" });
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const { pathname } = useLocation();
  const set = (c: { trip: boolean; tone: "white" | "canvas" }) => setChrome((p) => (p.trip === c.trip && p.tone === c.tone ? p : c));
  // A new screen starts at its top. Braces: scrollTo may return a Promise.
  useLayoutEffect(() => {
    window.scrollTo?.(0, 0);
  }, [pathname]);
  return (
    <ChromeCtx.Provider value={{ ...chrome, slot, set }}>
      <Frame trip={chrome.trip} tone={chrome.tone} onSlot={setSlot}>
        <PageTransition routeKey={pathname}>
          <Outlet />
        </PageTransition>
      </Frame>
    </ChromeCtx.Provider>
  );
}

// What a screen tells the frame: whether it's about a trip, its tone, and its
// main action. Outside ShellLayout (tests of a single screen) it draws the
// frame itself.
export function PanelShell({ end, trip = true, children, tone = "white" }: PanelShellProps) {
  const chrome = useContext(ChromeCtx);
  const [ownSlot, setOwnSlot] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => chrome?.set({ trip, tone }), [chrome, trip, tone]);
  if (!chrome) {
    return (
      <Frame trip={trip} tone={tone} onSlot={setOwnSlot}>
        {end && ownSlot && createPortal(end, ownSlot)}
        {children}
      </Frame>
    );
  }
  return (
    <>
      {end && chrome.slot && createPortal(end, chrome.slot)}
      {children}
    </>
  );
}
