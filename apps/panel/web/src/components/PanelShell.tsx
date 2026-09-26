import type { ReactNode } from "react";
import { NavLink, useNavigate } from "react-router";
import { Brand, ExternalIcon, Page, Select, StatusDot, TopBar, chipClasses, cn, useToast } from "@wanderlot/ui";
import { usePanel } from "../data/store.tsx";

// The preview build points "Ver sitio" at the site preview; otherwise the
// site's own address comes from the panel's status.
const PREVIEW_SITE_URL = import.meta.env.VITE_SITE_URL as string | undefined;

const NAV = [
  { to: "/", label: "Viajes" },
  { to: "/generar", label: "Generar" },
  { to: "/revisar", label: "Revisar" },
  { to: "/comparativa", label: "Comparativa" },
  { to: "/votacion", label: "Votación" },
  { to: "/personas", label: "Personas" },
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
  // Right side of the top bar: the page's main action, if it has one.
  end?: ReactNode;
  showPlan?: boolean;
  children: ReactNode;
  tone?: "white" | "canvas";
}

const NEW_PLAN = "__nuevo__";

// Which plan the panel is working on; switching reloads its proposals.
function PlanSwitcher() {
  const { state, selectPlan } = usePanel();
  const navigate = useNavigate();
  const toast = useToast();
  if (!state.plan) return null;
  const options = [...state.plans.map((p) => ({ value: p.id, label: `Plan · ${p.name}` })), { value: NEW_PLAN, label: "+ Nuevo plan" }];
  return (
    <Select
      className="hidden w-60 xl:block"
      size="sm"
      label="Plan"
      value={state.plan.id}
      options={options}
      onChange={(id) => (id === NEW_PLAN ? navigate("/planes/nuevo") : selectPlan(id).catch((e: Error) => toast(e.message)))}
    />
  );
}

// "claude conectado", or what's missing.
function Status() {
  const { status } = usePanel().state;
  if (!status) return null;
  if (!status.site.reachable) return <StatusDot>sitio sin conexión</StatusDot>;
  if (status.research === "claude-cli") return <StatusDot tone="on">claude conectado</StatusDot>;
  if (status.research === "anthropic-api") return <StatusDot tone="on">API de Anthropic</StatusDot>;
  return <StatusDot>claude sin conectar</StatusDot>;
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

export function PanelShell({ end, showPlan = true, children, tone = "white" }: PanelShellProps) {
  return (
    <Page className={tone === "canvas" ? "bg-canvas" : undefined}>
      <TopBar
        brand={<Brand sub={<span className="hidden sm:inline">Panel local</span>} />}
        nav={<PanelNav className="hidden md:flex" />}
        end={
          <>
            {showPlan && <PlanSwitcher />}
            <span className="hidden lg:inline-flex">
              <Status />
            </span>
            {end}
          </>
        }
      />
      <div className="border-b border-line-soft bg-surface px-4 py-2 md:hidden">
        <PanelNav className="overflow-x-auto" />
      </div>
      <SiteOutdated />
      {children}
    </Page>
  );
}
