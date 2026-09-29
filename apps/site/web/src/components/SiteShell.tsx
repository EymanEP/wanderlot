import { useEffect } from "react";
import { Link, NavLink, Outlet, useLocation, useParams } from "react-router";
import { rangeLabel } from "@wanderlot/core";
import { Brand, InfoPill, Page, TopBar, cn, navLinkClasses } from "@wanderlot/ui";
import { AccountMenu } from "./AccountMenu.tsx";
import { useAuth } from "../data/auth.tsx";
import { PlanProvider, useSite } from "../data/store.tsx";
import { PageErrorBoundary } from "./PageErrorBoundary.tsx";

// El viaje leads once it's published. Fechas shows only on trips with a
// date vote: first while it's open, last once the dates are decided.
function useNav() {
  const { planId } = useParams();
  const { dates, trip } = useSite();
  const base = `/p/${planId}`;
  const nav = [
    { to: base, label: "Destinos", end: true },
    { to: `${base}/votacion`, label: "Votación", end: false },
    { to: `${base}/comentarios`, label: "Comentarios", end: false },
  ];
  const viaje = { to: `${base}/viaje`, label: "El viaje", end: false };
  const fechas = { to: `${base}/fechas`, label: "Fechas", end: false };
  if (dates?.status === "open") return trip ? [viaje, fechas, ...nav] : [fechas, ...nav];
  if (trip) return [viaje, ...nav];
  return dates ? [...nav, fechas] : nav;
}

// Loads the plan in the address, then draws the chrome around its pages.
export function SiteShell() {
  const { planId = "" } = useParams();
  return (
    <PlanProvider planId={planId}>
      <Chrome />
    </PlanProvider>
  );
}

// Header on wide screens; a bottom tab bar on phones, where the group votes.
function Chrome() {
  const { plan, me, dates } = useSite();
  const { group } = useAuth();
  const nav = useNav();
  const { pathname } = useLocation();

  // Braces matter: newer Chrome's scrollTo returns a Promise, and an effect
  // that returns one hands React a "cleanup" it then fails to call, which
  // blanked the site on the next page change.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <Page>
      <TopBar
        variant="site"
        brand={
          <Link to="/" aria-label="Tus viajes" className="text-ink no-underline hover:text-ink">
            <Brand size="lg" sub={group.groupName} />
          </Link>
        }
        center={<InfoPill items={[plan.name, dates?.status === "open" ? "Fechas por decidir" : rangeLabel(plan.dateFrom, plan.dateTo), `${plan.partySize} personas`]} />}
        nav={
          <nav aria-label="Secciones" className="hidden items-center gap-6 md:flex">
            {nav.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => navLinkClasses(isActive)}>
                {n.label}
              </NavLink>
            ))}
          </nav>
        }
        end={<AccountMenu me={me} />}
      />
      <div className="flex flex-1 flex-col pb-20 md:pb-0">
        <PageErrorBoundary>
          <Outlet />
        </PageErrorBoundary>
      </div>
      <nav
        aria-label="Secciones"
        className={cn("fixed inset-x-0 bottom-0 z-30 grid border-t border-line-soft bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden", { 3: "grid-cols-3", 4: "grid-cols-4", 5: "grid-cols-5" }[nav.length])}
      >
        {nav.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) =>
              cn("flex h-16 items-center justify-center text-sm no-underline", isActive ? "font-bold text-ink" : "font-medium text-muted")
            }
          >
            {n.label}
          </NavLink>
        ))}
      </nav>
    </Page>
  );
}
