import { useState } from "react";
import { useParams } from "react-router";
import { daysUntil, deadlineLabel, longDate } from "@wanderlot/core";
import { Button, Card, EmptyState, Footer, Heading, Main, SectionHeader, Text, useToast } from "@wanderlot/ui";
import { BallotsList, LockedScoreboard, OutsideRow, Participation, RankRow, Scoreboard } from "../components/Voting.tsx";
import { useSite } from "../data/store.tsx";
import { add, isComplete, moveDown, moveUp, pointsIfAdded, remove, sameRanking } from "../lib/ranking.ts";
import { memberOf, names } from "../lib/view.ts";

export function VotacionPage() {
  const site = useSite();
  const toast = useToast();
  const { planId } = useParams();
  const { plan, destinations, members, me, ballots, myRanking, myBallot, result, closed, now } = site;
  const [draft, setDraft] = useState<string[]>(myRanking);
  const base = `/p/${planId}`;

  const inVote = destinations.filter((d) => d.inVote);
  const byId = (id: string) => inVote.find((d) => d.id === id)!;
  const cityOf = (id: string) => destinations.find((d) => d.id === id)?.place.city ?? id;
  const deadline = plan.voteDeadline!;
  const outside = inVote.filter((d) => !draft.includes(d.id));
  const complete = isComplete(draft, inVote.length);
  const dirty = !sameRanking(draft, myRanking);
  const days = daysUntil(deadline, now);
  const winner = result?.winnerId ? cityOf(result.winnerId) : null;

  const save = () => {
    site.saveRanking(draft);
    toast("Reparto guardado");
  };

  if (inVote.length < 2) {
    return (
      <Main>
        <EmptyState title="Todavía no hay votación">Hacen falta al menos dos destinos aprobados.</EmptyState>
      </Main>
    );
  }

  return (
    <Main className="gap-7">
      <section className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
        <div className="flex max-w-[820px] flex-col gap-2.5">
          <Heading as="h1" size="display">
            {closed ? "Votación cerrada" : "Votación"}
          </Heading>
          <Text size="lg">
            Cada uno elige tres destinos y los ordena: el primero se lleva 3 puntos, el segundo 2 y el tercero 1. Seis puntos por cabeza.{" "}
            {closed ? "Así quedó el reparto." : `Gana el que más sume el ${longDate(deadline)}.`}
          </Text>
        </div>
        <Card variant="accent" className="flex shrink-0 flex-col gap-1.5 lg:w-[300px]">
          {closed ? (
            <>
              <span className="text-[13px] font-bold">Nos vamos a</span>
              <span className="text-[28px] font-extrabold tracking-[-0.03em]">{winner ?? "Empate"}</span>
              <span className="text-[13px]">{winner ? `${result!.rows[0]!.points} puntos de 36.` : "Decide Eyman entre los empatados."}</span>
            </>
          ) : (
            <>
              <span className="text-[13px] font-bold">{days === 0 ? "Cierra hoy" : `Abierta ${days} ${days === 1 ? "día" : "días"} más`}</span>
              <span className="text-[28px] font-extrabold tracking-[-0.03em] tabular-nums">
                {ballots.length} de {plan.partySize} votos
              </span>
              <span className="text-[13px]">Cierra el {deadlineLabel(deadline)}.</span>
            </>
          )}
        </Card>
      </section>

      <div className="flex flex-col gap-7 lg:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-5">
          <section className="flex flex-col gap-3.5" aria-labelledby="reparto">
            <SectionHeader
              id="reparto"
              title="Tu reparto"
              aside={
                myBallot
                  ? `Votaste el ${longDate(myBallot.updatedAt)}${closed ? "" : " · puedes cambiarlo"}`
                  : "Todavía no has votado"
              }
            />
            {draft.length === 0 ? (
              <EmptyState title="Aún no has elegido ningún destino">Empieza por el que más te apetezca: se lleva 3 puntos.</EmptyState>
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
                title="Fuera de tu reparto"
                aside={draft.length >= 3 && !closed ? "Al meter uno, sale el que esté en 3.ª posición" : undefined}
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
          {result ? <Scoreboard result={result} cityOf={cityOf} /> : <LockedScoreboard cities={inVote.map((d) => d.place.city)} deadline={longDate(deadline)} />}
          {closed ? (
            <BallotsList ballots={ballots} cityOf={cityOf} members={(id) => memberOf(members, id)} />
          ) : (
            <Participation
              members={members}
              voted={new Set(ballots.map((b) => b.memberId))}
              meId={me.id}
              closed={closed}
              onNudge={(pending) => toast(`Toque enviado a ${names(pending.map((m) => m.name))}`)}
            />
          )}
        </aside>
      </div>

      <Footer>
        <span className="text-[13px] text-ink-2">
          {closed
            ? "Si hubo empate, ganó el que tenía más primeros puestos; si seguía empatado, el más barato."
            : `Puedes cambiar tu reparto tantas veces como quieras hasta el ${longDate(deadline)}. Si hay empate, gana el que tenga más primeros puestos; si sigue empatado, el más barato.`}
        </span>
        {!closed && (
          <Button variant="primary" size="lg" disabled={!complete || !dirty} onClick={save} title={!complete ? "Elige tres destinos" : undefined}>
            {myBallot ? "Guardar mi reparto" : "Votar"}
          </Button>
        )}
      </Footer>
    </Main>
  );
}
