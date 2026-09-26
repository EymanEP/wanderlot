import { useEffect } from "react";
import { NavLink, Outlet, useLocation, useParams } from "react-router";
import { rangeLabel } from "@wanderlot/core";
import { Brand, InfoPill, Page, TopBar, cn, navLinkClasses } from "@wanderlot/ui";
import { AccountMenu } from "./AccountMenu.tsx";
import { useAuth } from "../data/auth.tsx";
import { PlanProvider, useSite } from "../data/store.tsx";

function useNav() {
  const { planId } = useParams();
  const base = `/p/${planId}`;
  return [
    { to: base, label: "Destinos", end: true },
    { to: `${base}/votacion`, label: "Votación", end: false },
    { to: `${base}/comentarios`, label: "Comentarios", end: false },
  ];
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
  const { plan, me } = useSite();
  const { group } = useAuth();
  const nav = useNav();
  const { pathname } = useLocation();

  useEffect(() => window.scrollTo(0, 0), [pathname]);

  return (
    <Page>
      <TopBar
        variant="site"
        brand={<Brand size="lg" sub={group.groupName} />}
        center={<InfoPill items={[plan.name, rangeLabel(plan.dateFrom, plan.dateTo), `${plan.partySize} personas`]} />}
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
        <Outlet />
      </div>
      <nav
        aria-label="Secciones"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t border-line-soft bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
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
