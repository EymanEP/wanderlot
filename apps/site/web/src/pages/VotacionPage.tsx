import { useState } from "react";
import { useParams } from "react-router";
import { copy, daysUntil, deadlineLabel, longDate } from "@wanderlot/core";
import { Button, Card, EmptyState, Footer, Heading, Main, SectionHeader, Text, useCopy, useToast } from "@wanderlot/ui";
import { BallotsList, LockedScoreboard, OutsideRow, Participation, RankRow, Scoreboard } from "../components/Voting.tsx";
import { useAuth } from "../data/auth.tsx";
import { useSite } from "../data/store.tsx";
import { add, isComplete, moveDown, moveUp, pointsIfAdded, remove, sameRanking } from "../lib/ranking.ts";
import { memberOf, names, overridden } from "../lib/view.ts";

const COPY = copy({
  es: {
    saved: "Reparto guardado",
    couldNot: (msg: string) => `No se pudo guardar: ${msg}`,
    nudge: (names: string, plan: string, deadline: string, link: string) => `${names}: falta vuestro voto para ${plan}. Se cierra el ${deadline}. ${link}`,
    notOpen: "La votación aún no está abierta",
    notOpenText: (organiser: string) => `${organiser} os avisará cuando se abra.`,
    noVote: "Todavía no hay votación",
    noVoteText: "Hacen falta al menos dos destinos aprobados.",
    closed: "Votación cerrada",
    title: "Votación",
    how: "Cada uno elige tres destinos y los ordena: el primero se lleva 3 puntos, el segundo 2 y el tercero 1. Seis puntos por cabeza.",
    howClosed: "Así quedó el reparto.",
    howOpen: (date: string) => `Gana el que más sume el ${date}.`,
    goingTo: "Nos vamos a",
    tie: "Empate",
    overridden: (voted: string, chosen: string, note: string | null) => `Ganó la votación ${voted}, pero al final elegimos ${chosen}${note ? `: «${note}»` : "."}`,
    pointsOf: (n: number, max: number) => `${n} puntos de ${max}.`,
    organiserDecides: (organiser: string) => `Decide ${organiser} entre los empatados.`,
    closesToday: "Cierra hoy",
    openFor: (n: number) => `Abierta ${n} ${n === 1 ? "día" : "días"} más`,
    votes: (n: number, of: number) => `${n} de ${of} votos`,
    closes: (date: string) => `Cierra el ${date}.`,
    mine: "Tu reparto",
    votedOn: (date: string, closed: boolean) => `Votaste el ${date}${closed ? "" : " · puedes cambiarlo"}`,
    notVoted: "Todavía no has votado",
    empty: "Aún no has elegido ningún destino",
    emptyText: "Empieza por el que más te apetezca: se lleva 3 puntos.",
    outside: "Fuera de tu reparto",
    bumps: "Al meter uno, sale el que esté en 3.ª posición",
    tieClosed: "Si hubo empate, ganó el que tenía más primeros puestos; si seguía empatado, el más barato.",
    tieOpen: (date: string) => `Puedes cambiar tu reparto tantas veces como quieras hasta el ${date}. Si hay empate, gana el que tenga más primeros puestos; si sigue empatado, el más barato.`,
    pickThree: "Elige tres destinos",
    save: "Guardar mi reparto",
    vote: "Votar",
  },
  en: {
    saved: "Points saved",
    couldNot: (msg: string) => `Couldn't save: ${msg}`,
    nudge: (names: string, plan: string, deadline: string, link: string) => `${names}: we still need your vote for ${plan}. It closes on ${deadline}. ${link}`,
    notOpen: "Voting isn't open yet",
    notOpenText: (organiser: string) => `${organiser} will let you know when it opens.`,
    noVote: "No vote yet",
    noVoteText: "It needs at least two approved destinations.",
    closed: "Voting closed",
    title: "Vote",
    how: "Everyone picks three destinations and puts them in order: the first gets 3 points, the second 2 and the third 1. Six points each.",
    howClosed: "This is how the points ended up.",
    howOpen: (date: string) => `Whichever has the most on ${date} wins.`,
    goingTo: "We're going to",
    tie: "A tie",
    overridden: (voted: string, chosen: string, note: string | null) => `${voted} won the vote, but in the end we chose ${chosen}${note ? `: “${note}”` : "."}`,
    pointsOf: (n: number, max: number) => `${n} of ${max} points.`,
    organiserDecides: (organiser: string) => `${organiser} picks between the tied ones.`,
    closesToday: "Closes today",
    openFor: (n: number) => `Open ${n} more ${n === 1 ? "day" : "days"}`,
    votes: (n: number, of: number) => `${n} of ${of} votes`,
    closes: (date: string) => `Closes on ${date}.`,
    mine: "Your points",
    votedOn: (date: string, closed: boolean) => `You voted on ${date}${closed ? "" : " · you can change it"}`,
    notVoted: "You haven't voted yet",
    empty: "You haven't picked any destination yet",
    emptyText: "Start with the one you fancy most: it gets 3 points.",
    outside: "Not in your points",
    bumps: "Adding one drops whichever is in 3rd place",
    tieClosed: "If there was a tie, the one with more first places won; if still tied, the cheapest.",
    tieOpen: (date: string) => `You can change your points as often as you like until ${date}. If there's a tie, the one with more first places wins; if still tied, the cheapest.`,
    pickThree: "Pick three destinations",
    save: "Save my points",
    vote: "Vote",
  },
});

export function VotacionPage() {
  const site = useSite();
  const t = useCopy(COPY);
  const toast = useToast();
  const { planId } = useParams();
  const { plan, destinations, members, me, voted, closedBallots, myRanking, myBallot, result, closed, now } = site;
  const { group } = useAuth();
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<string[]>(myRanking);
  const base = `/p/${planId}`;

  const inVote = destinations.filter((d) => d.inVote);
  const byId = (id: string) => inVote.find((d) => d.id === id)!;
  const cityOf = (id: string) => destinations.find((d) => d.id === id)?.place.city ?? id;
  const deadline = plan.voteDeadline ?? "";
  const outside = inVote.filter((d) => !draft.includes(d.id));
  const complete = isComplete(draft, inVote.length);
  const dirty = !sameRanking(draft, myRanking);
  const days = daysUntil(deadline, now);
  const winner = result?.winnerId ? cityOf(result.winnerId) : null;

  const save = async () => {
    setSaving(true);
    try {
      await site.saveRanking(draft);
      toast(t.saved);
    } catch (e) {
      toast(t.couldNot((e as Error).message));
    } finally {
      setSaving(false);
    }
  };

  // "Dar un toque": a ready message in WhatsApp for whoever hasn't voted.
  const nudgeHref = (pending: { name: string }[]) =>
    `https://wa.me/?text=${encodeURIComponent(
      t.nudge(names(pending.map((m) => m.name)), plan.name, deadlineLabel(deadline), `${window.location.origin}/p/${plan.id}/votacion`),
    )}`;

  if (plan.status === "draft" || !deadline) {
    return (
      <Main>
        <EmptyState title={t.notOpen}>{t.notOpenText(group.organiserName)}</EmptyState>
      </Main>
    );
  }

  if (inVote.length < 2) {
    return (
      <Main>
        <EmptyState title={t.noVote}>{t.noVoteText}</EmptyState>
      </Main>
    );
  }

  return (
    <Main className="gap-7">
      <section className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
        <div className="flex max-w-[820px] flex-col gap-2.5">
          <Heading as="h1" size="display">
            {closed ? t.closed : t.title}
          </Heading>
          <Text size="lg">
            {t.how} {closed ? t.howClosed : t.howOpen(longDate(deadline))}
          </Text>
        </div>
        <Card variant="accent" className="flex shrink-0 flex-col gap-1.5 lg:w-[300px]">
          {closed ? (
            <>
              <span className="text-[13px] font-bold">{t.goingTo}</span>
              <span className="text-[28px] font-extrabold tracking-[-0.03em]">{winner ?? t.tie}</span>
              <span className="text-[13px]">
                {overridden(result)
                  ? t.overridden(cityOf(result!.voteWinnerId!), winner ?? "", result!.decidedNote ?? null)
                  : winner
                    ? t.pointsOf(result!.rows.find((r) => r.id === result!.winnerId)?.points ?? 0, plan.partySize * 6)
                    : t.organiserDecides(group.organiserName)}
              </span>
            </>
          ) : (
            <>
              <span className="text-[13px] font-bold">{days === 0 ? t.closesToday : t.openFor(days)}</span>
              <span className="text-[28px] font-extrabold tracking-[-0.03em] tabular-nums">
                {t.votes(voted.size, plan.partySize)}
              </span>
              <span className="text-[13px]">{t.closes(deadlineLabel(deadline))}</span>
            </>
          )}
        </Card>
      </section>

      <div className="flex flex-col gap-7 lg:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-5">
          <section className="flex flex-col gap-3.5" aria-labelledby="reparto">
            <SectionHeader
              id="reparto"
              title={t.mine}
              aside={
                myBallot
                  ? t.votedOn(longDate(myBallot.updatedAt), closed)
                  : t.notVoted
              }
            />
            {draft.length === 0 ? (
              <EmptyState title={t.empty}>{t.emptyText}</EmptyState>
            ) : (
              <ol aria-labelledby="reparto" className="m-0 flex list-none flex-col gap-2.5 p-0">
                {draft.map((id, i) => (
                  <RankRow
                    key={id}
                    destination={byId(id)}
                    position={i}
                    count={draft.length}
                    readOnly={closed}
                    onUp={() => setDraft(moveUp(draft, i))}
                    onDown={() => setDraft(moveDown(draft, i))}
                    onRemove={() => setDraft(remove(draft, id))}
                  />
                ))}
              </ol>
            )}
          </section>

          {outside.length > 0 && (
            <Card as="section" variant="muted" className="flex flex-col gap-3.5" aria-labelledby="fuera">
              <SectionHeader
                id="fuera"
                size="subheading"
                title={t.outside}
                aside={draft.length >= 3 && !closed ? t.bumps : undefined}
              />
              {outside.map((d) => (
                <OutsideRow
                  key={d.id}
                  destination={d}
                  href={`${base}/destinos/${d.id}`}
                  addPoints={pointsIfAdded(draft)}
                  readOnly={closed}
                  onAdd={() => setDraft(add(draft, d.id))}
                />
              ))}
            </Card>
          )}
        </div>

        <aside className="flex shrink-0 flex-col gap-[18px] lg:w-[396px]">
          {result ? <Scoreboard result={result} cityOf={cityOf} /> : <LockedScoreboard cities={inVote.map((d) => d.place.city)} deadline={longDate(deadline)} partySize={plan.partySize} />}
          {closed ? (
            <BallotsList ballots={closedBallots ?? []} cityOf={cityOf} members={(id) => memberOf(members, id)} />
          ) : (
            <Participation
              members={members}
              voted={voted}
              meId={me.id}
              closed={closed}
              nudgeHref={nudgeHref}
            />
          )}
        </aside>
      </div>

      <Footer>
        <span className="text-[13px] text-ink-2">
          {closed
            ? t.tieClosed
            : t.tieOpen(longDate(deadline))}
        </span>
        {!closed && (
          <Button variant="primary" size="lg" disabled={!complete || !dirty || saving} onClick={save} title={!complete ? t.pickThree : undefined}>
            {myBallot ? t.save : t.vote}
          </Button>
        )}
      </Footer>
    </Main>
  );
}
