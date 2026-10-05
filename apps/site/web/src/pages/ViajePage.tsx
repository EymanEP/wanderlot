import { Link, useParams } from "react-router";
import {
  baseStay,
  copy,
  euros,
  flightDetailsKnown,
  flightPriceCents,
  longDate,
  researchLabel,
  shortDate,
  standardImageUrl,
  stayShareCents,
  stayTotalCents,
  type Destination,
  type TripPage,
} from "@wanderlot/core";
import {
  Avatar,
  CarIcon,
  HouseIcon,
  PlaneIcon,
  Badge,
  Card,
  EmptyState,
  ExternalIcon,
  Eyebrow,
  Heading,
  Main,
  Photo,
  ProvenanceBadge,
  Text,
  buttonClasses,
  cn,
  useCopy,
} from "@wanderlot/ui";
import { LeaveCard } from "../components/LeaveCard.tsx";
import { BeforeYouGo, FlightsCard, GuideGrid, SectionTitle, StayCard, TransportList } from "../components/TripParts.tsx";
import { useAuth } from "../data/auth.tsx";
import { useSite } from "../data/store.tsx";
import { overridden, trustOf } from "../lib/view.ts";

const COPY = copy({
  es: {
    notReady: "La página del viaje aún no está lista",
    notReadyText: (organiser: string) => `${organiser} la publicará cuando el destino esté decidido y los precios comprobados.`,
    eyebrow: (plan: string) => `El viaje · ${plan}`,
    when: (from: string, to: string, n: number) => `Del ${from} al ${to} · ${n} ${n === 1 ? "noche" : "noches"}`,
    overridden: (organiser: string) => `La votación la ganó otro destino; ${organiser} lo explica en`,
    vote: "Votación",
    photoOf: (city: string) => `Foto de ${city}`,
    flights: "Vuelos",
    stay: "Alojamiento",
    getting: "Cómo llegar",
    approx: "Precios aproximados por persona: confírmalos antes de ir",
    toAirport: (home: string | null, iata: string) => `De ${home || "casa"} al aeropuerto (${iata})`,
    fromAirport: (iata: string) => `Del aeropuerto (${iata}) al alojamiento`,
    todo: "Qué hacer",
    food: "Qué comer",
    sights: "Sitios que ver",
    before: "Antes de ir",
    who: "Quién va",
    wroteIt: (by: string) => `Lo escribió ${by}`,
    credits: (by: string, web: boolean, date: string | null, organiser: string) =>
      `La guía y cómo llegar los preparó ${by}${web ? " buscando en la web" : " con lo que sabe, sin buscar en la web"}${date ? ` el ${date}` : ""} y los revisó ${organiser}. Los precios de vuelos y alojamiento son los comprobados; el resto, aproximados.`,
    seeVote: "Ver cómo quedó la votación",
    share: "Lo que pone cada uno",
    flight: "Vuelo",
    stayShare: "Alojamiento",
    accessShare: "Llegar al aeropuerto",
    weTake: "El que cogemos",
    tricount: "Abrir el Tricount",
  },
  en: {
    notReady: "The trip page isn't ready yet",
    notReadyText: (organiser: string) => `${organiser} will publish it once the destination is decided and the prices checked.`,
    eyebrow: (plan: string) => `The trip · ${plan}`,
    when: (from: string, to: string, n: number) => `${from} to ${to} · ${n} ${n === 1 ? "night" : "nights"}`,
    overridden: (organiser: string) => `Another destination won the vote; ${organiser} explains why in`,
    vote: "Vote",
    photoOf: (city: string) => `Photo of ${city}`,
    flights: "Flights",
    stay: "Where we're staying",
    getting: "Getting there",
    approx: "Rough prices per person: check them before you go",
    toAirport: (home: string | null, iata: string) => `From ${home || "home"} to the airport (${iata})`,
    fromAirport: (iata: string) => `From the airport (${iata}) to where we're staying`,
    todo: "Things to do",
    food: "What to eat",
    sights: "Places to see",
    before: "Before you go",
    who: "Who's going",
    wroteIt: (by: string) => `Written by ${by}`,
    credits: (by: string, web: boolean, date: string | null, organiser: string) =>
      `${by} put together the guide and how to get there${web ? " by searching the web" : " from what it knows, without searching the web"}${date ? ` on ${date}` : ""}, and ${organiser} checked them. Flight and stay prices are the checked ones; the rest are rough.`,
    seeVote: "See how the vote ended",
    share: "What each of us pays",
    flight: "Flight",
    stayShare: "Stay",
    accessShare: "Getting to the airport",
    weTake: "The one we take",
    tricount: "Open the Tricount",
  },
});


// El viaje (ROADMAP 2.2–2.4): once the destination is decided, the plan in
// one place: when, the flights and the stay with their checked prices, how
// to get there, a guide without spoilers, and each person's share.
export function ViajePage() {
  const { trip, destinations } = useSite();
  const t = useCopy(COPY);
  const { group } = useAuth();
  const destination = trip ? destinations.find((d) => d.id === trip.destinationId) : undefined;
  if (!trip || !destination) {
    return (
      <Main>
        <EmptyState title={t.notReady}>{t.notReadyText(group.organiserName)}</EmptyState>
      </Main>
    );
  }
  return <Trip trip={trip} d={destination} />;
}

function Trip({ trip, d }: { trip: TripPage; d: Destination }) {
  const { plan, members, now, result } = useSite();
  const t = useCopy(COPY);
  const { group } = useAuth();
  const { planId } = useParams();
  const stay = baseStay(d.stays);
  const flight = flightPriceCents(d);
  const stayShare = stayShareCents(d.stays, plan.nights, plan.partySize);
  const hero = d.photos[0];
  const [from, to] = [shortDate(plan.dateFrom), shortDate(plan.dateTo)];

  return (
    <Main className="gap-8">
      <section className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
        <div className="flex max-w-[820px] flex-col gap-2.5">
          <Eyebrow>{t.eyebrow(plan.name)}</Eyebrow>
          <Heading as="h1" size="display">
            {d.place.city}
          </Heading>
          <Text size="lg" tone="ink-2">
            {t.when(from, to, plan.nights)} · {d.place.country}
          </Text>
          {trip.intro && <Text size="lg">{trip.intro}</Text>}
          {overridden(result) && (
            <span className="text-sm text-muted">
              {t.overridden(group.organiserName)}{" "}
              <Link to={`/p/${planId}/votacion`} className="font-semibold">
                {t.vote}
              </Link>
              .
            </span>
          )}
        </div>
        <Money flight={flight} stayShare={stayShare} access={d.access?.cents ?? (trip.toAirportChosen === null ? null : (trip.toAirport[trip.toAirportChosen]?.priceCents ?? null))} tricountUrl={trip.tricountUrl} />
      </section>

      <LeaveCard />

      {hero && (
        <Photo src={standardImageUrl(hero.url)} alt={hero.alt} className="h-[220px] rounded-card sm:h-[300px]" aria-label={t.photoOf(d.place.city)} />
      )}

      <div className="flex flex-col gap-8 lg:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-8">
          <section aria-labelledby="vuelos" className="flex flex-col gap-3">
            <SectionTitle id="vuelos" icon={PlaneIcon} tint="mint" title={t.flights} aside={<ProvenanceBadge trust={trustOf(d, now)} size="md" label={researchLabel(d.provenance) ?? "short"} />} />
            <FlightsCard outbound={d.outbound} inbound={d.inbound} details={flightDetailsKnown(d)} cents={flight} />
          </section>

          {stay && (
            <section aria-labelledby="alojamiento" className="flex flex-col gap-3">
              <SectionTitle id="alojamiento" icon={HouseIcon} tint="sand" title={t.stay} />
              <StayCard
                name={stay.name}
                description={stay.description}
                url={stay.url}
                totalCents={stayTotalCents(stay, plan.nights)}
                shareCents={stayShare ?? 0}
                nights={plan.nights}
                address={trip.stay.address}
                checkIn={trip.stay.checkIn}
                checkOut={trip.stay.checkOut}
              />
            </section>
          )}

          {(trip.toAirport.length > 0 || trip.fromAirport.length > 0) && (
            <section aria-labelledby="como-llegar" className="flex flex-col gap-4">
              <SectionTitle id="como-llegar" icon={CarIcon} tint="sky" title={t.getting} aside={t.approx} />
              {trip.toAirport.length > 0 && <TransportList title={t.toAirport(trip.home, d.outbound.from)} options={trip.toAirport} chosen={trip.toAirportChosen} />}
              {trip.fromAirport.length > 0 && <TransportList title={t.fromAirport(d.place.iata)} options={trip.fromAirport} />}
            </section>
          )}

          <GuideGrid kind="todo" title={t.todo} id="que-hacer" items={trip.todo} price />
          <GuideGrid kind="food" title={t.food} id="que-comer" items={trip.food} />
          <GuideGrid kind="sights" title={t.sights} id="que-ver" items={trip.sights} />
        </div>

        <aside className="flex shrink-0 flex-col gap-[18px] lg:w-[396px]">
          {trip.beforeYouGo.length > 0 && <BeforeYouGo title={t.before} items={trip.beforeYouGo} />}
          <Card variant="muted" className="flex flex-col gap-3">
            <Heading as="h2" size="card">
              {t.who}
            </Heading>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {members.map((m) => (
                <li key={m.id} className="flex items-center gap-2.5 text-sm">
                  <Avatar initials={m.initials} name={m.name} tint={m.tint} size="xs" />
                  {m.name}
                </li>
              ))}
            </ul>
          </Card>
          <Card variant="muted" className="flex flex-col gap-2">
            <span className="flex items-center gap-2">
              <Badge tone="claude">{t.wroteIt(trip.by ?? "Claude")}</Badge>
            </span>
            <span className="text-[13px] text-ink-2">
              {t.credits(trip.by ?? "Claude", trip.sources.length > 0, trip.preparedAt ? longDate(trip.preparedAt) : null, group.organiserName)}
            </span>
            {trip.sources.length > 0 && (
              <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[13px]">
                {trip.sources.map((s) => (
                  <li key={s.url}>
                    <a href={s.url} target="_blank" rel="noreferrer">
                      {s.label}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Link to={`/p/${planId}/votacion`} className={buttonClasses({ variant: "secondary", block: true })}>
            {t.seeVote}
          </Link>
        </aside>
      </div>
    </Main>
  );
}

// Each person's share, and the group's Tricount for everything else.
function Money({ flight, stayShare, access, tricountUrl }: { flight: number; stayShare: number | null; access: number | null; tricountUrl: string | null }) {
  const t = useCopy(COPY);
  return (
    <Card variant="accent" className="flex shrink-0 flex-col gap-3 lg:w-[320px]" aria-label={t.share}>
      <span className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-bold">{t.share}</span>
        <span className="text-[30px] leading-none font-extrabold tracking-[-0.03em] tabular-nums">{euros(flight + (stayShare ?? 0) + (access ?? 0))}</span>
      </span>
      <dl className="m-0 flex flex-col gap-1 border-t border-accent/15 pt-2.5 text-[13px]">
        {(
          [
            [t.flight, flight],
            [t.stayShare, stayShare],
            [t.accessShare, access],
          ] as const
        ).map(([label, cents]) =>
          cents === null ? null : (
            <div key={label} className="flex justify-between gap-3">
              <dt>{label}</dt>
              <dd className="m-0 font-semibold tabular-nums">{euros(cents)}</dd>
            </div>
          ),
        )}
      </dl>
      {tricountUrl && (
        <a href={tricountUrl} target="_blank" rel="noreferrer" className={cn(buttonClasses({ variant: "secondary", size: "sm" }), "self-start")}>
          {t.tricount}
          <ExternalIcon size={14} />
        </a>
      )}
    </Card>
  );
}
