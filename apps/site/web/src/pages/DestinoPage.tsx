import { Link, useParams } from "react-router";
import { baseStay, copy, euros, flightDetailsKnown, flightPriceCents, checkedLabel, longDate, monthName, pointsFor, researchLabel, tripLabel, datesOf, rangeLabel } from "@wanderlot/core";
import {
  BulletList,
  Card,
  ChevronLeftIcon,
  EmptyState,
  Main,
  PageHeader,
  ProsCons,
  SectionHeader,
  StatTile,
  buttonClasses,
  useCopy,
} from "@wanderlot/ui";
import { CommentComposer, CommentThread } from "../components/Comments.tsx";
import { AccessRow, FlightLegRow, FlightTotalRow, PhotoMosaic, SourcesCard, StayOption, VoteStatusCard } from "../components/DestinationParts.tsx";
import { useAuth } from "../data/auth.tsx";
import { useSite } from "../data/store.tsx";
import { groupWord, memberOf, rankLabel, stayShareLabel, sourcesFor, trustOf } from "../lib/view.ts";

const COPY = copy({
  es: {
    missing: "Este destino no está en el plan",
    seeAll: "Ver los destinos",
    approved: (organiser: string, date: string) => ` · aprobado por ${organiser} el ${date}`,
    days: (from: number, to: number, month: string) => `del ${from} al ${to} de ${month}`,
    people: (n: number) => `${n} personas`,
    perPerson: "por persona · vuelo + alojamiento",
    perPersonAccess: "por persona · vuelo, alojamiento y llegar al aeropuerto",
    count: "Ver el recuento",
    change: (rank: string) => `${rank} · cambiar`,
    give: "Darle mis puntos",
    summary: "Resumen",
    flight: "Vuelo",
    returnPrice: (price: string) => `${price} ida y vuelta`,
    stay: (n: number) => `Alojamiento · ${n} ${n === 1 ? "noche" : "noches"}`,
    flightData: "Datos de vuelo",
    // "Datos de vuelo": the labels agree with it, in the plural.
    research: (label: string) => label.replace("Lo escribió", "Los escribió").replace("Estimado", "Estimados"),
    checked: (label: string) => label.replace("Visto", "Vistos").replace("Comprobado", "Comprobados"),
    stale: "Precio por revisar",
    api: "Verificados con la API",
    flights: "Vuelos",
    out: "Ida",
    back: "Vuelta",
    sleep: "Dónde dormimos",
    there: "Qué hay allí",
    noTimes: "Sin horarios: ya lo iremos viendo sobre la marcha",
    todo: "Qué hacer",
    see: "Qué ver",
    comments: (n: number) => `Comentarios · ${n}`,
    private: (n: number, word: string) => `Solo los vemos nosotros${n > 1 ? ` ${word}` : ""}`,
  },
  en: {
    missing: "This destination isn't in the plan",
    seeAll: "See the destinations",
    approved: (organiser: string, date: string) => ` · approved by ${organiser} on ${date}`,
    days: (from: number, to: number, month: string) => `${from}–${to} ${month}`,
    people: (n: number) => `${n} people`,
    perPerson: "per person · flight + stay",
    perPersonAccess: "per person · flight, stay and getting to the airport",
    count: "See the count",
    change: (rank: string) => `${rank} · change`,
    give: "Give it my points",
    summary: "Summary",
    flight: "Flight",
    returnPrice: (price: string) => `${price} return`,
    stay: (n: number) => `Stay · ${n} ${n === 1 ? "night" : "nights"}`,
    flightData: "Flight details",
    research: (label: string) => label,
    checked: (label: string) => label,
    stale: "Price to be checked",
    api: "Verified with the API",
    flights: "Flights",
    out: "Out",
    back: "Back",
    sleep: "Where we're staying",
    there: "What's there",
    noTimes: "No timetable: we'll see as we go",
    todo: "Things to do",
    see: "Things to see",
    comments: (n: number) => `Comments · ${n}`,
    private: (n: number, word: string) => (n > 1 ? `Only the ${word} of us can see these` : "Only we can see these"),
  },
});

export function DestinoPage() {
  const site = useSite();
  const t = useCopy(COPY);
  const { planId, destinationId } = useParams();
  const { plan, destinations, members, me, now, myRanking, voted, result, closed } = site;
  const { group } = useAuth();
  const base = `/p/${planId}`;
  const d = destinations.find((x) => x.id === destinationId);

  if (!d) {
    return (
      <Main>
        <EmptyState
          title={t.missing}
          action={
            <Link to={base} className={buttonClasses({ variant: "primary" })}>
              {t.seeAll}
            </Link>
          }
        />
      </Main>
    );
  }

  const myPos = myRanking.indexOf(d.id);
  const myPoints = myPos >= 0 ? pointsFor(myPos) : 0;
  const trust = trustOf(d, now);
  const comments = site.comments.filter((c) => c.destinationId === d.id);
  // Its own dates, when the trip decides them with the place (ROADMAP 2.7).
  const own = datesOf(plan, d);
  const month = monthName(own.dateFrom);
  const approved = d.approvedAt ? t.approved(group.organiserName, longDate(d.approvedAt)) : "";
  // "del 7 al 14 de noviembre", or "28 nov – 3 dic" across two months.
  const days = own.dateFrom.slice(0, 7) === own.dateTo.slice(0, 7) ? t.days(Number(own.dateFrom.slice(8)), Number(own.dateTo.slice(8)), month) : rangeLabel(own.dateFrom, own.dateTo);

  return (
    <Main className="gap-7">
      <PageHeader
        size="hero"
        back={
          <Link to={base} className="flex w-fit items-center gap-[7px] text-sm font-semibold no-underline">
            <ChevronLeftIcon size={15} strokeWidth={2.1} />
            {plan.name}
          </Link>
        }
        title={d.place.city}
        subtitle={`${d.place.country} · ${days} · ${t.people(plan.partySize)}${approved}`}
        actions={
          <>
            <div className="flex flex-col gap-px lg:items-end">
              <span className="text-[30px] font-extrabold tracking-[-0.03em] tabular-nums">{euros(d.totalPerPersonCents)}</span>
              <span className="text-[13px] text-muted">{d.access ? t.perPersonAccess : t.perPerson}</span>
            </div>
            <Link to={`${base}/votacion`} className={buttonClasses({ variant: myPos >= 0 || closed ? "secondary" : "primary", size: "lg" })}>
              {closed ? t.count : myPos >= 0 ? t.change(rankLabel(myPos)) : t.give}
            </Link>
          </>
        }
      />

      <PhotoMosaic city={d.place.city} photos={d.photos} landmarks={d.see.map((s) => s.title)} />

      <section aria-label={t.summary} className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile label={t.flight} value={flightDetailsKnown(d) ? tripLabel(d.outbound) : t.returnPrice(euros(flightPriceCents(d)))} />
        <StatTile label={t.stay(plan.nights)} value={stayShareLabel(d, plan) ?? "—"} />
        <StatTile label={month[0]!.toUpperCase() + month.slice(1)} value={d.weather} />
        {trust === "unverified" ? (
          <StatTile label={t.flightData} value={t.research(researchLabel(d.provenance)!)} tone="claude" />
        ) : (
          <StatTile label={t.flightData} value={trust === "stale" ? t.stale : d.provenance.kind === "organiser" ? t.checked(checkedLabel(d.provenance)!) : t.api} tone={trust === "stale" ? "neutral" : "accent"} />
        )}
      </section>

      <div className="flex flex-col gap-8 lg:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-[22px]">
          <section className="flex flex-col gap-2.5">
            <SectionHeader title={t.flights} />
            <div className="flex flex-col gap-2">
              {d.access && <AccessRow access={d.access} airport={d.outbound.from} />}
              {/* Checked by hand: the round trip's price, and the times only
                  if they were checked too (from a screenshot). */}
              {flightDetailsKnown(d) && (
                <>
                  <FlightLegRow label={t.out} leg={d.outbound} price={d.provenance.kind !== "organiser"} />
                  <FlightLegRow label={t.back} leg={d.inbound} price={d.provenance.kind !== "organiser"} />
                </>
              )}
              {d.provenance.kind === "organiser" && <FlightTotalRow from={d.outbound.from} to={d.outbound.to} cents={flightPriceCents(d)} />}
            </div>
          </section>

          <section className="flex flex-col gap-2.5">
            <SectionHeader title={t.sleep} />
            <div className="flex flex-col gap-2">
              {/* Checked by hand: the stay they're going with, not research's other options. */}
              {(d.provenance.kind === "organiser" ? d.stays.filter((s) => s === baseStay(d.stays)) : d.stays).map((s) => (
                <StayOption key={s.name} stay={s} nights={plan.nights} partySize={plan.partySize} />
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-3.5">
            <SectionHeader title={t.there} aside={t.noTimes} />
            <div className="grid gap-[26px] sm:grid-cols-2">
              <BulletList label={t.todo} items={d.todo} />
              <BulletList label={t.see} items={d.see} tone="neutral" />
            </div>
          </section>
        </div>

        <aside className="flex shrink-0 flex-col gap-4 lg:w-[380px]">
          <VoteStatusCard
            closed={closed}
            deadline={plan.voteDeadline ? longDate(plan.voteDeadline) : null}
            cast={voted.size}
            of={plan.partySize}
            myPoints={myPoints}
            {...(result ? { points: result.rows.find((r) => r.id === d.id)?.points ?? 0 } : {})}
            votingHref={`${base}/votacion`}
          />
          <Card variant="raised">
            <ProsCons pros={d.pros} cons={d.cons} />
          </Card>
          <SourcesCard lines={sourcesFor(d, month)} />
        </aside>
      </div>

      <section id="comentarios" aria-labelledby="comentarios-titulo" className="flex scroll-mt-28 flex-col gap-3.5">
        <SectionHeader id="comentarios-titulo" title={t.comments(comments.length)} aside={t.private(plan.partySize, groupWord(plan.partySize))} />
        <CommentComposer me={me} onSubmit={(body) => site.addComment(d.id, body)} />
        <CommentThread
          comments={comments}
          members={(id) => memberOf(members, id)}
          me={me}
          now={now}
          liked={site.liked}
          onLike={site.toggleLike}
          onReply={(parentId, body) => site.addComment(d.id, body, parentId)}
        />
      </section>
    </Main>
  );
}
