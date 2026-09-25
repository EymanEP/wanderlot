import type { ReactNode } from "react";
import { NavLink } from "react-router";
import { Badge, Brand, ExternalIcon, Page, StatusDot, TopBar, chipClasses, cn } from "@wanderlot/ui";
import { usePanel } from "../data/store.tsx";

const SITE_URL = import.meta.env.VITE_SITE_URL ?? "http://localhost:5173/p/noviembre-2026";

const NAV = [
  { to: "/generar", label: "Generar" },
  { to: "/revisar", label: "Revisar" },
  { to: "/comparativa", label: "Comparativa" },
  { to: "/personas", label: "Personas" },
];

export function PanelNav({ className }: { className?: string }) {
  return (
    <nav aria-label="Panel" className={cn("flex items-center gap-1.5", className)}>
      {NAV.map((n) => (
        <NavLink key={n.to} to={n.to} className={({ isActive }) => chipClasses("nav", isActive)}>
          {n.label}
        </NavLink>
      ))}
      <a href={SITE_URL} target="_blank" rel="noreferrer" className={chipClasses("nav", false)}>
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

export function PanelShell({ end, showPlan = true, children, tone = "white" }: PanelShellProps) {
  const { plan } = usePanel().state;
  return (
    <Page className={tone === "canvas" ? "bg-canvas" : undefined}>
      <TopBar
        brand={<Brand sub={<span className="hidden sm:inline">Panel local</span>} />}
        nav={<PanelNav className="hidden md:flex" />}
        end={
          <>
            {showPlan && (
              <Badge tone="neutral" size="md" className="hidden px-3.5 py-2 text-[13px] font-semibold text-ink xl:inline-flex">
                Plan · {plan.name}
              </Badge>
            )}
            <span className="hidden lg:inline-flex">
              <StatusDot>claude bin sin conectar</StatusDot>
            </span>
            {end}
          </>
        }
      />
      <div className="border-b border-line-soft bg-surface px-4 py-2 md:hidden">
        <PanelNav className="overflow-x-auto" />
      </div>
      {children}
    </Page>
  );
}
