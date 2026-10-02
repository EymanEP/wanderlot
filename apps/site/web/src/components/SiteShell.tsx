import { useEffect, useRef, type ReactNode } from "react";
import { Link, NavLink, Outlet, useLocation, useParams } from "react-router";
import { rangeLabel } from "@wanderlot/core";
import { Brand, CalendarIcon, ChatIcon, GlobeIcon, HouseIcon, InfoPill, Page, PageTransition, PlaneIcon, TopBar, TrophyIcon, cn, navLinkClasses } from "@wanderlot/ui";
import { AccountMenu } from "./AccountMenu.tsx";
import { useAuth } from "../data/auth.tsx";
import { PlanProvider, useSite } from "../data/store.tsx";
import { PageErrorBoundary } from "./PageErrorBoundary.tsx";

interface NavItem {
  to: string;
  label: string;
  end: boolean;
  icon: ReactNode;
}

// El viaje leads once it's published. Fechas shows only on trips with a
// date vote: first while it's open, last once the dates are decided.
function useNav() {
  const { planId } = useParams();
  const { dates, trip } = useSite();
  const base = `/p/${planId}`;
  const nav: NavItem[] = [
    { to: base, label: "Destinos", end: true, icon: <GlobeIcon size={20} /> },
    { to: `${base}/votacion`, label: "Votación", end: false, icon: <TrophyIcon size={20} /> },
    { to: `${base}/comentarios`, label: "Comentarios", end: false, icon: <ChatIcon size={20} /> },
  ];
  const viaje = { to: `${base}/viaje`, label: "El viaje", end: false, icon: <PlaneIcon size={20} /> };
  const fechas = { to: `${base}/fechas`, label: "Fechas", end: false, icon: <CalendarIcon size={20} /> };
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
      <PageTransition routeKey={pathname} className="pb-20 md:pb-0">
        <PageErrorBoundary>
          <Outlet />
        </PageErrorBoundary>
      </PageTransition>
      <PhoneNav items={nav} />
    </Page>
  );
}

// On a phone, a bar along the bottom: home first, then the trip's sections,
// sliding sideways when they don't fit. The one you're on stays in view.
function PhoneNav({ items }: { items: NavItem[] }) {
  const { pathname } = useLocation();
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bar.current?.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView?.({ inline: "center", block: "nearest" });
  }, [pathname]);
  const item = "flex h-16 min-w-[76px] flex-1 shrink-0 snap-start flex-col items-center justify-center gap-1 px-2 text-[12px] no-underline";
  return (
    <nav aria-label="Secciones" className="fixed inset-x-0 bottom-0 z-30 border-t border-line-soft bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <div ref={bar} className="flex snap-x overflow-x-auto [scrollbar-width:none]">
        <Link to="/" className={cn(item, "max-w-[76px] border-r border-line-faint font-medium text-muted")}>
          <HouseIcon size={20} />
          Viajes
        </Link>
        {items.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => cn(item, isActive ? "font-bold text-accent-strong" : "font-medium text-muted")}>
            {n.icon}
            <span className="whitespace-nowrap">{n.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
