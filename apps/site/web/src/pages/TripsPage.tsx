import { Link } from "react-router";
import { deadlineLabel, rangeLabel, type PlanSummary } from "@wanderlot/core";
import { Badge, Brand, Card, EmptyState, Heading, Main, Page, Skeleton, Text, TopBar } from "@wanderlot/ui";
import { AccountMenu } from "../components/AccountMenu.tsx";
import { useAuth } from "../data/auth.tsx";
import { person, usePlans } from "../data/store.tsx";

// What a trip is waiting on, for this person.
function stateOf(t: PlanSummary): { badge: string; tone: "accent" | "claude" | "neutral" | "muted"; line: string } {
  if (t.status === "voting") {
    const until = t.voteDeadline ? `Votación abierta hasta el ${deadlineLabel(t.voteDeadline)}` : "Votación abierta";
    return t.votedByMe ? { badge: "Ya has votado", tone: "accent", line: until } : { badge: "Te falta votar", tone: "claude", line: until };
  }
  if (t.status === "closed") return { badge: "Votación cerrada", tone: "muted", line: t.winnerCity ? `Destino elegido: ${t.winnerCity}` : "Ya se votó" };
  return { badge: "Preparándose", tone: "neutral", line: "La votación aún no está abierta" };
}

// The trips order: what's being voted on first, then the rest as they come.
const rank = (t: PlanSummary) => (t.status === "voting" ? 0 : t.status === "draft" ? 1 : 2);

// "/": every trip this person is on, to pick one.
export function TripsPage() {
  const plans = usePlans();
  const auth = useAuth();
  const member = auth.state.status === "in" ? auth.state.member : null;
  const trips = plans ? [...plans].sort((a, b) => rank(a) - rank(b)) : null;

  return (
    <Page>
      <TopBar variant="site" brand={<Brand size="lg" sub={auth.group.groupName} />} end={member && <AccountMenu me={person(member, member.id)} />} />
      <Main>
        <div className="flex flex-col gap-2">
          <Heading as="h1" size="headline">
            Tus viajes
          </Heading>
          <Text tone="muted">Los viajes de {auth.group.groupName} en los que estás. Elige uno para ver los destinos, comentar y votar.</Text>
        </div>
        {!trips ? (
          <div aria-busy="true" className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-36" />
            <Skeleton className="h-36" />
          </div>
        ) : trips.length === 0 ? (
          <EmptyState title="Todavía no estás en ningún viaje">Cuando {auth.group.organiserName} te añada a uno, aparecerá aquí.</EmptyState>
        ) : (
          <ul className="m-0 grid list-none gap-4 p-0 md:grid-cols-2">
            {trips.map((t) => {
              const s = stateOf(t);
              return (
                <li key={t.id}>
                  <Link to={`/p/${t.id}`} className="block h-full rounded-card text-ink no-underline hover:text-ink">
                    <Card as="article" variant="raised" aria-label={t.name} className="flex h-full flex-col gap-2.5 transition-shadow hover:shadow-pop">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <Heading as="h2" size="subheading">
                          {t.name}
                        </Heading>
                        <Badge tone={s.tone} size="md">
                          {s.badge}
                        </Badge>
                      </div>
                      <span className="text-sm text-ink-2">
                        {rangeLabel(t.dateFrom, t.dateTo)} · {t.partySize} {t.partySize === 1 ? "persona" : "personas"}
                        {t.destinations !== undefined ? ` · ${t.destinations} ${t.destinations === 1 ? "destino" : "destinos"}` : ""}
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
    </Page>
  );
}
