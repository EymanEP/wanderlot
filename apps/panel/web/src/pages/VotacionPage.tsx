import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { avatarTint, copy, deadlineLabel, initials, relativeTime, type TallyRow } from "@wanderlot/core";
import { Avatar, Badge, Button, Card, CheckIcon, Dialog, EmptyState, Field, Heading, Notice, PageHeader, RadioCard, Skeleton, TextArea, buttonClasses, cn, useCopy, useToast } from "@wanderlot/ui";
import { MessageDialog } from "../components/MessageDialog.tsx";
import { PanelShell } from "../components/PanelShell.tsx";
import type { VoteView } from "../data/backend.ts";
import { useLoad, usePanel, usePlan } from "../data/store.tsx";

const ordinal = (n: number): string => {
  const s = n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${n}${s}`;
};

const COPY = copy({
  es: {
    failed: (msg: string) => `No se pudo: ${msg}`,
    title: "Votación",
    notOpen: "La votación aún no está abierta",
    toCompare: "Ir a Comparativa",
    notOpenText: "Cuando tengas los destinos listos, ábrela desde Comparativa.",
    closesOn: (name: string, deadline: string) => `${name} · se cierra el ${deadline}`,
    closed: (name: string) => `${name} · votación cerrada`,
    refresh: "Actualizar",
    remind: "Recordar a quien falta",
    closeNow: "Cerrar ya",
    announce: "Anunciar el resultado",
    loadError: "No se pudo leer la votación del sitio:",
    retry: "Reintentar",
    tie: (names: string[]) => `Empate entre ${names.join(" y ")}`,
    tieText: "Mismos puntos, mismos primeros puestos y mismo precio. Te toca decidir; el sitio lo mostrará como ganador.",
    winnerToast: (city: string) => `Ganador: ${city}`,
    pick: (city: string) => `Elegir ${city}`,
    goingTo: "Vais a",
    goingToast: (city: string) => `Vais a ${city}`,
    voteWonBy: (city: string, note: string | null) => `La votación la ganó ${city}${note ? ` · «${note}»` : ""}`,
    backTo: (city: string) => `Volver a ${city}`,
    goElsewhere: "Ir a otro destino",
    won: "Ganó",
    nobodyVoted: "Nadie votó",
    finalCount: "Recuento final",
    prepareText: "Con el destino decidido, prepara la página del viaje: precios, cómo llegar y qué hacer.",
    prepare: "Preparar el viaje",
    provisional: "Recuento provisional",
    provisionalText: "Con los votos que hay ahora. Solo lo ves tú: los demás lo verán al cerrarse.",
    nobodyYet: "Todavía no ha votado nadie.",
    whoVoted: "Quién ha votado",
    countOf: (n: number, of: number) => `${n} de ${of}`,
    votesIn: "Votos recibidos",
    votedBadge: "Votó",
    pending: "Pendiente",
    didNotVote: "No votó",
    whoSees: "Tú ves el recuento y lo que ha votado cada uno en directo. Los demás solo ven quién ha votado hasta que se cierra; entonces ven el reparto de todos.",
    cancel: "Cancelar",
    goTo: (city: string) => `Ir a ${city}`,
    chooseDestination: "Elige un destino",
    elsewhereText:
      "Si al final os decidís por otro de los destinos de la votación, el sitio lo mostrará como el destino elegido. El recuento no cambia: seguirá diciendo quién ganó la votación.",
    destination: "Destino",
    placed: (rank: number, points: number) => `${rank}.º en la votación · ${points} ${points === 1 ? "punto" : "puntos"}`,
    why: "Por qué (opcional)",
    whyPlaceholder: "Lo hablamos y preferimos Praga",
    closeTitle: "¿Cerrar la votación ya?",
    closeWith: (n: number) => `Cerrar con ${n} ${n === 1 ? "voto" : "votos"}`,
    closedToast: "Votación cerrada",
    closeText: "Se cuenta con los votos que hay y nadie más podrá votar ni cambiar su voto. No se puede deshacer.",
    reminder: "Recordatorio",
    result: "Resultado",
    reminderIntro: "Nombra a quien falta; nadie ve qué ha votado nadie.",
    pasteIntro: "Pega este mensaje en el grupo.",
    points: "Puntos",
    firsts: "Primeros",
  },
  en: {
    failed: (msg: string) => `Couldn't do it: ${msg}`,
    title: "Vote",
    notOpen: "The vote isn't open yet",
    toCompare: "Go to Compare",
    notOpenText: "When you have the destinations ready, open it from Compare.",
    closesOn: (name: string, deadline: string) => `${name} · closes on ${deadline}`,
    closed: (name: string) => `${name} · vote closed`,
    refresh: "Refresh",
    remind: "Remind the rest",
    closeNow: "Close now",
    announce: "Announce the result",
    loadError: "Couldn't read the vote from the site:",
    retry: "Try again",
    tie: (names: string[]) => `Tie between ${names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names.join("")}`,
    tieText: "Same points, same first places and same price. It's your call; the site will show it as the winner.",
    winnerToast: (city: string) => `Winner: ${city}`,
    pick: (city: string) => `Choose ${city}`,
    goingTo: "You're going to",
    goingToast: (city: string) => `You're going to ${city}`,
    voteWonBy: (city: string, note: string | null) => `${city} won the vote${note ? ` · “${note}”` : ""}`,
    backTo: (city: string) => `Back to ${city}`,
    goElsewhere: "Go somewhere else",
    won: "Winner",
    nobodyVoted: "Nobody voted",
    finalCount: "Final count",
    prepareText: "With the destination decided, get the trip page ready: prices, getting there and things to do.",
    prepare: "Prepare the trip",
    provisional: "Count so far",
    provisionalText: "With the votes in so far. Only you can see it: everyone else will see it when it closes.",
    nobodyYet: "Nobody has voted yet.",
    whoVoted: "Who has voted",
    countOf: (n: number, of: number) => `${n} of ${of}`,
    votesIn: "Votes in",
    votedBadge: "Voted",
    pending: "Waiting",
    didNotVote: "Didn't vote",
    whoSees: "You see the count and everyone's vote live. Everyone else only sees who has voted until it closes; then they see how everyone voted.",
    cancel: "Cancel",
    goTo: (city: string) => `Go to ${city}`,
    chooseDestination: "Choose a destination",
    elsewhereText:
      "If you end up going with another of the destinations in the vote, the site will show it as the chosen destination. The count doesn't change: it will still say who won the vote.",
    destination: "Destination",
    placed: (rank: number, points: number) => `${ordinal(rank)} in the vote · ${points} ${points === 1 ? "point" : "points"}`,
    why: "Why (optional)",
    whyPlaceholder: "We talked it over and prefer Prague",
    closeTitle: "Close the vote now?",
    closeWith: (n: number) => `Close with ${n} ${n === 1 ? "vote" : "votes"}`,
    closedToast: "Vote closed",
    closeText: "It's counted with the votes in so far and nobody else will be able to vote or change their vote. This can't be undone.",
    reminder: "Reminder",
    result: "Result",
    reminderIntro: "It names who's missing; nobody sees how anyone voted.",
    pasteIntro: "Paste this message into the group.",
    points: "Points",
    firsts: "Firsts",
  },
});

// Following the vote from the panel (SPEC §4, §7): the running count and each
// ballot (the organiser sees them live; friends only once it closes), a nudge
// for who hasn't voted, closing early, a tie to break, and the result message.
export function VotacionPage() {
  const t = useCopy(COPY);
  const { vote, closeVote, pickWinner, now } = usePanel();
  const plan = usePlan();
  const toast = useToast();
  // Shown at once from the last visit, and read again (see useLoad).
  const { data: loaded, error, reload: load, set: setView } = useLoad<VoteView | null>(`vote:${plan.id}:${plan.status}`, () => (plan.status === "draft" ? Promise.resolve(null) : vote()));
  const view = loaded;
  const [message, setMessage] = useState<"reminder" | "announcement" | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const [busy, setBusy] = useState(false);
  // "Ir a otro destino": the group chose another destination than the vote's winner.
  const [changing, setChanging] = useState(false);
  const [other, setOther] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const act = async (what: () => Promise<VoteView>, done: string) => {
    setBusy(true);
    try {
      setView(await what());
      toast(done);
    } catch (e) {
      toast(t.failed((e as Error).message));
    } finally {
      setBusy(false);
    }
  };

  const city = (id: string) => view?.cities[id] ?? id;

  if (plan.status === "draft") {
    return (
      <PanelShell>
        <main className="mx-auto flex w-full max-w-[1100px] flex-col gap-[26px] px-4 py-8 sm:px-8">
          <PageHeader title={t.title} subtitle={plan.name} />
          <EmptyState
            title={t.notOpen}
            action={
              <Link to="/comparativa" className={buttonClasses({ variant: "primary" })}>
                {t.toCompare}
              </Link>
            }
          >
            {t.notOpenText}
          </EmptyState>
        </main>
      </PanelShell>
    );
  }

  const votedCount = view?.voted.length ?? 0;
  const ballotOf = new Map((view?.ballots ?? []).map((b) => [b.memberId, b]));
  const result = view?.result ?? null;
  const tied = result && !result.winnerId && result.tiedForFirst.length > 1;
  const overridden = !!result?.voteWinnerId && !!result.winnerId && result.voteWinnerId !== result.winnerId;

  return (
    <PanelShell>
      <main className="mx-auto flex w-full max-w-[1100px] flex-col gap-[26px] px-4 py-8 sm:px-8">
        <PageHeader
          title={t.title}
          subtitle={
            view?.status === "voting" && view.voteDeadline
              ? t.closesOn(plan.name, deadlineLabel(view.voteDeadline))
              : t.closed(plan.name)
          }
          actions={
            view?.status === "voting" ? (
              <div className="flex flex-wrap gap-2">
                <Button variant="ghost" onClick={() => void load()}>
                  {t.refresh}
                </Button>
                <Button disabled={!view.reminder} onClick={() => setMessage("reminder")}>
                  {t.remind}
                </Button>
                <Button variant="primary" disabled={votedCount === 0 || busy} onClick={() => setConfirmClose(true)}>
                  {t.closeNow}
                </Button>
              </div>
            ) : view?.announcement ? (
              <Button variant="primary" onClick={() => setMessage("announcement")}>
                {t.announce}
              </Button>
            ) : null
          }
        />

        {error && (
          <Notice role="alert">
            {t.loadError} {error}{" "}
            <button type="button" onClick={() => void load()} className="cursor-pointer border-0 bg-transparent p-0 font-semibold text-accent">
              {t.retry}
            </button>
          </Notice>
        )}
        {!view && !error && <Skeleton className="h-40 rounded-card" />}

        {view && result && (
          <Card variant="raised" className="flex flex-col gap-4">
            {tied ? (
              <>
                <div className="flex flex-col gap-1">
                  <Heading size="subheading">{t.tie(result.tiedForFirst.map(city))}</Heading>
                  <span className="text-sm text-muted">{t.tieText}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {result.tiedForFirst.map((id) => (
                    <Button key={id} disabled={busy} onClick={() => void act(() => pickWinner(id), t.winnerToast(city(id)))}>
                      {t.pick(city(id))}
                    </Button>
                  ))}
                </div>
              </>
            ) : overridden ? (
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-bold text-muted uppercase">{t.goingTo}</span>
                  <Heading size="headline">{city(result.winnerId!)}</Heading>
                  <span className="text-sm text-muted">{t.voteWonBy(city(result.voteWinnerId!), result.decidedNote ?? null)}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button disabled={busy} onClick={() => void act(() => pickWinner(result.voteWinnerId!, { override: true }), t.goingToast(city(result.voteWinnerId!)))}>
                    {t.backTo(city(result.voteWinnerId!))}
                  </Button>
                  <Button onClick={() => setChanging(true)}>{t.goElsewhere}</Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-bold text-muted uppercase">{t.won}</span>
                  <Heading size="headline">{result.winnerId ? city(result.winnerId) : t.nobodyVoted}</Heading>
                </div>
                {result.winnerId && result.rows.length > 1 && <Button onClick={() => setChanging(true)}>{t.goElsewhere}</Button>}
              </div>
            )}
            {result.rows.length > 0 && <CountTable rows={result.rows} winnerId={result.winnerId} city={city} caption={t.finalCount} />}
            {result.winnerId && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-faint pt-3.5">
                <span className="text-sm text-muted">{t.prepareText}</span>
                <Link to="/viaje" className={buttonClasses({ variant: "secondary", size: "sm" })}>
                  {t.prepare}
                </Link>
              </div>
            )}
          </Card>
        )}

        {view && view.status === "voting" && (
          <Card variant="raised" className="flex flex-col gap-3" aria-labelledby="provisional">
            <div className="flex flex-col gap-1">
              <Heading id="provisional" size="subheading">
                {t.provisional}
              </Heading>
              <span className="text-sm text-muted">{t.provisionalText}</span>
            </div>
            {view.ballots.length ? (
              <CountTable rows={view.tally.rows} winnerId={null} city={city} caption={t.provisional} />
            ) : (
              <p className="m-0 text-sm text-muted">{t.nobodyYet}</p>
            )}
          </Card>
        )}

        {view && (
          <section aria-labelledby="quien" className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-3">
              <Heading id="quien" size="subheading">
                {t.whoVoted}
              </Heading>
              <span className="text-sm font-bold tabular-nums">
                {t.countOf(votedCount, view.partySize)}
              </span>
            </div>
            <div
              role="progressbar"
              aria-label={t.votesIn}
              aria-valuemin={0}
              aria-valuemax={view.partySize}
              aria-valuenow={votedCount}
              className="h-2 overflow-hidden rounded-full bg-line-soft"
            >
              <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, (votedCount / Math.max(1, view.partySize)) * 100)}%` }} />
            </div>
            <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2">
              {view.people.map((p) => (
                <li key={p.id} aria-label={p.name} className="flex items-center justify-between gap-3 rounded-xl bg-surface px-3.5 py-2.5">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <Avatar initials={initials(p.name)} name={p.name} tint={avatarTint(p.id)} size="sm" />
                    <span className="flex min-w-0 flex-col">
                      {p.name}
                      {ballotOf.get(p.id) && (
                        <span className="text-[13px] text-muted">
                          {ballotOf.get(p.id)!.ranking.map((id, i) => `${i + 1}. ${city(id)}`).join(" · ")} · {relativeTime(ballotOf.get(p.id)!.updatedAt, now)}
                        </span>
                      )}
                    </span>
                  </span>
                  {p.voted ? (
                    <Badge tone="accent" size="md" icon={<CheckIcon size={14} />}>
                      {t.votedBadge}
                    </Badge>
                  ) : (
                    <Badge tone="muted" size="md">
                      {view.status === "voting" ? t.pending : t.didNotVote}
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
            <p className="m-0 text-[13px] text-muted">
              {t.whoSees}
            </p>
          </section>
        )}
      </main>

      <Dialog
        open={changing}
        title={t.goElsewhere}
        busy={busy}
        onClose={() => setChanging(false)}
        actions={
          <>
            <Button onClick={() => setChanging(false)}>{t.cancel}</Button>
            <Button
              variant="primary"
              disabled={busy || !other}
              onClick={() => {
                if (!other) return;
                setChanging(false);
                void act(() => pickWinner(other, { override: true, ...(note.trim() ? { note: note.trim() } : {}) }), t.goingToast(city(other)));
                setOther(null);
                setNote("");
              }}
            >
              {other ? t.goTo(city(other)) : t.chooseDestination}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3.5">
          <span>{t.elsewhereText}</span>
          <div role="radiogroup" aria-label={t.destination} className="flex flex-col gap-2">
            {(result?.rows ?? [])
              .filter((r) => r.id !== result?.winnerId)
              .map((r) => (
                <RadioCard
                  key={r.id}
                  name="otro-destino"
                  title={city(r.id)}
                  description={t.placed(r.rank, r.points)}
                  checked={other === r.id}
                  onChange={() => setOther(r.id)}
                />
              ))}
          </div>
          <Field label={t.why}>
            {({ inputId }) => <TextArea id={inputId} rows={2} maxLength={300} placeholder={t.whyPlaceholder} value={note} onChange={(e) => setNote(e.target.value)} />}
          </Field>
        </div>
      </Dialog>

      <Dialog
        open={confirmClose}
        title={t.closeTitle}
        confirmLabel={t.closeWith(votedCount)}
        busy={busy}
        onConfirm={() => {
          setConfirmClose(false);
          void act(closeVote, t.closedToast);
        }}
        onClose={() => setConfirmClose(false)}
      >
        {t.closeText}
      </Dialog>

      {view && message && (
        <MessageDialog
          open
          title={message === "reminder" ? t.reminder : t.result}
          intro={message === "reminder" ? t.reminderIntro : t.pasteIntro}
          message={(message === "reminder" ? view.reminder : view.announcement) ?? ""}
          onClose={() => setMessage(null)}
        />
      )}
    </PanelShell>
  );
}

// Points and first places per destination; the winner in bold once there is one.
function CountTable({ rows, winnerId, city, caption }: { rows: TallyRow[]; winnerId: string | null; city: (id: string) => string; caption: string }) {
  const t = useCopy(COPY);
  return (
    <table className="w-full border-collapse text-sm">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr className="text-left text-xs text-muted uppercase">
          <th className="py-2 font-bold">#</th>
          <th className="py-2 font-bold">{t.destination}</th>
          <th className="py-2 text-right font-bold">{t.points}</th>
          <th className="py-2 text-right font-bold">{t.firsts}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className={cn("border-t border-line-faint", r.id === winnerId && "font-bold")}>
            <td className="py-2 tabular-nums">{r.rank}</td>
            <td className="py-2">{city(r.id)}</td>
            <td className="py-2 text-right tabular-nums">{r.points}</td>
            <td className="py-2 text-right tabular-nums">{r.firsts}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
