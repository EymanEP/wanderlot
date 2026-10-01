import { useCallback, useEffect, useState } from "react";
import {
  DATE_ANSWER_LABEL,
  MAX_DATE_OPTIONS,
  MIN_DATE_OPTIONS,
  addDaysIso,
  answeredAll,
  avatarTint,
  bestDateOptions,
  dateCounts,
  dateOptionId,
  deadlineLabel,
  initials,
  nightsOf,
  rangeLabel,
  shortDate,
  type DateAnswer,
  type DateOption,
  type DatesView,
} from "@wanderlot/core";
import {
  Avatar,
  Badge,
  Button,
  Calendar,
  Card,
  Dialog,
  Field,
  Heading,
  IconButton,
  Notice,
  PageHeader,
  Skeleton,
  TextInput,
  TrashIcon,
  cn,
  pickRange,
  useToast,
  type BadgeTone,
  type DateRange,
} from "@wanderlot/ui";
import { LeaveCard } from "../components/LeaveCard.tsx";
import { MessageDialog } from "../components/MessageDialog.tsx";
import { PanelShell } from "../components/PanelShell.tsx";
import { TripDates, datesSummary } from "../components/TripDates.tsx";
import type { DatesPage, DateWindow } from "../data/backend.ts";
import { useLoad, usePanel, usePlan } from "../data/store.tsx";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const nights = (w: DateWindow) => plural(nightsOf(w), "noche", "noches");

// Cuándo (ROADMAP 2.1): propose 2–5 date windows, see who can go when, and
// choose. Choosing gives the trip those dates, here and on the site.
export function FechasPage() {
  const { state, dates, proposeDates, chooseDates, cancelDates, fixDates, now } = usePanel();
  const plan = usePlan();
  const toast = useToast();
  // Shown at once from the last visit, and read again (see useLoad).
  const { data: page, error, reload: load, set: setPage } = useLoad<DatesPage>(`dates:${plan.id}`, dates);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState<{ title: string; intro: string; text: string } | null>(null);
  const [choosing, setChoosing] = useState<DateOption | null>(null);
  const [removing, setRemoving] = useState(false);
  const [busy, setBusy] = useState(false);
  const today = now.toISOString().slice(0, 10);

  useEffect(() => setEditing(false), [plan.id]);

  const view = page?.dates ?? null;
  const open = view?.status === "open";

  const propose = async (windows: DateWindow[], deadline: string | null) => {
    const next = await proposeDates(windows, deadline);
    setPage(next);
    setEditing(false);
    setMessage({
      title: view ? "Fechas cambiadas" : "Fechas propuestas",
      intro: "Pega este mensaje en el grupo. Lleva la dirección de la votación y las invitaciones de quien aún no ha entrado.",
      text: next.message,
    });
  };

  const choose = async () => {
    if (!choosing) return;
    setBusy(true);
    try {
      setPage(await chooseDates(choosing.id));
      toast(`Fechas elegidas: ${rangeLabel(choosing.dateFrom, choosing.dateTo)}`);
      setChoosing(null);
    } catch (e) {
      toast(`No se pudo: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      setPage(await cancelDates());
      toast("Votación de fechas quitada");
      setRemoving(false);
    } catch (e) {
      toast(`No se pudo: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const answered = view && page ? page.people.filter((p) => answeredAll(view, p.id)).length : 0;
  const chosen = view?.options.find((o) => o.id === view.chosenOptionId);

  return (
    <PanelShell>
      <main className="mx-auto flex w-full max-w-[1100px] flex-col gap-[26px] px-4 py-8 sm:px-8">
        <PageHeader
          title="Fechas"
          subtitle={
            !view
              ? state.datesDecided
                ? `${plan.name} · fechas decididas`
                : `${plan.name} · fíjalas, o propón varias y la cuadrilla dice cuáles le vienen bien`
              : open
                ? `${plan.name} · ${answered} de ${page!.people.length} han respondido${view.deadline ? ` · responder antes del ${deadlineLabel(view.deadline)}` : ""}`
                : `${plan.name} · fechas decididas`
          }
          actions={
            view && !editing ? (
              <div className="flex flex-wrap gap-2">
                {open && (
                  <Button variant="ghost" onClick={() => void load()}>
                    Actualizar
                  </Button>
                )}
                <Button onClick={() => setEditing(true)}>Cambiar fechas</Button>
                {open ? (
                  <Button
                    variant="primary"
                    disabled={!page?.reminder}
                    onClick={() => setMessage({ title: "Recordatorio", intro: "Nombra a quien falta por responder.", text: page!.reminder! })}
                  >
                    Recordar a quien falta
                  </Button>
                ) : (
                  page?.announcement && (
                    <Button variant="primary" onClick={() => setMessage({ title: "Fechas decididas", intro: "Pega este mensaje en el grupo.", text: page.announcement! })}>
                      Anunciar las fechas
                    </Button>
                  )
                )}
              </div>
            ) : null
          }
        />

        {error && (
          <Notice role="alert">
            No se pudieron leer las fechas del sitio: {error}{" "}
            <button type="button" onClick={() => void load()} className="cursor-pointer border-0 bg-transparent p-0 font-semibold text-accent">
              Reintentar
            </button>
          </Notice>
        )}
        {!page && !error && <Skeleton className="h-64 rounded-card" />}

        {page && !view && !editing && <SettleDates decided={state.datesDecided} plan={plan} min={addDaysIso(today, 1)} onFix={fixDates} />}

        {/* Decided: whether everyone has the days off, before booking. */}
        {page && !editing && (state.datesDecided || !!chosen) && <LeaveCard />}

        {page && !view && !editing && !state.datesDecided && (
          <Heading as="h2" size="subheading" className="-mb-2">
            O propón varias y que la cuadrilla diga cuáles le vienen bien
          </Heading>
        )}

        {page && ((!view && !state.datesDecided) || editing) && (
          <DatesEditor
            key={view ? view.options.map((o) => o.id).join() : "new"}
            initial={view?.options ?? []}
            initialDeadline={view?.deadline ?? null}
            today={today}
            reopening={!!view && !open}
            submitLabel={view ? (open ? "Guardar cambios" : "Volver a abrir") : "Proponer fechas"}
            onSubmit={propose}
            onCancel={view ? () => setEditing(false) : undefined}
          />
        )}

        {page && view && !editing && (
          <>
            <Card variant="raised" className="flex flex-wrap items-end justify-between gap-3">
              {chosen ? (
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-bold text-muted uppercase">Fechas elegidas</span>
                  <Heading size="headline">{rangeLabel(chosen.dateFrom, chosen.dateTo)}</Heading>
                  <span className="text-sm text-muted">
                    {nights(chosen)} · el viaje ya tiene estas fechas. Los precios comprobados para otras se marcan para volver a mirarlos.
                  </span>
                </div>
              ) : (
                <BestSoFar view={view} />
              )}
            </Card>

            <DatesTable view={view} people={page.people} onChoose={open ? setChoosing : undefined} />

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-faint pt-4">
              <span className="text-[13px] text-muted">
                Todos los del viaje ven esta tabla en el sitio. Responder no cierra nada: las fechas se deciden cuando eliges unas.
              </span>
              <Button variant="ghost" onClick={() => setRemoving(true)}>
                Quitar la votación de fechas
              </Button>
            </div>
          </>
        )}
      </main>

      <Dialog
        open={choosing !== null}
        title={choosing ? `¿Elegir ${rangeLabel(choosing.dateFrom, choosing.dateTo)}?` : ""}
        confirmLabel={busy ? "Eligiendo…" : "Elegir estas fechas"}
        busy={busy}
        onConfirm={() => void choose()}
        onClose={() => setChoosing(null)}
      >
        El viaje pasa a estas fechas, aquí y en el sitio, y la votación de fechas se cierra. Los precios comprobados para otras fechas quedarán marcados para volver a
        comprobarlos.
      </Dialog>

      <Dialog
        open={removing}
        title="¿Quitar la votación de fechas?"
        confirmLabel={busy ? "Quitando…" : "Quitar"}
        tone="warning"
        busy={busy}
        onConfirm={() => void remove()}
        onClose={() => setRemoving(false)}
      >
        Se borran las opciones y lo que ha respondido cada uno. Las fechas del viaje no cambian.
      </Dialog>

      {message && <MessageDialog open title={message.title} intro={message.intro} message={message.text} onClose={() => setMessage(null)} />}
    </PanelShell>
  );
}

// The windows that suit the group best so far.
// "Ya sabemos las fechas": the organiser settles them without a vote, and
// Cuándo is done. Once settled, they can be changed or talked about again.
function SettleDates({ decided, plan, min, onFix }: { decided: boolean; plan: { dateFrom: string; dateTo: string }; min: string; onFix: (w: DateWindow | null) => Promise<void> }) {
  const toast = useToast();
  const [changing, setChanging] = useState(false);
  const [range, setRange] = useState<DateRange>({ start: plan.dateFrom, end: plan.dateTo });
  const [busy, setBusy] = useState(false);
  const run = async (w: DateWindow | null, done: string) => {
    setBusy(true);
    try {
      await onFix(w);
      setChanging(false);
      toast(done);
    } catch (e) {
      toast(`No se pudo: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  if (decided && !changing) {
    return (
      <Card variant="raised" className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-bold text-muted uppercase">Fechas decididas</span>
          <Heading size="headline">{rangeLabel(plan.dateFrom, plan.dateTo)}</Heading>
          <span className="text-sm text-muted">{nights(plan)} · sin votación</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" disabled={busy} onClick={() => void run(null, "Las fechas vuelven a estar por decidir")}>
            Volver a decidirlas
          </Button>
          <Button onClick={() => setChanging(true)}>Cambiar fechas</Button>
        </div>
      </Card>
    );
  }
  const ready = !!range.start && !!range.end;
  return (
    <Card variant="raised" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Heading as="h2" size="subheading">
          {changing ? "Cambiar las fechas" : "¿Ya sabéis las fechas?"}
        </Heading>
        <span className="text-sm text-muted">Elige la ida y la vuelta y fíjalas: no hace falta votar. Los precios comprobados para otras fechas se marcan para volver a mirarlos.</span>
      </div>
      <div className="max-w-[440px]">
        <TripDates value={range} onChange={setRange} min={min} />
      </div>
      <div className="flex flex-wrap gap-2">
        {changing && <Button onClick={() => setChanging(false)}>Cancelar</Button>}
        <Button
          variant="primary"
          disabled={busy || !ready}
          onClick={() => ready && void run({ dateFrom: range.start!, dateTo: range.end! }, `Fechas fijadas: ${rangeLabel(range.start!, range.end!)}`)}
        >
          {busy ? "Guardando…" : "Fijar estas fechas"}
        </Button>
      </div>
    </Card>
  );
}

function BestSoFar({ view }: { view: DatesView }) {
  const best = bestDateOptions(view);
  const counts = new Map(dateCounts(view).map((c) => [c.id, c]));
  if (!best.length) {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-sm font-bold text-muted uppercase">Van ganando</span>
        <Heading size="subheading">Todavía no ha respondido nadie</Heading>
      </div>
    );
  }
  const labels = best.map((id) => {
    const o = view.options.find((x) => x.id === id)!;
    return rangeLabel(o.dateFrom, o.dateTo);
  });
  const c = counts.get(best[0]!)!;
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-bold text-muted uppercase">{best.length > 1 ? "Van empatadas" : "Van ganando"}</span>
      <Heading size="headline">{labels.join(" · ")}</Heading>
      <span className="text-sm text-muted">
        {c.yes} sí · {c.maybe} si hace falta · {c.no} no
      </span>
    </div>
  );
}

export const ANSWER_TONE: Record<DateAnswer, BadgeTone> = { yes: "accent", maybe: "neutral", no: "muted" };

// People by windows: who can go when. The organiser chooses from here.
function DatesTable({ view, people, onChoose }: { view: DatesView; people: { id: string; name: string }[]; onChoose?: (o: DateOption) => void }) {
  const best = new Set(bestDateOptions(view));
  const counts = new Map(dateCounts(view).map((c) => [c.id, c]));
  const byMember = new Map(view.responses.map((r) => [r.memberId, r]));
  return (
    <Card variant="raised" padding="sm" className="overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse text-sm">
        <caption className="sr-only">Quién puede cuándo</caption>
        <thead>
          <tr className="text-left align-bottom">
            <th scope="col" className="px-3 py-2.5 text-xs font-bold text-muted uppercase">
              Persona
            </th>
            {view.options.map((o) => (
              <th key={o.id} scope="col" className={cn("px-3 py-2.5", o.id === view.chosenOptionId && "bg-accent-soft")}>
                <span className="flex flex-col items-start gap-1">
                  <span className="font-bold whitespace-nowrap">{rangeLabel(o.dateFrom, o.dateTo)}</span>
                  <span className="text-xs font-normal text-muted">
                    {shortDate(o.dateFrom)} · {nights(o)}
                  </span>
                  {o.id === view.chosenOptionId ? (
                    <Badge tone="accent-solid">Elegidas</Badge>
                  ) : (
                    view.status === "open" && best.has(o.id) && <Badge tone="accent">Las mejores</Badge>
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {people.map((p) => {
            const r = byMember.get(p.id);
            return (
              <tr key={p.id} className="border-t border-line-faint">
                <th scope="row" className="px-3 py-2.5 text-left font-normal">
                  <span className="flex items-center gap-2.5">
                    <Avatar initials={initials(p.name)} name={p.name} tint={avatarTint(p.id)} size="sm" />
                    <span className="flex min-w-0 flex-col">
                      <span className="font-semibold">{p.name}</span>
                      {r?.note && <span className="text-xs text-muted">«{r.note}»</span>}
                      {!r && <span className="text-xs text-muted">Sin responder</span>}
                    </span>
                  </span>
                </th>
                {view.options.map((o) => {
                  const a = r?.answers[o.id];
                  return (
                    <td key={o.id} className={cn("px-3 py-2.5", o.id === view.chosenOptionId && "bg-accent-soft/60")}>
                      {a ? <Badge tone={ANSWER_TONE[a]}>{DATE_ANSWER_LABEL[a]}</Badge> : <span className="text-faint">—</span>}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-line-soft align-top">
            <th scope="row" className="px-3 py-2.5 text-left text-xs font-bold text-muted uppercase">
              En total
            </th>
            {view.options.map((o) => {
              const c = counts.get(o.id)!;
              return (
                <td key={o.id} className="px-3 py-2.5">
                  <span className="flex flex-col gap-2">
                    <span className="text-xs text-ink-2 tabular-nums">
                      {c.yes} sí · {c.maybe} si hace falta · {c.no} no
                    </span>
                    {onChoose && (
                      <Button size="sm" onClick={() => onChoose(o)} aria-label={`Elegir ${rangeLabel(o.dateFrom, o.dateTo)}`}>
                        Elegir
                      </Button>
                    )}
                  </span>
                </td>
              );
            })}
          </tr>
        </tfoot>
      </table>
    </Card>
  );
}

// Proposing (or changing) the windows: pick each on the calendar and add it.
function DatesEditor({
  initial,
  initialDeadline,
  today,
  reopening,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: DateWindow[];
  initialDeadline: string | null;
  today: string;
  reopening: boolean;
  submitLabel: string;
  onSubmit: (windows: DateWindow[], deadline: string | null) => Promise<void>;
  onCancel?: () => void;
}) {
  const min = addDaysIso(today, 1);
  const [windows, setWindows] = useState<DateWindow[]>(initial.map(({ dateFrom, dateTo }) => ({ dateFrom, dateTo })));
  const [range, setRange] = useState<DateRange>({ start: null, end: null });
  const opening = initial[0]?.dateFrom ?? min;
  const [month, setMonth] = useState({ year: Number(opening.slice(0, 4)), month0: Number(opening.slice(5, 7)) - 1 });
  // The day answers are due, at 23:59 in the organiser's time zone.
  // (The deadline's day where the organiser is: "sv" writes dates as YYYY-MM-DD.)
  const [deadline, setDeadline] = useState(initialDeadline ? new Date(initialDeadline).toLocaleDateString("sv") : "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sorted = [...windows].sort((a, b) => a.dateFrom.localeCompare(b.dateFrom) || a.dateTo.localeCompare(b.dateTo));
  const picked = range.start && range.end ? { dateFrom: range.start, dateTo: range.end } : null;
  const duplicate = picked && windows.some((w) => dateOptionId(w.dateFrom, w.dateTo) === dateOptionId(picked.dateFrom, picked.dateTo));
  const full = windows.length >= MAX_DATE_OPTIONS;

  const add = () => {
    if (!picked || duplicate || full) return;
    setWindows([...windows, picked]);
    setRange({ start: null, end: null });
  };

  const submit = async () => {
    if (windows.length < MIN_DATE_OPTIONS) return setError(`Añade al menos ${MIN_DATE_OPTIONS} opciones`);
    setBusy(true);
    setError(null);
    try {
      await onSubmit(sorted, deadline ? new Date(`${deadline}T23:59:00`).toISOString() : null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-label="Votación de fechas" className="grid gap-5 lg:grid-cols-2">
      <Card variant="raised" className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <Heading size="subheading">Elige unas fechas</Heading>
          <span className="text-sm font-semibold text-accent-strong tabular-nums" aria-live="polite">
            {datesSummary(range)}
          </span>
        </div>
        <Calendar {...month} onMonthChange={setMonth} start={range.start} end={range.end} min={min} onPick={(d) => setRange(pickRange(range, d))} />
        <Button variant="primary" disabled={!picked || !!duplicate || full} onClick={add}>
          {full ? `Como mucho ${MAX_DATE_OPTIONS} opciones` : duplicate ? "Ya está entre las opciones" : "Añadir estas fechas"}
        </Button>
      </Card>

      <Card variant="raised" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <Heading size="subheading">Opciones</Heading>
          <span className="text-sm text-muted">
            De {MIN_DATE_OPTIONS} a {MAX_DATE_OPTIONS}. Cada uno dirá, para cada una, Sí, Si hace falta o No. Cuando elijas unas, el viaje tomará esas fechas.
          </span>
        </div>
        {sorted.length ? (
          <ul aria-label="Opciones" className="m-0 flex list-none flex-col gap-2 p-0">
            {sorted.map((w) => {
              const label = rangeLabel(w.dateFrom, w.dateTo);
              return (
                <li key={dateOptionId(w.dateFrom, w.dateTo)} className="flex items-center justify-between gap-3 rounded-xl bg-surface-2 px-3.5 py-2.5">
                  <span className="flex flex-col">
                    <span className="font-semibold">{label}</span>
                    <span className="text-[13px] text-muted">
                      Del {shortDate(w.dateFrom)} al {shortDate(w.dateTo)} · {nights(w)}
                    </span>
                  </span>
                  <IconButton label={`Quitar ${label}`} size="md" onClick={() => setWindows(windows.filter((x) => x !== w))}>
                    <TrashIcon size={16} />
                  </IconButton>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="m-0 rounded-xl bg-surface-2 px-3.5 py-3 text-sm text-muted">Todavía no hay opciones: elige la primera en el calendario.</p>
        )}
        <Field label="Responder antes del (opcional)" aside={deadline ? deadlineLabel(new Date(`${deadline}T23:59:00`).toISOString()) : undefined}>
          {({ inputId }) => <TextInput id={inputId} type="date" min={min} value={deadline} onChange={(e) => setDeadline(e.target.value)} />}
        </Field>
        {reopening && <Notice>Al guardar, la votación de fechas se abre otra vez. Las fechas del viaje no cambian hasta que elijas unas.</Notice>}
        {error && <Notice role="alert">{error}</Notice>}
        <div className="mt-auto flex flex-wrap justify-end gap-2 border-t border-line-faint pt-3.5">
          {onCancel && <Button onClick={onCancel}>Cancelar</Button>}
          <Button variant="primary" disabled={busy || windows.length < MIN_DATE_OPTIONS} onClick={() => void submit()}>
            {busy ? "Guardando…" : submitLabel}
          </Button>
        </div>
      </Card>
    </section>
  );
}
