import { Link, useParams } from "react-router";
import { baseStay, euros, flightDetailsKnown, flightPriceCents, longDate, pointsFor, tripLabel } from "@wanderlot/core";
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
} from "@wanderlot/ui";
import { CommentComposer, CommentThread } from "../components/Comments.tsx";
import { FlightLegRow, FlightTotalRow, PhotoMosaic, SourcesCard, StayOption, VoteStatusCard } from "../components/DestinationParts.tsx";
import { useAuth } from "../data/auth.tsx";
import { useSite } from "../data/store.tsx";
import { memberOf, rankLabel, stayShareLabel, sourcesFor, trustOf } from "../lib/view.ts";

export function DestinoPage() {
  const site = useSite();
  const { planId, destinationId } = useParams();
  const { plan, destinations, members, me, now, myRanking, voted, result, closed } = site;
  const { group } = useAuth();
  const base = `/p/${planId}`;
  const d = destinations.find((x) => x.id === destinationId);

  if (!d) {
    return (
      <Main>
        <EmptyState
          title="Este destino no está en el plan"
          action={
            <Link to={base} className={buttonClasses({ variant: "primary" })}>
              Ver los destinos
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
  const month = new Intl.DateTimeFormat("es-ES", { month: "long", timeZone: "UTC" }).format(new Date(`${plan.dateFrom}T12:00:00Z`));
  const approved = d.approvedAt ? ` · aprobado por ${group.organiserName} el ${longDate(d.approvedAt)}` : "";
  const days = `del ${Number(plan.dateFrom.slice(8))} al ${Number(plan.dateTo.slice(8))} de ${month}`;

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
        subtitle={`${d.place.country} · ${days} · ${plan.partySize} personas${approved}`}
        actions={
          <>
            <div className="flex flex-col gap-px lg:items-end">
              <span className="text-[30px] font-extrabold tracking-[-0.03em] tabular-nums">{euros(d.totalPerPersonCents)}</span>
              <span className="text-[13px] text-muted">por persona · vuelo + alojamiento</span>
            </div>
            <Link to={`${base}/votacion`} className={buttonClasses({ variant: myPos >= 0 || closed ? "secondary" : "primary", size: "lg" })}>
              {closed ? "Ver el recuento" : myPos >= 0 ? `${rankLabel(myPos)} · cambiar` : "Darle mis puntos"}
            </Link>
          </>
        }
      />

      <PhotoMosaic city={d.place.city} photos={d.photos} landmarks={d.see.map((s) => s.title)} />

      <section aria-label="Resumen" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile label="Vuelo" value={flightDetailsKnown(d) ? tripLabel(d.outbound) : `${euros(flightPriceCents(d))} ida y vuelta`} />
        <StatTile label={`Alojamiento · ${plan.nights} ${plan.nights === 1 ? "noche" : "noches"}`} value={stayShareLabel(d, plan) ?? "—"} />
        <StatTile label={month[0]!.toUpperCase() + month.slice(1)} value={d.weather} />
        {trust === "unverified" ? (
          <StatTile label="Datos de vuelo" value="Los escribió Claude" tone="claude" />
        ) : (
          <StatTile label="Datos de vuelo" value={trust === "stale" ? "Precio por revisar" : d.provenance.kind === "organiser" ? "Comprobados a mano" : "Verificados con la API"} tone={trust === "stale" ? "neutral" : "accent"} />
        )}
      </section>

      <div className="flex flex-col gap-8 lg:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-[22px]">
          <section className="flex flex-col gap-2.5">
            <SectionHeader title="Vuelos" />
            <div className="flex flex-col gap-2">
              {/* Checked by hand: the round trip's price, and the times only
                  if they were checked too (from a screenshot). */}
              {flightDetailsKnown(d) && (
                <>
                  <FlightLegRow label="Ida" leg={d.outbound} price={d.provenance.kind !== "organiser"} />
                  <FlightLegRow label="Vuelta" leg={d.inbound} price={d.provenance.kind !== "organiser"} />
                </>
              )}
              {d.provenance.kind === "organiser" && <FlightTotalRow from={d.outbound.from} to={d.outbound.to} cents={flightPriceCents(d)} />}
            </div>
          </section>

          <section className="flex flex-col gap-2.5">
            <SectionHeader title="Dónde dormimos" />
            <div className="flex flex-col gap-2">
              {/* Checked by hand: the stay they're going with, not research's other options. */}
              {(d.provenance.kind === "organiser" ? d.stays.filter((s) => s === baseStay(d.stays)) : d.stays).map((s) => (
                <StayOption key={s.name} stay={s} nights={plan.nights} partySize={plan.partySize} />
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-3.5">
            <SectionHeader title="Qué hay allí" aside="Sin horarios: ya lo iremos viendo sobre la marcha" />
            <div className="grid gap-[26px] sm:grid-cols-2">
              <BulletList label="Qué hacer" items={d.todo} />
              <BulletList label="Qué ver" items={d.see} tone="neutral" />
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
          <SourcesCard lines={sourcesFor(d)} />
        </aside>
      </div>

      <section id="comentarios" aria-labelledby="comentarios-titulo" className="flex scroll-mt-28 flex-col gap-3.5">
        <SectionHeader id="comentarios-titulo" title={`Comentarios · ${comments.length}`} aside="Solo los vemos nosotros seis" />
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
