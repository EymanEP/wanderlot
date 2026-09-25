// The building blocks of a destination page.
import { Link } from "react-router";
import { euros, eurosGrouped, localTime, shortDate, stopsLabel, stayTotalCents, type FlightLeg, type Stay } from "@wanderlot/core";
import { Button, Card, Heading, LockIcon, Photo, Text, buttonClasses, cn, useToast } from "@wanderlot/ui";

export function PhotoMosaic({ hero, tiles, count }: { hero: string; tiles: string[]; count: number }) {
  const toast = useToast();
  return (
    <section aria-label="Fotos" className="grid h-[240px] grid-cols-2 grid-rows-2 gap-2 sm:h-[312px] md:grid-cols-4">
      <Photo label={hero} className="col-span-2 row-span-2 rounded-2xl p-4 max-md:row-span-1" />
      {tiles.slice(0, 3).map((t, i) => (
        <Photo key={t} label={t} labelPosition="center" className={cn("rounded-xl", i > 0 && "max-md:hidden")} />
      ))}
      <Photo
        className="rounded-xl p-3"
        bottom={
          <Button size="sm" className="shadow-chip" onClick={() => toast("Las fotos llegarán cuando elijamos las definitivas")}>
            Ver las {count} fotos
          </Button>
        }
      />
    </section>
  );
}

// "Ida  07:20 MAD → 09:55 NAP  sáb 7 nov · Ryanair FR 8564 · directo  52 €"
export function FlightLegRow({ label, leg }: { label: string; leg: FlightLeg }) {
  return (
    <div className="flex flex-wrap items-center gap-x-[18px] gap-y-1 rounded-tile border border-line-soft px-[18px] py-3.5">
      <span className="w-14 shrink-0 text-[13px] font-bold text-muted">{label}</span>
      <span className="shrink-0 text-[15px] font-bold tabular-nums">
        {localTime(leg.departAt)} {leg.from} → {localTime(leg.arriveAt)} {leg.to}
      </span>
      <span className="min-w-0 flex-1 text-sm text-ink-2 max-sm:order-last max-sm:basis-full max-sm:pl-[74px]">
        {shortDate(leg.departAt)} · {leg.carrier} {leg.flightNumber} · {stopsLabel(leg.stops).toLowerCase()}
      </span>
      <span className="ml-auto shrink-0 text-base font-bold tabular-nums">{euros(leg.priceCents)}</span>
    </div>
  );
}

export function StayOption({ stay, nights, partySize }: { stay: Stay; nights: number; partySize: number }) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-[18px] gap-y-2 rounded-tile px-[18px] py-3.5",
        stay.recommended ? "ring-2 ring-accent" : "border border-line-soft",
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <span className="text-[15px] font-bold">
          {stay.name}
          {stay.recommended && <span className="sr-only"> (recomendado)</span>}
        </span>
        {stay.description && <span className="text-[13px] text-ink-2">{stay.description}</span>}
      </div>
      <div className="flex shrink-0 flex-col items-end">
        <span className="text-base font-bold tabular-nums">{eurosGrouped(stayTotalCents(stay, nights))}</span>
        <span className="text-xs text-muted">{euros(Math.round(stay.nightlyCents / partySize))} por persona y noche</span>
      </div>
    </div>
  );
}

export interface VoteStatusCardProps {
  closed: boolean;
  deadline: string; // "10 de octubre"
  cast: number;
  of: number;
  myPoints: number; // 0 if not in my ranking
  points?: number; // the destination's total, once closed
  votingHref: string;
}

export function VoteStatusCard({ closed, deadline, cast, of, myPoints, points, votingHref }: VoteStatusCardProps) {
  return (
    <Card variant="raised" className="flex flex-col gap-[13px]">
      <div className="flex items-center gap-2.5">
        <LockIcon size={18} />
        <Heading as="h3" size="card">
          {closed ? "Votación cerrada" : "Votación en curso"}
        </Heading>
      </div>
      <Text size="sm">
        {closed
          ? `Se llevó ${points ?? 0} puntos de 36.`
          : `Los puntos de cada destino se ven cuando cierre, el ${deadline}. Van ${cast} de ${of} votos.`}
      </Text>
      <div className="flex items-center justify-between gap-3 border-t border-line-faint pt-[13px]">
        <span className="text-[13px] text-ink-2">{myPoints ? `Le diste ${myPoints} ${myPoints === 1 ? "punto" : "puntos"}` : "Tú no le has dado puntos"}</span>
        <Link to={votingHref} className={buttonClasses({ variant: "soft", size: "sm" })}>
          {closed ? "Ver el recuento" : myPoints ? "Cambiar" : "Dárselos"}
        </Link>
      </div>
    </Card>
  );
}

export function SourcesCard({ lines }: { lines: string[] }) {
  return (
    <Card variant="muted" className="flex flex-col gap-[9px]">
      <Heading as="h3" size="card">
        De dónde salen los números
      </Heading>
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-[13px] text-ink-2">
        {lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </Card>
  );
}
