import { Link, useParams } from "react-router";
import {
  baseStay,
  duration,
  euros,
  flightDetailsKnown,
  flightPriceCents,
  longDate,
  researchLabel,
  shortDate,
  standardImageUrl,
  stayShareCents,
  type Destination,
  type GuideItem,
  type TransportMode,
  type TransportOption,
  type TripPage,
} from "@wanderlot/core";
import {
  Avatar,
  Badge,
  Card,
  EmptyState,
  ExternalIcon,
  Eyebrow,
  Heading,
  Main,
  Photo,
  ProvenanceBadge,
  SectionHeader,
  Text,
  buttonClasses,
  cn,
} from "@wanderlot/ui";
import { LeaveCard } from "../components/LeaveCard.tsx";
import { FlightLegRow, FlightTotalRow, StayOption } from "../components/DestinationParts.tsx";
import { useAuth } from "../data/auth.tsx";
import { useSite } from "../data/store.tsx";
import { overridden, trustOf } from "../lib/view.ts";

export const MODE_LABEL: Record<TransportMode, string> = {
  car: "Coche",
  bus: "Autobús",
  train: "Tren",
  metro: "Metro",
  taxi: "Taxi",
  shuttle: "Lanzadera",
  walk: "Andando",
  other: "Otro",
};

// El viaje (ROADMAP 2.2–2.4): once the destination is decided, the plan in
// one place: when, the flights and the stay with their checked prices, how
// to get there, a guide without spoilers, and each person's share.
export function ViajePage() {
  const { trip, destinations } = useSite();
  const { group } = useAuth();
  const destination = trip ? destinations.find((d) => d.id === trip.destinationId) : undefined;
  if (!trip || !destination) {
    return (
      <Main>
        <EmptyState title="La página del viaje aún no está lista">{group.organiserName} la publicará cuando el destino esté decidido y los precios comprobados.</EmptyState>
      </Main>
    );
  }
  return <Trip trip={trip} d={destination} />;
}

function Trip({ trip, d }: { trip: TripPage; d: Destination }) {
  const { plan, members, now, result } = useSite();
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
          <Eyebrow>El viaje · {plan.name}</Eyebrow>
          <Heading as="h1" size="display">
            {d.place.city}
          </Heading>
          <Text size="lg" tone="ink-2">
            Del {from} al {to} · {plan.nights} {plan.nights === 1 ? "noche" : "noches"} · {d.place.country}
          </Text>
          {trip.intro && <Text size="lg">{trip.intro}</Text>}
          {overridden(result) && (
            <span className="text-sm text-muted">
              La votación la ganó otro destino; {group.organiserName} lo explica en{" "}
              <Link to={`/p/${planId}/votacion`} className="font-semibold">
                Votación
              </Link>
              .
            </span>
          )}
        </div>
        <Money flight={flight} stayShare={stayShare} tricountUrl={trip.tricountUrl} />
      </section>

      <LeaveCard />

      {hero && (
        <Photo src={standardImageUrl(hero.url)} alt={hero.alt} className="h-[220px] rounded-card sm:h-[300px]" aria-label={`Foto de ${d.place.city}`} />
      )}

      <div className="flex flex-col gap-8 lg:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-8">
          <section aria-labelledby="vuelos" className="flex flex-col gap-3">
            <SectionHeader id="vuelos" title="Vuelos" aside={<ProvenanceBadge trust={trustOf(d, now)} size="md" label={researchLabel(d.provenance) ?? "short"} />} />
            {flightDetailsKnown(d) ? (
              <>
                <FlightLegRow label="Ida" leg={d.outbound} price={false} />
                <FlightLegRow label="Vuelta" leg={d.inbound} price={false} />
                <span className="text-[13px] text-muted">{euros(flight)} por persona, ida y vuelta.</span>
              </>
            ) : (
              <FlightTotalRow from={d.outbound.from} to={d.inbound.from} cents={flight} />
            )}
          </section>

          {stay && (
            <section aria-labelledby="alojamiento" className="flex flex-col gap-3">
              <SectionHeader id="alojamiento" title="Alojamiento" />
              <StayOption stay={{ ...stay, recommended: false }} nights={plan.nights} partySize={plan.partySize} />
              {(trip.stay.address || trip.stay.checkIn || trip.stay.checkOut) && (
                <dl className="m-0 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-[auto_1fr]">
                  {trip.stay.address && (
                    <>
                      <dt className="font-bold text-muted">Dirección</dt>
                      <dd className="m-0">
                        <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trip.stay.address)}`} target="_blank" rel="noreferrer">
                          {trip.stay.address}
                        </a>
                      </dd>
                    </>
                  )}
                  {trip.stay.checkIn && (
                    <>
                      <dt className="font-bold text-muted">Entrada</dt>
                      <dd className="m-0">{trip.stay.checkIn}</dd>
                    </>
                  )}
                  {trip.stay.checkOut && (
                    <>
                      <dt className="font-bold text-muted">Salida</dt>
                      <dd className="m-0">{trip.stay.checkOut}</dd>
                    </>
                  )}
                </dl>
              )}
            </section>
          )}

          {(trip.toAirport.length > 0 || trip.fromAirport.length > 0) && (
            <section aria-labelledby="como-llegar" className="flex flex-col gap-4">
              <SectionHeader id="como-llegar" title="Cómo llegar" aside="Precios aproximados por persona: confírmalos antes de ir" />
              {trip.toAirport.length > 0 && <Transport title={`De ${trip.home || "casa"} al aeropuerto (${d.outbound.from})`} options={trip.toAirport} />}
              {trip.fromAirport.length > 0 && <Transport title={`Del aeropuerto (${d.place.iata}) al alojamiento`} options={trip.fromAirport} />}
            </section>
          )}

          <Guide title="Qué hacer" id="que-hacer" items={trip.todo} price />
          <Guide title="Qué comer" id="que-comer" items={trip.food} />
          <Guide title="Sitios que ver" id="que-ver" items={trip.sights} />
        </div>

        <aside className="flex shrink-0 flex-col gap-[18px] lg:w-[396px]">
          {trip.beforeYouGo.length > 0 && (
            <Card variant="muted" className="flex flex-col gap-3" aria-labelledby="antes">
              <Heading id="antes" as="h2" size="card">
                Antes de ir
              </Heading>
              <dl className="m-0 flex flex-col gap-2.5">
                {trip.beforeYouGo.map((b) => (
                  <div key={b.title} className="flex flex-col gap-0.5">
                    <dt className="text-sm font-bold">{b.title}</dt>
                    <dd className="m-0 text-[13px] text-ink-2">{b.detail}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          )}
          <Card variant="muted" className="flex flex-col gap-3">
            <Heading as="h2" size="card">
              Quién va
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
              <Badge tone="claude">Lo escribió {trip.by ?? "Claude"}</Badge>
            </span>
            <span className="text-[13px] text-ink-2">
              La guía y cómo llegar los preparó {trip.by ?? "Claude"}
              {trip.sources.length > 0 ? " buscando en la web" : " con lo que sabe, sin buscar en la web"}
              {trip.preparedAt ? ` el ${longDate(trip.preparedAt)}` : ""} y los revisó {group.organiserName}. Los precios
              de vuelos y alojamiento son los comprobados; el resto, aproximados.
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
            Ver cómo quedó la votación
          </Link>
        </aside>
      </div>
    </Main>
  );
}

// Each person's share, and the group's Tricount for everything else.
function Money({ flight, stayShare, tricountUrl }: { flight: number; stayShare: number | null; tricountUrl: string | null }) {
  return (
    <Card variant="accent" className="flex shrink-0 flex-col gap-1.5 lg:w-[300px]" aria-label="Lo que pone cada uno">
      <span className="text-[13px] font-bold">Lo que pone cada uno</span>
      <span className="text-[28px] font-extrabold tracking-[-0.03em] tabular-nums">{euros(flight + (stayShare ?? 0))}</span>
      <span className="text-[13px]">
        Vuelo {euros(flight)}
        {stayShare !== null ? ` · alojamiento ${euros(stayShare)}` : ""}
      </span>
      {tricountUrl && (
        <a href={tricountUrl} target="_blank" rel="noreferrer" className={cn(buttonClasses({ variant: "secondary", size: "sm" }), "mt-2 self-start")}>
          Abrir el Tricount
          <ExternalIcon size={14} />
        </a>
      )}
    </Card>
  );
}

function Transport({ title, options }: { title: string; options: TransportOption[] }) {
  return (
    <div className="flex flex-col gap-2">
      <Heading as="h3" size="card">
        {title}
      </Heading>
      <ul aria-label={title} className="m-0 flex list-none flex-col gap-2 p-0">
        {options.map((o) => (
          <li key={o.title} className="flex flex-wrap items-center gap-x-[18px] gap-y-1.5 rounded-tile border border-line-soft px-[18px] py-3.5">
            <Badge tone="neutral">{MODE_LABEL[o.mode]}</Badge>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-[15px] font-bold">{o.title}</span>
              {o.detail && <span className="text-[13px] text-ink-2">{o.detail}</span>}
            </span>
            <span className="flex shrink-0 flex-col items-end">
              {o.priceCents !== null && <span className="text-base font-bold tabular-nums">≈ {euros(o.priceCents)}</span>}
              {o.minutes !== null && <span className="text-xs text-muted">{duration(o.minutes)}</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Guide({ title, id, items, price }: { title: string; id: string; items: GuideItem[]; price?: boolean }) {
  if (!items.length) return null;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <SectionHeader id={id} title={title} />
      <ul className="m-0 grid list-none gap-2.5 p-0 sm:grid-cols-2">
        {items.map((it) => (
          <li key={it.title}>
            <Card variant="raised" padding="sm" className="flex h-full flex-col gap-1">
              <span className="flex items-start justify-between gap-3">
                <span className="text-[15px] font-bold">{it.title}</span>
                {price && typeof it.priceCents === "number" && <span className="shrink-0 text-sm font-bold tabular-nums">≈ {euros(it.priceCents)}</span>}
              </span>
              {it.detail && <span className="text-[13px] text-ink-2">{it.detail}</span>}
              {it.where && <span className="text-[13px] text-muted">Dónde: {it.where}</span>}
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}
