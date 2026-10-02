import { useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { airportCity, copy, longDate, weekdayDay, type Category } from "@wanderlot/core";
import {
  BeachIcon,
  Button,
  Card,
  CityIcon,
  Chip,
  EmptyState,
  FiltersIcon,
  Footer,
  GlobeIcon,
  HouseIcon,
  IconTabs,
  Main,
  MountainIcon,
  PageHeader,
  ScrollRow,
  SectionHeader,
  buttonClasses,
  chipClasses,
  cn,
  useCopy,
} from "@wanderlot/ui";
import { CommentCard } from "../components/CommentCard.tsx";
import { LeaveCard } from "../components/LeaveCard.tsx";
import { SuggestDialog } from "../components/SuggestDialog.tsx";
import { DestinationCard } from "../components/DestinationCard.tsx";
import { useAuth } from "../data/auth.tsx";
import { useSite } from "../data/store.tsx";
import { memberOf, numberWord, overridden, trustOf } from "../lib/view.ts";

const COPY = copy({
  es: {
    tabs: { all: "Todos", ciudad: "Ciudad", escapada: "Escapada", playa: "Playa", naturaleza: "Naturaleza" },
    category: "Categoría",
    datesOpen: "Fechas por decidir",
    range: (from: string, to: string) => `Del ${from} al ${to}`,
    from: (city: string) => `salida desde ${city}`,
    proposals: (n: string) => `${n} propuestas sobre la mesa`,
    goingTo: (city: string, voted: string) => `Vamos a ${city} · la votación la ganó ${voted}`,
    closed: (city: string | null) => `Votación cerrada${city ? ` · ganó ${city}` : ""}`,
    votedOf: (n: number, of: number) => `Votasteis ${n} de ${of}`,
    notOpen: "La votación aún no está abierta",
    meanwhile: "Mientras tanto, mirad los destinos y comentad",
    voting: (n: number, of: number) => `${n} de ${of} habéis votado`,
    opens: (date: string) => `El marcador se abre el ${date}`,
    suggest: "Proponer un destino",
    count: "Ver el recuento",
    change: "Cambiar mi reparto",
    give: "Repartir mis puntos",
    filters: "Filtros",
    direct: "Solo directos",
    under400: "Hasta 400 € por persona",
    tripReady: "El viaje está listo",
    tripText: (city: string | null) => `Vuelos, alojamiento, cómo llegar y qué hacer en ${city ?? "el destino"}, todo en una página.`,
    seeTrip: "Ver el viaje",
    voted: "Este plan ya se votó",
    none: "Todavía no hay destinos",
    sayDates: "Decir qué fechas me vienen bien",
    closedText: "La votación está cerrada.",
    preparing: (organiser: string) => `${organiser} está preparando las propuestas. Os avisará cuando se abra la votación.`,
    noMatch: "Ningún destino con estos filtros",
    noMatchText: "Prueba con otra categoría o quita algún filtro.",
    destinations: "Destinos",
    recent: "Lo último que habéis dicho",
    allComments: (n: number) => `Ver los ${n} comentarios`,
    otherPlans: "Otros planes",
    draft: "borrador",
    closedWord: "cerrado",
    votingWord: "votando",
    checked: (date: string, year: string) => `Precios consultados el ${date} de ${year}.`,
  },
  en: {
    tabs: { all: "All", ciudad: "City", escapada: "Getaway", playa: "Beach", naturaleza: "Nature" },
    category: "Category",
    datesOpen: "Dates to be decided",
    range: (from: string, to: string) => `${from} to ${to}`,
    from: (city: string) => `leaving from ${city}`,
    proposals: (n: string) => `${n} ideas on the table`,
    goingTo: (city: string, voted: string) => `We're going to ${city} · ${voted} won the vote`,
    closed: (city: string | null) => `Voting closed${city ? ` · ${city} won` : ""}`,
    votedOf: (n: number, of: number) => `${n} of ${of} of you voted`,
    notOpen: "Voting isn't open yet",
    meanwhile: "In the meantime, look around and comment",
    voting: (n: number, of: number) => `${n} of ${of} of you have voted`,
    opens: (date: string) => `The scores show on ${date}`,
    suggest: "Suggest a destination",
    count: "See the count",
    change: "Change my points",
    give: "Give my points",
    filters: "Filters",
    direct: "Direct only",
    under400: "Up to €400 per person",
    tripReady: "The trip is ready",
    tripText: (city: string | null) => `Flights, where you're staying, getting there and what to do in ${city ?? "the destination"}, all on one page.`,
    seeTrip: "See the trip",
    voted: "This plan has been voted on",
    none: "No destinations yet",
    sayDates: "Say which dates suit me",
    closedText: "Voting is closed.",
    preparing: (organiser: string) => `${organiser} is getting the ideas ready. You'll hear when voting opens.`,
    noMatch: "No destinations with these filters",
    noMatchText: "Try another category or remove a filter.",
    destinations: "Destinations",
    recent: "What you've said lately",
    allComments: (n: number) => `See all ${n} comments`,
    otherPlans: "Other plans",
    draft: "draft",
    closedWord: "closed",
    votingWord: "voting",
    checked: (date: string, year: string) => `Prices checked on ${date} ${year}.`,
  },
});

type CategoryFilter = "all" | Category;

const TABS = [
  { id: "all", icon: <GlobeIcon size={22} /> },
  { id: "ciudad", icon: <CityIcon size={22} /> },
  { id: "escapada", icon: <HouseIcon size={22} /> },
  { id: "playa", icon: <BeachIcon size={22} /> },
  { id: "naturaleza", icon: <MountainIcon size={22} /> },
] as const;

export function PlanPage() {
  const site = useSite();
  const t = useCopy(COPY);
  const tabs = TABS.map((tab) => ({ ...tab, label: t.tabs[tab.id] }));
  const { planId } = useParams();
  const { group } = useAuth();
  const { plan, destinations, myRanking, voted, comments, members, now, result, closed, dates, trip } = site;
  const datesOpen = dates?.status === "open";
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [onlyDirect, setOnlyDirect] = useState(false);
  const [under400, setUnder400] = useState(false);
  const base = `/p/${planId}`;

  // My picks first, in my order; the rest after. Once closed: by points.
  const ordered = useMemo(() => {
    const pos = (id: string) => (result ? result.rows.findIndex((r) => r.id === id) : myRanking.includes(id) ? myRanking.indexOf(id) : 99);
    return destinations
      .filter((d) => category === "all" || d.category === category)
      .filter((d) => !onlyDirect || d.outbound.stops === 0)
      .filter((d) => !under400 || d.totalPerPersonCents <= 40000)
      .sort((a, b) => pos(a.id) - pos(b.id));
  }, [destinations, category, onlyDirect, under400, myRanking, result]);

  const recent = [...comments].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 3);
  const winnerId = result?.winnerId ?? plan.winnerDestinationId;
  const winner = winnerId ? destinations.find((d) => d.id === winnerId) : undefined;
  const draft = plan.status === "draft";
  const checkedAt = destinations.map((d) => (d.provenance.kind !== "claude" ? d.provenance.checkedAt : null)).filter(Boolean).sort()[0];

  return (
    <Main>
      <PageHeader
        size="display"
        title={plan.name}
        subtitle={`${datesOpen ? t.datesOpen : t.range(weekdayDay(plan.dateFrom), weekdayDay(plan.dateTo))} · ${t.from(airportCity(plan.origin))}${destinations.length ? ` · ${t.proposals(numberWord(destinations.length))}` : ""}`}
        actions={
          <>
            <div className="flex flex-col gap-0.5 lg:items-end">
              {closed ? (
                <>
                  <span className="text-[15px] font-bold">
                    {overridden(result) && winner
                      ? t.goingTo(winner.place.city, destinations.find((d) => d.id === result!.voteWinnerId)?.place.city ?? "")
                      : t.closed(winner?.place.city ?? null)}
                  </span>
                  {overridden(result) && result!.decidedNote && <span className="text-[13px] text-ink-2">«{result!.decidedNote}»</span>}
                  <span className="text-[13px] text-muted">{t.votedOf(voted.size, plan.partySize)}</span>
                </>
              ) : draft ? (
                <>
                  <span className="text-[15px] font-bold">{t.notOpen}</span>
                  <span className="text-[13px] text-muted">{t.meanwhile}</span>
                </>
              ) : (
                <>
                  <span className="text-[15px] font-bold">
                    {t.voting(voted.size, plan.partySize)}
                  </span>
                  <span className="text-[13px] text-muted">{t.opens(longDate(plan.voteDeadline!))}</span>
                </>
              )}
            </div>
            {!closed && (
              <Button size="lg" onClick={() => setSuggesting(true)}>
                {t.suggest}
              </Button>
            )}
            {!draft && destinations.length > 0 && (
              <Link to={`${base}/votacion`} className={buttonClasses({ variant: "primary", size: "lg" })}>
                {closed ? t.count : myRanking.length ? t.change : t.give}
              </Link>
            )}
          </>
        }
      />

      <LeaveCard />

      <section className="flex flex-col gap-3 border-b border-line-soft pb-0.5 sm:flex-row sm:items-end sm:justify-between">
        <IconTabs label={t.category} tabs={tabs} value={category} onChange={setCategory} />
        <button
          type="button"
          aria-expanded={showFilters}
          aria-controls="filtros"
          onClick={() => setShowFilters((x) => !x)}
          className={cn(buttonClasses({ variant: "secondary" }), "mb-2.5 h-[46px] self-start sm:self-auto")}
        >
          <FiltersIcon size={17} />
          {t.filters}
        </button>
      </section>
      {showFilters && (
        <ScrollRow id="filtros" role="group" aria-label={t.filters}>
          <Chip on={onlyDirect} onClick={() => setOnlyDirect((x) => !x)}>
            {t.direct}
          </Chip>
          <Chip on={under400} onClick={() => setUnder400((x) => !x)}>
            {t.under400}
          </Chip>
        </ScrollRow>
      )}

      {trip && (
        <Card variant="accent" className="flex flex-wrap items-center justify-between gap-3">
          <span className="flex flex-col gap-0.5">
            <span className="text-[13px] font-bold">{t.tripReady}</span>
            <span className="text-sm">
              {t.tripText(destinations.find((d) => d.id === trip.destinationId)?.place.city ?? null)}
            </span>
          </span>
          <Link to={`${base}/viaje`} className={buttonClasses({ variant: "primary" })}>
            {t.seeTrip}
          </Link>
        </Card>
      )}

      {destinations.length === 0 ? (
        <EmptyState
          title={closed && winnerId ? t.voted : t.none}
          action={
            datesOpen ? (
              <Link to={`${base}/fechas`} className={buttonClasses({ variant: "primary" })}>
                {t.sayDates}
              </Link>
            ) : undefined
          }
        >
          {closed ? t.closedText : t.preparing(group.organiserName)}
        </EmptyState>
      ) : ordered.length === 0 ? (
        <EmptyState title={t.noMatch}>{t.noMatchText}</EmptyState>
      ) : (
        <section aria-label={t.destinations} data-stagger className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {ordered.map((d) => (
            <DestinationCard
              key={d.id}
              destination={d}
              plan={plan}
              href={`${base}/destinos/${d.id}`}
              trust={trustOf(d, now)}
              myPosition={myRanking.indexOf(d.id)}
              {...(result ? { points: result.rows.find((r) => r.id === d.id)?.points ?? 0, winner: result.winnerId === d.id } : {})}
              saved={site.saved.includes(d.id)}
              onToggleSave={() => site.toggleSave(d.id)}
            />
          ))}
        </section>
      )}

      {recent.length > 0 && (
      <section className="flex flex-col gap-3.5">
        <SectionHeader
          size="subheading"
          title={t.recent}
          aside={
            <Link to={`${base}/comentarios`} className="text-sm font-semibold">
              {t.allComments(comments.length)}
            </Link>
          }
        />
        <div className="grid gap-5 md:grid-cols-3">
          {recent.map((c) => (
            <CommentCard
              key={c.id}
              comment={c}
              author={memberOf(members, c.memberId)}
              place={destinations.find((d) => d.id === c.destinationId)?.place.city ?? ""}
              href={`${base}/destinos/${c.destinationId}#comentarios`}
            />
          ))}
        </div>
      </section>
      )}

      <SuggestDialog open={suggesting} planId={plan.id} organiser={group.organiserName} onClose={() => setSuggesting(false)} />

      <Footer>
        <div className="flex flex-wrap items-center gap-3.5">
          <span className="text-[13px] font-bold text-muted">{t.otherPlans}</span>
          {site.otherPlans.map((p) => (
            <Link key={p.id} to={`/p/${p.id}`} className={chipClasses("nav", p.status === "draft")}>
              {p.name} · {p.status === "draft" ? t.draft : p.status === "closed" ? (p.winnerCity ?? t.closedWord) : t.votingWord}
            </Link>
          ))}
        </div>
        {checkedAt && (
          <span className="text-[13px] text-muted">
            {t.checked(longDate(checkedAt), checkedAt.slice(0, 4))}
          </span>
        )}
      </Footer>
    </Main>
  );
}
