// Pieces of the Votación page.
import { Link } from "react-router";
import { copy, currentLocale, euros, pick, type Destination, type TallyResult } from "@wanderlot/core";
import type { Person } from "../data/store.tsx";
import { ArrowDownIcon, ArrowUpIcon, Avatar, Button, Card, Heading, IataTile, IconButton, LockIcon, Text, TrophyIcon, buttonClasses, cn, useCopy } from "@wanderlot/ui";
import { flightLabel, groupWord, pointsWord } from "../lib/view.ts";

const COPY = copy({
  es: {
    perPerson: "por persona",
    points: (n: number) => `${n} ${n === 1 ? "punto" : "puntos"}`,
    up: (city: string, position: number) => `Subir ${city} a la ${position === 1 ? "primera" : "segunda"} posición`,
    down: (city: string, position: number) => `Bajar ${city} a la ${position === 0 ? "segunda" : "tercera"} posición`,
    remove: "Quitar",
    see: "Ver propuesta",
    give: (n: number) => `Darle ${n} ${n === 1 ? "punto" : "puntos"}`,
    locked: "Marcador cerrado",
    lockedText: (n: number, word: string, deadline: string) =>
      `Los puntos no se ven hasta que votéis ${n === 1 ? "" : `los ${word} `}o llegue el ${deadline}. Así nadie vota a lo que parece que va ganando.`,
    hidden: "puntos ocultos",
    alphabetical: "En orden alfabético, para no dar pistas.",
    scoreboard: "Marcador",
    goingHere: "Vamos aquí",
    firsts: (n: number) => `${n} ${n === 1 ? "primer puesto" : "primeros puestos"}`,
    pts: (n: number) => `${n} pts`,
    total: (n: number) => `${n} puntos repartidos: 6 por cabeza.`,
    whoVoted: "Quién ha votado",
    voted: "Votado",
    notVoted: "Sin votar",
    nudge: (names: string) => `Dar un toque a ${names}`,
    and: " y ",
    ballots: "Cómo votó cada uno",
  },
  en: {
    perPerson: "per person",
    points: (n: number) => `${n} ${n === 1 ? "point" : "points"}`,
    up: (city: string, position: number) => `Move ${city} up to ${position === 1 ? "first" : "second"} place`,
    down: (city: string, position: number) => `Move ${city} down to ${position === 0 ? "second" : "third"} place`,
    remove: "Remove",
    see: "See the idea",
    give: (n: number) => `Give it ${n} ${n === 1 ? "point" : "points"}`,
    locked: "Scores hidden",
    lockedText: (n: number, word: string, deadline: string) =>
      `Nobody sees the points until ${n === 1 ? "you vote" : `all ${word} of you vote`} or ${deadline} comes. That way nobody votes for whatever seems to be winning.`,
    hidden: "points hidden",
    alphabetical: "In alphabetical order, to give nothing away.",
    scoreboard: "Scores",
    goingHere: "We're going here",
    firsts: (n: number) => `${n} ${n === 1 ? "first place" : "first places"}`,
    pts: (n: number) => `${n} pts`,
    total: (n: number) => `${n} points given: 6 each.`,
    whoVoted: "Who has voted",
    voted: "Voted",
    notVoted: "Not yet",
    nudge: (names: string) => `Nudge ${names}`,
    and: " and ",
    ballots: "How everyone voted",
  },
});

function meta(d: Destination): string {
  return `${d.place.country} · ${euros(d.totalPerPersonCents)} ${pick(COPY).perPerson} · ${flightLabel(d)}`;
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
  const t = useCopy(COPY);
  const points = 3 - position;
  const city = d.place.city;
  return (
    <li className={cn("flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl px-4 py-[13px] sm:flex-nowrap", position === 0 ? "ring-2 ring-accent" : "border border-line-soft")}>
      <PointsBox points={points} strong={position === 0} />
      {/* On phones the buttons drop to their own line. */}
      <div className="flex min-w-[calc(100%-72px)] flex-1 flex-col gap-0.5 sm:min-w-0">
        <span className="text-[17px] font-bold">
          {city}
          <span className="sr-only">, {t.points(points)}</span>
        </span>
        <span className="text-[13px] text-ink-2">{meta(d)}</span>
      </div>
      {!readOnly && (
        <div className="ml-auto flex shrink-0 gap-1.5">
          {position > 0 && (
            <IconButton label={t.up(city, position)} onClick={onUp}>
              <ArrowUpIcon size={17} />
            </IconButton>
          )}
          {position < count - 1 && (
            <IconButton label={t.down(city, position)} onClick={onDown}>
              <ArrowDownIcon size={17} />
            </IconButton>
          )}
          <Button onClick={onRemove}>{t.remove}</Button>
        </div>
      )}
    </li>
  );
}

export function OutsideRow({ destination: d, href, addPoints, readOnly, onAdd }: { destination: Destination; href: string; addPoints: number; readOnly: boolean; onAdd: () => void }) {
  const t = useCopy(COPY);
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-tile bg-surface px-4 py-[13px] sm:flex-nowrap">
      <IataTile code={d.place.iata} />
      <div className="flex min-w-[calc(100%-72px)] flex-1 flex-col gap-0.5 sm:min-w-0">
        <span className="text-[17px] font-bold">{d.place.city}</span>
        <span className="text-[13px] text-ink-2">{meta(d)}</span>
      </div>
      <div className="ml-auto flex shrink-0 gap-2">
        <Link to={href} className={buttonClasses({ variant: "secondary" })}>
          {t.see}
        </Link>
        {!readOnly && (
          <Button variant="soft" onClick={onAdd}>
            {t.give(addPoints)}
          </Button>
        )}
      </div>
    </div>
  );
}

// While voting: every destination, alphabetical, no numbers (SPEC §4).
export function LockedScoreboard({ cities, deadline, partySize }: { cities: string[]; deadline: string; partySize: number }) {
  const t = useCopy(COPY);
  return (
    <Card variant="raised" className="flex flex-col gap-[13px]">
      <div className="flex items-center gap-2.5">
        <LockIcon size={18} />
        <Heading as="h2" size="card">
          {t.locked}
        </Heading>
      </div>
      <Text size="sm">{t.lockedText(partySize, groupWord(partySize), deadline)}</Text>
      <ul className="m-0 flex list-none flex-col gap-[7px] p-0">
        {[...cities].sort((a, b) => a.localeCompare(b, currentLocale())).map((c) => (
          <li key={c} className="flex items-center justify-between gap-3 rounded-xl bg-surface-2 px-3.5 py-[11px]">
            <span className="text-sm font-semibold">{c}</span>
            <span className="text-base font-bold text-faint" aria-label={t.hidden}>
              —
            </span>
          </li>
        ))}
      </ul>
      <span className="text-xs text-muted">{t.alphabetical}</span>
    </Card>
  );
}

// After the close: the full count.
// The vote's count as it was. When the group then went somewhere else, that
// row says so; the vote's own winner stays highlighted.
export function Scoreboard({ result, cityOf }: { result: TallyResult & { voteWinnerId?: string | null }; cityOf: (id: string) => string }) {
  const t = useCopy(COPY);
  const voteWinner = result.voteWinnerId === undefined ? result.winnerId : result.voteWinnerId;
  return (
    <Card variant="raised" className="flex flex-col gap-[13px]">
      <div className="flex items-center gap-2.5">
        <TrophyIcon size={18} />
        <Heading as="h2" size="card">
          {t.scoreboard}
        </Heading>
      </div>
      <ol className="m-0 flex list-none flex-col gap-[7px] p-0">
        {result.rows.map((r) => {
          const win = r.id === voteWinner;
          const chosen = r.id === result.winnerId && r.id !== voteWinner && voteWinner !== null;
          return (
            <li key={r.id} className={cn("flex items-center gap-3 rounded-xl px-3.5 py-[11px]", win ? "bg-accent-soft text-accent-strong" : "bg-surface-2")}>
              <span className="w-5 text-sm font-bold tabular-nums">{r.rank}.</span>
              <span className="flex-1 text-sm font-semibold">
                {cityOf(r.id)}
                {chosen && <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-white">{t.goingHere}</span>}
              </span>
              <span className="text-xs text-muted">{t.firsts(r.firsts)}</span>
              <span className="w-16 text-right text-base font-bold tabular-nums">{t.pts(r.points)}</span>
            </li>
          );
        })}
      </ol>
      <span className="text-xs text-muted">{t.total(result.rows.reduce((s, r) => s + r.points, 0))}</span>
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
  const t = useCopy(COPY);
  const pending = members.filter((m) => !voted.has(m.id));
  return (
    <Card variant="muted" className="flex flex-col gap-3">
      <Heading as="h2" size="card">
        {t.whoVoted}
      </Heading>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {members.map((m) => {
          const has = voted.has(m.id);
          return (
            <li key={m.id} className="flex items-center gap-2.5">
              <Avatar initials={m.initials} tint={m.id === meId ? "accent" : has ? "white" : "empty"} size="xs" />
              <span className={cn("flex-1 text-sm", has ? "font-medium" : "text-ink-2")}>{m.name}</span>
              <span className={cn("text-xs", has ? "font-bold text-accent-strong" : "text-muted")}>{has ? t.voted : t.notVoted}</span>
            </li>
          );
        })}
      </ul>
      {!closed && pending.length > 0 && (
        <a href={nudgeHref(pending)} target="_blank" rel="noreferrer" className={buttonClasses({ variant: "secondary", block: true })}>
          {t.nudge(pending.map((m) => m.name).join(t.and))}
        </a>
      )}
    </Card>
  );
}

export function BallotsList({ ballots, cityOf, members }: { ballots: { memberId: string; ranking: string[] }[]; cityOf: (id: string) => string; members: (id: string) => Person }) {
  const t = useCopy(COPY);
  return (
    <Card variant="muted" className="flex flex-col gap-3">
      <Heading as="h2" size="card">
        {t.ballots}
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
