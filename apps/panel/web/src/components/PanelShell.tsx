import type { ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router";
import { rangeLabel } from "@wanderlot/core";
import { Brand, CheckIcon, ExternalIcon, Page, Select, StatusDot, TopBar, chipClasses, cn, useToast } from "@wanderlot/ui";
import { usePanel } from "../data/store.tsx";
import { signOutHosted } from "./HostedGate.tsx";

// The preview build points "Ver sitio" at the site preview; otherwise the
// site's own address comes from the panel's status.
const PREVIEW_SITE_URL = import.meta.env.VITE_SITE_URL as string | undefined;

// The whole group: every trip, and the people.
const NAV = [
  { to: "/", label: "Viajes" },
  { to: "/personas", label: "Personas" },
  { to: "/ajustes", label: "Ajustes" },
];

// Dónde, step by step: find, review, compare, vote.
const DONDE = [
  { to: "/generar", label: "Generar" },
  { to: "/revisar", label: "Revisar" },
  { to: "/comparativa", label: "Comparativa" },
  { to: "/votacion", label: "Votación" },
];

export function PanelNav({ className }: { className?: string }) {
  const { state } = usePanel();
  const siteUrl = PREVIEW_SITE_URL ?? state.status?.site.url ?? "/";
  return (
    <nav aria-label="Panel" className={cn("flex items-center gap-1.5", className)}>
      {NAV.map((n) => (
        <NavLink key={n.to} to={n.to} end={n.to === "/"} className={({ isActive }) => chipClasses("nav", isActive)}>
          {n.label}
        </NavLink>
      ))}
      <a href={siteUrl} target="_blank" rel="noreferrer" className={chipClasses("nav", false)}>
        Ver sitio
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
  const { state, selectPlan } = usePanel();
  const navigate = useNavigate();
  const toast = useToast();
  if (!state.plan) return null;
  const options = [...state.plans.map((p) => ({ value: p.id, label: p.name })), { value: NEW_PLAN, label: "+ Nuevo viaje" }];
  return (
    <Select
      className="w-56 max-w-full"
      size="sm"
      label="Viaje"
      value={state.plan.id}
      options={options}
      onChange={(id) => (id === NEW_PLAN ? navigate("/planes/nuevo") : selectPlan(id).catch((e: Error) => toast(e.message)))}
    />
  );
}

// Under the top bar on a trip's pages: which trip, its three steps (when,
// where, the trip) and, inside Dónde, its own four.
function TripBar({ end }: { end?: ReactNode }) {
  const { state } = usePanel();
  const { pathname } = useLocation();
  const plan = state.plan;
  if (!plan) return null;
  const inDonde = DONDE.some((d) => pathname.startsWith(d.to));
  const decided = !!plan.winnerDestinationId;
  const pending = state.proposals.filter((p) => p.review === "pending").length;
  // Dónde opens where the trip is: searching, reviewing, or voting.
  const dondeHome = plan.status !== "draft" ? "/votacion" : state.proposals.length ? "/revisar" : "/generar";
  const steps = [
    { n: 1, label: "Cuándo", to: "/fechas", active: pathname.startsWith("/fechas"), done: false, later: false },
    { n: 2, label: "Dónde", to: dondeHome, active: inDonde, done: decided, later: false },
    { n: 3, label: "El viaje", to: "/viaje", active: pathname.startsWith("/viaje"), done: false, later: !decided },
  ];
  const extra = (to: string) =>
    to === "/revisar" && pending > 0 ? String(pending) : to === "/votacion" && plan.status === "voting" ? "abierta" : to === "/votacion" && decided ? "cerrada" : null;

  return (
    <div className="border-b border-line-soft bg-surface">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2.5 px-4 py-2.5 sm:px-8 xl:px-14">
        <div className="flex min-w-0 items-center gap-3">
          <TripSwitcher />
          <span className="hidden text-sm whitespace-nowrap text-muted xl:inline">
            {rangeLabel(plan.dateFrom, plan.dateTo)} · {plan.partySize} {plan.partySize === 1 ? "persona" : "personas"}
          </span>
        </div>
        <nav aria-label="Pasos del viaje" className="flex items-center gap-1 max-sm:w-full">
          {steps.map((s, i) => (
            <span key={s.n} className="flex items-center gap-1 max-sm:flex-1">
              {i > 0 && <span aria-hidden className="h-px w-3 bg-line sm:w-5" />}
              <NavLink
                to={s.to}
                aria-current={s.active ? "page" : undefined}
                title={s.later ? "Cuando el destino esté decidido" : undefined}
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
        <nav aria-label="Dónde" className="flex items-center gap-1.5 overflow-x-auto border-t border-line-faint px-4 py-2 sm:px-8 xl:px-14">
          {DONDE.map((d, i) => (
            <span key={d.to} className="flex shrink-0 items-center gap-1.5">
              {i > 0 && (
                <span aria-hidden className="text-xs text-faint">
                  →
                </span>
              )}
              <NavLink to={d.to} className={({ isActive }) => chipClasses("nav", isActive, "sm")}>
                {d.label}
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
  const { status } = usePanel().state;
  if (!status) return null;
  if (status.hosted) {
    if (!status.ai) return <StatusDot>sin IA: busca desde tu ordenador</StatusDot>;
    return <StatusDot tone="on">{status.ai.background ? status.ai.name : `${status.ai.name}: lee capturas`}</StatusDot>;
  }
  if (!status.site.reachable) return <StatusDot>sitio sin conexión</StatusDot>;
  if (status.research === "claude-cli") return <StatusDot tone="on">claude conectado</StatusDot>;
  if (status.research === "anthropic-api") return <StatusDot tone="on">API de Anthropic</StatusDot>;
  if (status.ai) return <StatusDot tone="on">{status.ai.name}</StatusDot>;
  return <StatusDot>sin IA</StatusDot>;
}

// The site runs older code than this panel: say so everywhere, since several
// screens quietly depend on it.
function SiteOutdated() {
  const { status } = usePanel().state;
  if (!status?.site.reachable || !status.site.outdated) return null;
  return (
    <div role="status" className="border-b border-claude/20 bg-claude-soft px-4 py-2.5 text-center text-sm text-claude sm:px-8">
      Tu sitio ({status.site.url}) tiene una versión anterior al panel: las ideas del grupo, los PIN y otras novedades no funcionarán hasta que lo
      actualices con <code className="font-semibold">npm run deploy:site</code>.
    </div>
  );
}

export function PanelShell({ end, trip = true, children, tone = "white" }: PanelShellProps) {
  const { state } = usePanel();
  const withTrip = trip && !!state.plan;
  const hosted = !!state.status?.hosted;
  return (
    <Page className={tone === "canvas" ? "bg-canvas" : undefined}>
      <TopBar
        brand={<Brand sub={<span className="hidden sm:inline">{hosted ? "Panel" : "Panel local"}</span>} />}
        nav={<PanelNav className="hidden md:flex" />}
        end={
          <>
            <span className="hidden md:inline-flex">
              <Status />
            </span>
            {!withTrip && end}
            {hosted && (
              <button type="button" onClick={() => void signOutHosted()} className={chipClasses("nav", false)}>
                Salir
              </button>
            )}
          </>
        }
      />
      <div className="border-b border-line-soft bg-surface px-4 py-2 md:hidden">
        <PanelNav className="overflow-x-auto" />
      </div>
      {withTrip && <TripBar end={end} />}
      <SiteOutdated />
      {children}
    </Page>
  );
}
