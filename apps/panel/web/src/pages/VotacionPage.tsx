import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { avatarTint, deadlineLabel, initials, relativeTime, type TallyRow } from "@wanderlot/core";
import { Avatar, Badge, Button, Card, CheckIcon, Dialog, EmptyState, Field, Heading, Notice, PageHeader, RadioCard, Skeleton, TextArea, buttonClasses, cn, useToast } from "@wanderlot/ui";
import { MessageDialog } from "../components/MessageDialog.tsx";
import { PanelShell } from "../components/PanelShell.tsx";
import type { VoteView } from "../data/backend.ts";
import { usePanel, usePlan } from "../data/store.tsx";

// Following the vote from the panel (SPEC §4, §7): the running count and each
// ballot (the organiser sees them live; friends only once it closes), a nudge
// for who hasn't voted, closing early, a tie to break, and the result message.
export function VotacionPage() {
  const { vote, closeVote, pickWinner, now } = usePanel();
  const plan = usePlan();
  const toast = useToast();
  const [view, setView] = useState<VoteView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<"reminder" | "announcement" | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const [busy, setBusy] = useState(false);
  // "Ir a otro destino": the group chose another destination than the vote's winner.
  const [changing, setChanging] = useState(false);
  const [other, setOther] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    setError(null);
    try {
      setView(await vote());
    } catch (e) {
      setError((e as Error).message);
    }
  }, [vote]);

  useEffect(() => {
    setView(null);
    if (plan.status !== "draft") void load();
    // Reload when switching plans, not on every change to the plan object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan.id]);

  const act = async (what: () => Promise<VoteView>, done: string) => {
    setBusy(true);
    try {
      setView(await what());
      toast(done);
    } catch (e) {
      toast(`No se pudo: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const city = (id: string) => view?.cities[id] ?? id;

  if (plan.status === "draft") {
    return (
      <PanelShell>
        <main className="mx-auto flex w-full max-w-[1100px] flex-col gap-[26px] px-4 py-8 sm:px-8">
          <PageHeader title="Votación" subtitle={plan.name} />
          <EmptyState
            title="La votación aún no está abierta"
            action={
              <Link to="/comparativa" className={buttonClasses({ variant: "primary" })}>
                Ir a Comparativa
              </Link>
            }
          >
            Cuando tengas los destinos listos, ábrela desde Comparativa.
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
          title="Votación"
          subtitle={
            view?.status === "voting" && view.voteDeadline
              ? `${plan.name} · se cierra el ${deadlineLabel(view.voteDeadline)}`
              : `${plan.name} · votación cerrada`
          }
          actions={
            view?.status === "voting" ? (
              <div className="flex flex-wrap gap-2">
                <Button variant="ghost" onClick={() => void load()}>
                  Actualizar
                </Button>
                <Button disabled={!view.reminder} onClick={() => setMessage("reminder")}>
                  Recordar a quien falta
                </Button>
                <Button variant="primary" disabled={votedCount === 0 || busy} onClick={() => setConfirmClose(true)}>
                  Cerrar ya
                </Button>
              </div>
            ) : view?.announcement ? (
              <Button variant="primary" onClick={() => setMessage("announcement")}>
                Anunciar el resultado
              </Button>
            ) : null
          }
        />

        {error && (
          <Notice role="alert">
            No se pudo leer la votación del sitio: {error}{" "}
            <button type="button" onClick={() => void load()} className="cursor-pointer border-0 bg-transparent p-0 font-semibold text-accent">
              Reintentar
            </button>
          </Notice>
        )}
        {!view && !error && <Skeleton className="h-40 rounded-card" />}

        {view && result && (
          <Card variant="raised" className="flex flex-col gap-4">
            {tied ? (
              <>
                <div className="flex flex-col gap-1">
                  <Heading size="subheading">Empate entre {result.tiedForFirst.map(city).join(" y ")}</Heading>
                  <span className="text-sm text-muted">
                    Mismos puntos, mismos primeros puestos y mismo precio. Te toca decidir; el sitio lo mostrará como ganador.
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {result.tiedForFirst.map((id) => (
                    <Button key={id} disabled={busy} onClick={() => void act(() => pickWinner(id), `Ganador: ${city(id)}`)}>
                      Elegir {city(id)}
                    </Button>
                  ))}
                </div>
              </>
            ) : overridden ? (
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-bold text-muted uppercase">Vais a</span>
                  <Heading size="headline">{city(result.winnerId!)}</Heading>
                  <span className="text-sm text-muted">
                    La votación la ganó {city(result.voteWinnerId!)}
                    {result.decidedNote ? ` · «${result.decidedNote}»` : ""}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button disabled={busy} onClick={() => void act(() => pickWinner(result.voteWinnerId!, { override: true }), `Vais a ${city(result.voteWinnerId!)}`)}>
                    Volver a {city(result.voteWinnerId!)}
                  </Button>
                  <Button onClick={() => setChanging(true)}>Ir a otro destino</Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-bold text-muted uppercase">Ganó</span>
                  <Heading size="headline">{result.winnerId ? city(result.winnerId) : "Nadie votó"}</Heading>
                </div>
                {result.winnerId && result.rows.length > 1 && <Button onClick={() => setChanging(true)}>Ir a otro destino</Button>}
              </div>
            )}
            {result.rows.length > 0 && <CountTable rows={result.rows} winnerId={result.winnerId} city={city} caption="Recuento final" />}
            {result.winnerId && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-faint pt-3.5">
                <span className="text-sm text-muted">Con el destino decidido, prepara la página del viaje: precios, cómo llegar y qué hacer.</span>
                <Link to="/viaje" className={buttonClasses({ variant: "secondary", size: "sm" })}>
                  Preparar el viaje
                </Link>
              </div>
            )}
          </Card>
        )}

        {view && view.status === "voting" && (
          <Card variant="raised" className="flex flex-col gap-3" aria-labelledby="provisional">
            <div className="flex flex-col gap-1">
              <Heading id="provisional" size="subheading">
                Recuento provisional
              </Heading>
              <span className="text-sm text-muted">Con los votos que hay ahora. Solo lo ves tú: los demás lo verán al cerrarse.</span>
            </div>
            {view.ballots.length ? (
              <CountTable rows={view.tally.rows} winnerId={null} city={city} caption="Recuento provisional" />
            ) : (
              <p className="m-0 text-sm text-muted">Todavía no ha votado nadie.</p>
            )}
          </Card>
        )}

        {view && (
          <section aria-labelledby="quien" className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-3">
              <Heading id="quien" size="subheading">
                Quién ha votado
              </Heading>
              <span className="text-sm font-bold tabular-nums">
                {votedCount} de {view.partySize}
              </span>
            </div>
            <div
              role="progressbar"
              aria-label="Votos recibidos"
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
                      Votó
                    </Badge>
                  ) : (
                    <Badge tone="muted" size="md">
                      {view.status === "voting" ? "Pendiente" : "No votó"}
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
            <p className="m-0 text-[13px] text-muted">
              Tú ves el recuento y lo que ha votado cada uno en directo. Los demás solo ven quién ha votado hasta que se cierra; entonces ven el reparto de todos.
            </p>
          </section>
        )}
      </main>

      <Dialog
        open={changing}
        title="Ir a otro destino"
        busy={busy}
        onClose={() => setChanging(false)}
        actions={
          <>
            <Button onClick={() => setChanging(false)}>Cancelar</Button>
            <Button
              variant="primary"
              disabled={busy || !other}
              onClick={() => {
                if (!other) return;
                setChanging(false);
                void act(() => pickWinner(other, { override: true, ...(note.trim() ? { note: note.trim() } : {}) }), `Vais a ${city(other)}`);
                setOther(null);
                setNote("");
              }}
            >
              {other ? `Ir a ${city(other)}` : "Elige un destino"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3.5">
          <span>
            Si al final os decidís por otro de los destinos de la votación, el sitio lo mostrará como el destino elegido. El recuento no cambia: seguirá diciendo quién ganó
            la votación.
          </span>
          <div role="radiogroup" aria-label="Destino" className="flex flex-col gap-2">
            {(result?.rows ?? [])
              .filter((r) => r.id !== result?.winnerId)
              .map((r) => (
                <RadioCard
                  key={r.id}
                  name="otro-destino"
                  title={city(r.id)}
                  description={`${r.rank}.º en la votación · ${r.points} ${r.points === 1 ? "punto" : "puntos"}`}
                  checked={other === r.id}
                  onChange={() => setOther(r.id)}
                />
              ))}
          </div>
          <Field label="Por qué (opcional)">
            {({ inputId }) => <TextArea id={inputId} rows={2} maxLength={300} placeholder="Lo hablamos y preferimos Praga" value={note} onChange={(e) => setNote(e.target.value)} />}
          </Field>
        </div>
      </Dialog>

      <Dialog
        open={confirmClose}
        title="¿Cerrar la votación ya?"
        confirmLabel={`Cerrar con ${votedCount} ${votedCount === 1 ? "voto" : "votos"}`}
        busy={busy}
        onConfirm={() => {
          setConfirmClose(false);
          void act(closeVote, "Votación cerrada");
        }}
        onClose={() => setConfirmClose(false)}
      >
        Se cuenta con los votos que hay y nadie más podrá votar ni cambiar su voto. No se puede deshacer.
      </Dialog>

      {view && message && (
        <MessageDialog
          open
          title={message === "reminder" ? "Recordatorio" : "Resultado"}
          intro={message === "reminder" ? "Nombra a quien falta; nadie ve qué ha votado nadie." : "Pega este mensaje en el grupo."}
          message={(message === "reminder" ? view.reminder : view.announcement) ?? ""}
          onClose={() => setMessage(null)}
        />
      )}
    </PanelShell>
  );
}

// Points and first places per destination; the winner in bold once there is one.
function CountTable({ rows, winnerId, city, caption }: { rows: TallyRow[]; winnerId: string | null; city: (id: string) => string; caption: string }) {
  return (
    <table className="w-full border-collapse text-sm">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr className="text-left text-xs text-muted uppercase">
          <th className="py-2 font-bold">#</th>
          <th className="py-2 font-bold">Destino</th>
          <th className="py-2 text-right font-bold">Puntos</th>
          <th className="py-2 text-right font-bold">Primeros</th>
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
