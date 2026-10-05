import { Link } from "react-router";
import { copy, deadlineLabel, rangeLabel, type PlanSummary } from "@wanderlot/core";
import { Badge, Brand, Card, EmptyState, Heading, Main, Page, PageTransition, Skeleton, Text, TopBar, useCopy } from "@wanderlot/ui";
import { AccountMenu } from "../components/AccountMenu.tsx";
import { useAuth } from "../data/auth.tsx";
import { person, usePlans } from "../data/store.tsx";

const COPY = copy({
  es: {
    ready: "El viaje está listo",
    goingTo: (city: string) => `Nos vamos a ${city}`,
    onePage: "Todo en una página",
    datesAnswered: "Fechas respondidas",
    decidingDates: "Decidiendo las fechas",
    datesMissing: "Te falta decir fechas",
    decidingDatesYou: "Decidiendo las fechas: di cuáles te vienen bien",
    voteUntil: (when: string) => `Votación abierta hasta el ${when}`,
    voteOpen: "Votación abierta",
    voted: "Ya has votado",
    toVote: "Te falta votar",
    closed: "Votación cerrada",
    chosen: (city: string) => `Destino elegido: ${city}`,
    votedDone: "Ya se votó",
    preparing: "Preparándose",
    notOpen: "La votación aún no está abierta",
    title: "Tus viajes",
    intro: (group: string) => `Los viajes de ${group} en los que estás. Elige uno para ver los destinos, comentar y votar.`,
    none: "Todavía no estás en ningún viaje",
    noneBody: (organiser: string) => `Cuando ${organiser} te añada a uno, aparecerá aquí.`,
    datesToDecide: "Fechas por decidir",
    people: (n: number) => `${n} ${n === 1 ? "persona" : "personas"}`,
    destinations: (n: number) => `${n} ${n === 1 ? "destino" : "destinos"}`,
  },
  en: {
    ready: "The trip is ready",
    goingTo: (city: string) => `We're going to ${city}`,
    onePage: "Everything on one page",
    datesAnswered: "Dates answered",
    decidingDates: "Deciding the dates",
    datesMissing: "Say which dates suit you",
    decidingDatesYou: "Deciding the dates: say which suit you",
    voteUntil: (when: string) => `Voting open until ${when}`,
    voteOpen: "Voting open",
    voted: "You've voted",
    toVote: "You haven't voted yet",
    closed: "Voting closed",
    chosen: (city: string) => `Destination chosen: ${city}`,
    votedDone: "The vote is done",
    preparing: "Getting ready",
    notOpen: "Voting isn't open yet",
    title: "Your trips",
    intro: (group: string) => `The ${group} trips you're on. Pick one to see the destinations, comment and vote.`,
    none: "You're not on any trip yet",
    noneBody: (organiser: string) => `When ${organiser} adds you to one, it'll show up here.`,
    datesToDecide: "Dates to be decided",
    people: (n: number) => `${n} ${n === 1 ? "person" : "people"}`,
    destinations: (n: number) => `${n} ${n === 1 ? "destination" : "destinations"}`,
  },
});
type Copy = (typeof COPY)["es"];

// What a trip is waiting on, for this person.
function stateOf(t: PlanSummary, c: Copy): { badge: string; tone: "accent" | "claude" | "neutral" | "muted"; line: string } {
  if (t.tripReady && !t.datesOpen) return { badge: c.ready, tone: "accent", line: t.winnerCity ? c.goingTo(t.winnerCity) : c.onePage };
  if (t.datesOpen && (t.status !== "voting" || t.votedByMe)) {
    return t.datesAnsweredByMe ? { badge: c.datesAnswered, tone: "accent", line: c.decidingDates } : { badge: c.datesMissing, tone: "claude", line: c.decidingDatesYou };
  }
  if (t.status === "voting") {
    const until = t.voteDeadline ? c.voteUntil(deadlineLabel(t.voteDeadline)) : c.voteOpen;
    return t.votedByMe ? { badge: c.voted, tone: "accent", line: until } : { badge: c.toVote, tone: "claude", line: until };
  }
  if (t.status === "closed") return { badge: c.closed, tone: "muted", line: t.winnerCity ? c.chosen(t.winnerCity) : c.votedDone };
  return { badge: c.preparing, tone: "neutral", line: c.notOpen };
}

// The trips order: what's being voted on first, then the rest as they come.
const rank = (t: PlanSummary) => (t.status === "voting" || t.datesOpen ? 0 : t.status === "draft" ? 1 : 2);

// "/": every trip this person is on, to pick one.
export function TripsPage() {
  const plans = usePlans();
  const auth = useAuth();
  const t = useCopy(COPY);
  const member = auth.state.status === "in" ? auth.state.member : null;
  const trips = plans ? [...plans].sort((a, b) => rank(a) - rank(b)) : null;

  return (
    <Page>
      <TopBar variant="site" brand={<Brand size="lg" sub={auth.group.groupName} />} end={member && <AccountMenu me={person(member, member.id)} />} />
      <PageTransition routeKey={trips ? "trips" : "loading"}>
        <Main>
          <div className="flex flex-col gap-2">
            <Heading as="h1" size="headline">
              {t.title}
            </Heading>
            <Text tone="muted">{t.intro(auth.group.groupName)}</Text>
          </div>
          {!trips ? (
            <div aria-busy="true" className="grid gap-4 md:grid-cols-2">
              <Skeleton className="h-36" />
              <Skeleton className="h-36" />
            </div>
          ) : trips.length === 0 ? (
            <EmptyState title={t.none}>{t.noneBody(auth.group.organiserName)}</EmptyState>
          ) : (
            <ul data-stagger className="m-0 grid list-none gap-4 p-0 md:grid-cols-2">
              {trips.map((trip) => {
                const s = stateOf(trip, t);
                const tr = trip;
                return (
                  <li key={tr.id}>
                    <Link to={tr.datesOpen && !tr.datesAnsweredByMe ? `/p/${tr.id}/fechas` : tr.tripReady ? `/p/${tr.id}/viaje` : `/p/${tr.id}`} className="block h-full rounded-card text-ink no-underline hover:text-ink">
                      <Card as="article" variant="raised" aria-label={tr.name} className="flex h-full flex-col gap-2.5 transition-shadow hover:shadow-pop">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <Heading as="h2" size="subheading">
                            {tr.name}
                          </Heading>
                          <Badge tone={s.tone} size="md">
                            {s.badge}
                          </Badge>
                        </div>
                        <span className="text-sm text-ink-2">
                          {tr.datesWindow ? rangeLabel(tr.datesWindow.from, tr.datesWindow.to) : tr.datesOpen ? t.datesToDecide : rangeLabel(tr.dateFrom, tr.dateTo)} · {t.people(tr.partySize)}
                          {tr.destinations !== undefined ? ` · ${t.destinations(tr.destinations)}` : ""}
                        </span>
                        <span className="mt-auto text-sm text-muted">{s.line}</span>
                      </Card>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Main>
      </PageTransition>
    </Page>
  );
}
