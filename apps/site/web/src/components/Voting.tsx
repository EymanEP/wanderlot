// Pieces of the Votación page.
import { Link } from "react-router";
import { euros, type Destination, type TallyResult } from "@wanderlot/core";
import type { Person } from "../data/store.tsx";
import { ArrowDownIcon, ArrowUpIcon, Avatar, Button, Card, Heading, IataTile, IconButton, LockIcon, Text, TrophyIcon, buttonClasses, cn } from "@wanderlot/ui";
import { flightLabel, pointsWord } from "../lib/view.ts";

function meta(d: Destination): string {
  return `${d.place.country} · ${euros(d.totalPerPersonCents)} por persona · ${flightLabel(d)}`;
}

function PointsBox({ points, strong }: { points: number; strong: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "flex h-[50px] w-14 shrink-0 flex-col items-center justify-center rounded-xl",
        strong ? "bg-accent text-white" : "bg-surface-3",
      )}
    >
      <span className="text-[19px] leading-none font-extrabold tabular-nums">{points}</span>
      <span className={cn("text-[9px] font-bold tracking-[0.06em]", !strong && "text-ink-2")}>{pointsWord(points)}</span>
    </div>
  );
}

export interface RankRowProps {
  destination: Destination;
  position: number; // 0-based
  count: number;
  readOnly: boolean;
  onUp: () => void;
  onDown: () => void;
  onRemove: () => void;
}

export function RankRow({ destination: d, position, count, readOnly, onUp, onDown, onRemove }: RankRowProps) {
  const points = 3 - position;
  const city = d.place.city;
  return (
    <li className={cn("flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl px-4 py-[13px] sm:flex-nowrap", position === 0 ? "ring-2 ring-accent" : "border border-line-soft")}>
      <PointsBox points={points} strong={position === 0} />
      {/* On phones the buttons drop to their own line. */}
      <div className="flex min-w-[calc(100%-72px)] flex-1 flex-col gap-0.5 sm:min-w-0">
        <span className="text-[17px] font-bold">
          {city}
          <span className="sr-only">, {points} {points === 1 ? "punto" : "puntos"}</span>
        </span>
        <span className="text-[13px] text-ink-2">{meta(d)}</span>
      </div>
      {!readOnly && (
        <div className="ml-auto flex shrink-0 gap-1.5">
          {position > 0 && (
            <IconButton label={`Subir ${city} a la ${position === 1 ? "primera" : "segunda"} posición`} onClick={onUp}>
              <ArrowUpIcon size={17} />
            </IconButton>
          )}
          {position < count - 1 && (
            <IconButton label={`Bajar ${city} a la ${position === 0 ? "segunda" : "tercera"} posición`} onClick={onDown}>
              <ArrowDownIcon size={17} />
            </IconButton>
          )}
          <Button onClick={onRemove}>Quitar</Button>
        </div>
      )}
    </li>
  );
}

export function OutsideRow({ destination: d, href, addPoints, readOnly, onAdd }: { destination: Destination; href: string; addPoints: number; readOnly: boolean; onAdd: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-tile bg-surface px-4 py-[13px] sm:flex-nowrap">
      <IataTile code={d.place.iata} />
      <div className="flex min-w-[calc(100%-72px)] flex-1 flex-col gap-0.5 sm:min-w-0">
        <span className="text-[17px] font-bold">{d.place.city}</span>
        <span className="text-[13px] text-ink-2">{meta(d)}</span>
      </div>
      <div className="ml-auto flex shrink-0 gap-2">
        <Link to={href} className={buttonClasses({ variant: "secondary" })}>
          Ver propuesta
        </Link>
        {!readOnly && (
          <Button variant="soft" onClick={onAdd}>
            Darle {addPoints} {addPoints === 1 ? "punto" : "puntos"}
          </Button>
        )}
      </div>
    </div>
  );
}

// While voting: every destination, alphabetical, no numbers (SPEC §4).
export function LockedScoreboard({ cities, deadline }: { cities: string[]; deadline: string }) {
  return (
    <Card variant="raised" className="flex flex-col gap-[13px]">
      <div className="flex items-center gap-2.5">
        <LockIcon size={18} />
        <Heading as="h2" size="card">
          Marcador cerrado
        </Heading>
      </div>
      <Text size="sm">Los puntos no se ven hasta que voten los seis o llegue el {deadline}. Así nadie vota a lo que parece que va ganando.</Text>
      <ul className="m-0 flex list-none flex-col gap-[7px] p-0">
        {[...cities].sort((a, b) => a.localeCompare(b, "es")).map((c) => (
          <li key={c} className="flex items-center justify-between gap-3 rounded-xl bg-surface-2 px-3.5 py-[11px]">
            <span className="text-sm font-semibold">{c}</span>
            <span className="text-base font-bold text-faint" aria-label="puntos ocultos">
              —
            </span>
          </li>
        ))}
      </ul>
      <span className="text-xs text-muted">En orden alfabético, para no dar pistas.</span>
    </Card>
  );
}

// After the close: the full count.
export function Scoreboard({ result, cityOf }: { result: TallyResult; cityOf: (id: string) => string }) {
  return (
    <Card variant="raised" className="flex flex-col gap-[13px]">
      <div className="flex items-center gap-2.5">
        <TrophyIcon size={18} />
        <Heading as="h2" size="card">
          Marcador
        </Heading>
      </div>
      <ol className="m-0 flex list-none flex-col gap-[7px] p-0">
        {result.rows.map((r) => {
          const win = r.id === result.winnerId;
          return (
            <li key={r.id} className={cn("flex items-center gap-3 rounded-xl px-3.5 py-[11px]", win ? "bg-accent-soft text-accent-strong" : "bg-surface-2")}>
              <span className="w-5 text-sm font-bold tabular-nums">{r.rank}.</span>
              <span className="flex-1 text-sm font-semibold">{cityOf(r.id)}</span>
              <span className="text-xs text-muted">{r.firsts} {r.firsts === 1 ? "primer puesto" : "primeros puestos"}</span>
              <span className="w-16 text-right text-base font-bold tabular-nums">{r.points} pts</span>
            </li>
          );
        })}
      </ol>
      <span className="text-xs text-muted">{result.rows.reduce((s, r) => s + r.points, 0)} puntos repartidos: 6 por cabeza.</span>
    </Card>
  );
}

export function Participation({
  members,
  voted,
  meId,
  closed,
  nudgeHref,
}: {
  members: Person[];
  voted: Set<string>;
  meId: string;
  closed: boolean;
  // A link that opens WhatsApp with a reminder for whoever hasn't voted.
  nudgeHref: (pending: Person[]) => string;
}) {
  const pending = members.filter((m) => !voted.has(m.id));
  return (
    <Card variant="muted" className="flex flex-col gap-3">
      <Heading as="h2" size="card">
        Quién ha votado
      </Heading>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {members.map((m) => {
          const has = voted.has(m.id);
          return (
            <li key={m.id} className="flex items-center gap-2.5">
              <Avatar initials={m.initials} tint={m.id === meId ? "accent" : has ? "white" : "empty"} size="xs" />
              <span className={cn("flex-1 text-sm", has ? "font-medium" : "text-ink-2")}>{m.name}</span>
              <span className={cn("text-xs", has ? "font-bold text-accent-strong" : "text-muted")}>{has ? "Votado" : "Sin votar"}</span>
            </li>
          );
        })}
      </ul>
      {!closed && pending.length > 0 && (
        <a href={nudgeHref(pending)} target="_blank" rel="noreferrer" className={buttonClasses({ variant: "secondary", block: true })}>
          Dar un toque a {pending.map((m) => m.name).join(" y ")}
        </a>
      )}
    </Card>
  );
}

export function BallotsList({ ballots, cityOf, members }: { ballots: { memberId: string; ranking: string[] }[]; cityOf: (id: string) => string; members: (id: string) => Person }) {
  return (
    <Card variant="muted" className="flex flex-col gap-3">
      <Heading as="h2" size="card">
        Cómo votó cada uno
      </Heading>
      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
        {ballots.map((b) => {
          const m = members(b.memberId);
          return (
            <li key={b.memberId} className="flex items-start gap-2.5">
              <Avatar initials={m.initials} tint="white" size="xs" />
              <span className="flex flex-1 flex-col">
                <span className="text-sm font-medium">{m.name}</span>
                <span className="text-xs text-muted">{b.ranking.map((id, i) => `${i + 1}. ${cityOf(id)}`).join(" · ")}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
