import { useCallback, useEffect, useState } from "react";
import {
  MAX_DATE_OPTIONS,
  MIN_DATE_OPTIONS,
  addDaysIso,
  answeredAll,
  copy,
  dateAnswerLabel,
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
  useCopy,
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

const COPY = copy({
  es: {
    title: "Fechas",
    changed: "Fechas cambiadas",
    proposed: "Fechas propuestas",
    pasteIntro: "Pega este mensaje en el grupo. Lleva la dirección de la votación y las invitaciones de quien aún no ha entrado.",
    chosenToast: (range: string) => `Fechas elegidas: ${range}`,
    failed: (msg: string) => `No se pudo: ${msg}`,
    removedToast: "Votación de fechas quitada",
    subtitleDecided: (name: string) => `${name} · fechas decididas`,
    subtitleNone: (name: string) => `${name} · fíjalas, o propón varias y la cuadrilla dice cuáles le vienen bien`,
    subtitleOpen: (name: string, answered: number, total: number, deadline: string | null) =>
      `${name} · ${answered} de ${total} han respondido${deadline ? ` · responder antes del ${deadline}` : ""}`,
    refresh: "Actualizar",
    changeDates: "Cambiar fechas",
    reminderTitle: "Recordatorio",
    reminderIntro: "Nombra a quien falta por responder.",
    remind: "Recordar a quien falta",
    decided: "Fechas decididas",
    pasteShort: "Pega este mensaje en el grupo.",
    announce: "Anunciar las fechas",
    loadError: "No se pudieron leer las fechas del sitio:",
    retry: "Reintentar",
    orPropose: "O propón varias y que la cuadrilla diga cuáles le vienen bien",
    saveChanges: "Guardar cambios",
    reopen: "Volver a abrir",
    proposeDates: "Proponer fechas",
    chosen: "Fechas elegidas",
    chosenNote: (nights: string) => `${nights} · el viaje ya tiene estas fechas. Los precios comprobados para otras se marcan para volver a mirarlos.`,
    everyoneSees: "Todos los del viaje ven esta tabla en el sitio. Responder no cierra nada: las fechas se deciden cuando eliges unas.",
    removeVote: "Quitar la votación de fechas",
    chooseTitle: (range: string) => `¿Elegir ${range}?`,
    choosing: "Eligiendo…",
    chooseThese: "Elegir estas fechas",
    chooseText: "El viaje pasa a estas fechas, aquí y en el sitio, y la votación de fechas se cierra. Los precios comprobados para otras fechas quedarán marcados para volver a comprobarlos.",
    removeTitle: "¿Quitar la votación de fechas?",
    removing: "Quitando…",
    remove: "Quitar",
    removeText: "Se borran las opciones y lo que ha respondido cada uno. Las fechas del viaje no cambian.",
    nights: (n: number) => `${n} ${n === 1 ? "noche" : "noches"}`,
    undecidedToast: "Las fechas vuelven a estar por decidir",
    noVote: (nights: string) => `${nights} · sin votación`,
    redecide: "Volver a decidirlas",
    changeTheDates: "Cambiar las fechas",
    knowDates: "¿Ya sabéis las fechas?",
    settleHint: "Elige la ida y la vuelta y fíjalas: no hace falta votar. Los precios comprobados para otras fechas se marcan para volver a mirarlos.",
    cancel: "Cancelar",
    fixedToast: (range: string) => `Fechas fijadas: ${range}`,
    saving: "Guardando…",
    fixThese: "Fijar estas fechas",
    leading: "Van ganando",
    tied: "Van empatadas",
    nobodyYet: "Todavía no ha respondido nadie",
    counts: (yes: number, maybe: number, no: number) => `${yes} sí · ${maybe} si hace falta · ${no} no`,
    caption: "Quién puede cuándo",
    person: "Persona",
    chosenBadge: "Elegidas",
    best: "Las mejores",
    note: (note: string) => `«${note}»`,
    noAnswer: "Sin responder",
    total: "En total",
    choose: "Elegir",
    chooseAria: (range: string) => `Elegir ${range}`,
    minError: (n: number) => `Añade al menos ${n} opciones`,
    section: "Votación de fechas",
    pick: "Elige unas fechas",
    atMost: (n: number) => `Como mucho ${n} opciones`,
    already: "Ya está entre las opciones",
    addThese: "Añadir estas fechas",
    options: "Opciones",
    optionsHint: (min: number, max: number) =>
      `De ${min} a ${max}. Cada uno dirá, para cada una, Sí, Si hace falta o No. Cuando elijas unas, el viaje tomará esas fechas.`,
    fromTo: (from: string, to: string, nights: string) => `Del ${from} al ${to} · ${nights}`,
    removeAria: (label: string) => `Quitar ${label}`,
    empty: "Todavía no hay opciones: elige la primera en el calendario.",
    deadline: "Responder antes del (opcional)",
    reopenNotice: "Al guardar, la votación de fechas se abre otra vez. Las fechas del viaje no cambian hasta que elijas unas.",
  },
  en: {
    title: "Dates",
    changed: "Dates changed",
    proposed: "Dates proposed",
    pasteIntro: "Paste this message into the group. It has the link to the vote and invitations for anyone who hasn't joined yet.",
    chosenToast: (range: string) => `Dates chosen: ${range}`,
    failed: (msg: string) => `Couldn't do it: ${msg}`,
    removedToast: "Dates vote removed",
    subtitleDecided: (name: string) => `${name} · dates decided`,
    subtitleNone: (name: string) => `${name} · set them, or propose a few and the group says which suit them`,
    subtitleOpen: (name: string, answered: number, total: number, deadline: string | null) =>
      `${name} · ${answered} of ${total} have answered${deadline ? ` · answer by ${deadline}` : ""}`,
    refresh: "Refresh",
    changeDates: "Change dates",
    reminderTitle: "Reminder",
    reminderIntro: "It names whoever still has to answer.",
    remind: "Remind the rest",
    decided: "Dates decided",
    pasteShort: "Paste this message into the group.",
    announce: "Announce the dates",
    loadError: "Couldn't read the dates from the site:",
    retry: "Try again",
    orPropose: "Or propose a few and let the group say which suit them",
    saveChanges: "Save changes",
    reopen: "Reopen",
    proposeDates: "Propose dates",
    chosen: "Chosen dates",
    chosenNote: (nights: string) => `${nights} · the trip now has these dates. Prices checked for other dates are marked to be checked again.`,
    everyoneSees: "Everyone on the trip sees this table on the site. Answering doesn't settle anything: the dates are decided when you choose some.",
    removeVote: "Remove the dates vote",
    chooseTitle: (range: string) => `Choose ${range}?`,
    choosing: "Choosing…",
    chooseThese: "Choose these dates",
    chooseText: "The trip moves to these dates, here and on the site, and the dates vote closes. Prices checked for other dates will be marked to be checked again.",
    removeTitle: "Remove the dates vote?",
    removing: "Removing…",
    remove: "Remove",
    removeText: "The options and everyone's answers are deleted. The trip's dates don't change.",
    nights: (n: number) => `${n} ${n === 1 ? "night" : "nights"}`,
    undecidedToast: "The dates are undecided again",
    noVote: (nights: string) => `${nights} · no vote`,
    redecide: "Decide them again",
    changeTheDates: "Change the dates",
    knowDates: "Already know the dates?",
    settleHint: "Pick the outbound and return days and set them: no need to vote. Prices checked for other dates are marked to be checked again.",
    cancel: "Cancel",
    fixedToast: (range: string) => `Dates set: ${range}`,
    saving: "Saving…",
    fixThese: "Set these dates",
    leading: "In the lead",
    tied: "Tied",
    nobodyYet: "Nobody has answered yet",
    counts: (yes: number, maybe: number, no: number) => `${yes} yes · ${maybe} if need be · ${no} no`,
    caption: "Who can go when",
    person: "Person",
    chosenBadge: "Chosen",
    best: "The best",
    note: (note: string) => `“${note}”`,
    noAnswer: "Not answered",
    total: "In total",
    choose: "Choose",
    chooseAria: (range: string) => `Choose ${range}`,
    minError: (n: number) => `Add at least ${n} options`,
    section: "Dates vote",
    pick: "Pick some dates",
    atMost: (n: number) => `${n} options at most`,
    already: "Already one of the options",
    addThese: "Add these dates",
    options: "Options",
    optionsHint: (min: number, max: number) =>
      `${min} to ${max}. For each one, everyone will say Yes, If need be or No. When you choose one, the trip takes those dates.`,
    fromTo: (from: string, to: string, nights: string) => `${from} to ${to} · ${nights}`,
    removeAria: (label: string) => `Remove ${label}`,
    empty: "No options yet: pick the first one on the calendar.",
    deadline: "Answer by (optional)",
    reopenNotice: "Saving opens the dates vote again. The trip's dates don't change until you choose some.",
  },
});

// Cuándo (ROADMAP 2.1): propose 2–5 date windows, see who can go when, and
// choose. Choosing gives the trip those dates, here and on the site.
export function FechasPage() {
  const { state, dates, proposeDates, chooseDates, cancelDates, fixDates, now } = usePanel();
  const t = useCopy(COPY);
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
      title: view ? t.changed : t.proposed,
      intro: t.pasteIntro,
      text: next.message,
    });
  };

  const choose = async () => {
    if (!choosing) return;
    setBusy(true);
    try {
      setPage(await chooseDates(choosing.id));
      toast(t.chosenToast(rangeLabel(choosing.dateFrom, choosing.dateTo)));
      setChoosing(null);
    } catch (e) {
      toast(t.failed((e as Error).message));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      setPage(await cancelDates());
      toast(t.removedToast);
      setRemoving(false);
    } catch (e) {
      toast(t.failed((e as Error).message));
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
          title={t.title}
          subtitle={
            !view
              ? state.datesDecided
                ? t.subtitleDecided(plan.name)
                : t.subtitleNone(plan.name)
              : open
                ? t.subtitleOpen(plan.name, answered, page!.people.length, view.deadline ? deadlineLabel(view.deadline) : null)
                : t.subtitleDecided(plan.name)
          }
          actions={
            view && !editing ? (
              <div className="flex flex-wrap gap-2">
                {open && (
                  <Button variant="ghost" onClick={() => void load()}>
                    {t.refresh}
                  </Button>
                )}
                <Button onClick={() => setEditing(true)}>{t.changeDates}</Button>
                {open ? (
                  <Button
                    variant="primary"
                    disabled={!page?.reminder}
                    onClick={() => setMessage({ title: t.reminderTitle, intro: t.reminderIntro, text: page!.reminder! })}
                  >
                    {t.remind}
                  </Button>
                ) : (
                  page?.announcement && (
                    <Button variant="primary" onClick={() => setMessage({ title: t.decided, intro: t.pasteShort, text: page.announcement! })}>
                      {t.announce}
                    </Button>
                  )
                )}
              </div>
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
        {!page && !error && <Skeleton className="h-64 rounded-card" />}

        {page && !view && !editing && <SettleDates decided={state.datesDecided} plan={plan} min={addDaysIso(today, 1)} onFix={fixDates} />}

        {/* Decided: whether everyone has the days off, before booking. */}
        {page && !editing && (state.datesDecided || !!chosen) && <LeaveCard />}

        {page && !view && !editing && !state.datesDecided && (
          <Heading as="h2" size="subheading" className="-mb-2">
            {t.orPropose}
          </Heading>
        )}

        {page && ((!view && !state.datesDecided) || editing) && (
          <DatesEditor
            key={view ? view.options.map((o) => o.id).join() : "new"}
            initial={view?.options ?? []}
            initialDeadline={view?.deadline ?? null}
            today={today}
            reopening={!!view && !open}
            submitLabel={view ? (open ? t.saveChanges : t.reopen) : t.proposeDates}
            onSubmit={propose}
            onCancel={view ? () => setEditing(false) : undefined}
          />
        )}

        {page && view && !editing && (
          <>
            <Card variant="raised" className="flex flex-wrap items-end justify-between gap-3">
              {chosen ? (
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-bold text-muted uppercase">{t.chosen}</span>
                  <Heading size="headline">{rangeLabel(chosen.dateFrom, chosen.dateTo)}</Heading>
                  <span className="text-sm text-muted">
                    {t.chosenNote(t.nights(nightsOf(chosen)))}
                  </span>
                </div>
              ) : (
                <BestSoFar view={view} />
              )}
            </Card>

            <DatesTable view={view} people={page.people} onChoose={open ? setChoosing : undefined} />

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-faint pt-4">
              <span className="text-[13px] text-muted">
                {t.everyoneSees}
              </span>
              <Button variant="ghost" onClick={() => setRemoving(true)}>
                {t.removeVote}
              </Button>
            </div>
          </>
        )}
      </main>

      <Dialog
        open={choosing !== null}
        title={choosing ? t.chooseTitle(rangeLabel(choosing.dateFrom, choosing.dateTo)) : ""}
        confirmLabel={busy ? t.choosing : t.chooseThese}
        busy={busy}
        onConfirm={() => void choose()}
        onClose={() => setChoosing(null)}
      >
        {t.chooseText}
      </Dialog>

      <Dialog
        open={removing}
        title={t.removeTitle}
        confirmLabel={busy ? t.removing : t.remove}
        tone="warning"
        busy={busy}
        onConfirm={() => void remove()}
        onClose={() => setRemoving(false)}
      >
        {t.removeText}
      </Dialog>

      {message && <MessageDialog open title={message.title} intro={message.intro} message={message.text} onClose={() => setMessage(null)} />}
    </PanelShell>
  );
}

// The windows that suit the group best so far.
// "Ya sabemos las fechas": the organiser settles them without a vote, and
// Cuándo is done. Once settled, they can be changed or talked about again.
function SettleDates({ decided, plan, min, onFix }: { decided: boolean; plan: { dateFrom: string; dateTo: string }; min: string; onFix: (w: DateWindow | null) => Promise<void> }) {
  const t = useCopy(COPY);
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
      toast(t.failed((e as Error).message));
    } finally {
      setBusy(false);
    }
  };

  if (decided && !changing) {
    return (
      <Card variant="raised" className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-bold text-muted uppercase">{t.decided}</span>
          <Heading size="headline">{rangeLabel(plan.dateFrom, plan.dateTo)}</Heading>
          <span className="text-sm text-muted">{t.noVote(t.nights(nightsOf(plan)))}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" disabled={busy} onClick={() => void run(null, t.undecidedToast)}>
            {t.redecide}
          </Button>
          <Button onClick={() => setChanging(true)}>{t.changeDates}</Button>
        </div>
      </Card>
    );
  }
  const ready = !!range.start && !!range.end;
  return (
    <Card variant="raised" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Heading as="h2" size="subheading">
          {changing ? t.changeTheDates : t.knowDates}
        </Heading>
        <span className="text-sm text-muted">{t.settleHint}</span>
      </div>
      <div className="max-w-[440px]">
        <TripDates value={range} onChange={setRange} min={min} />
      </div>
      <div className="flex flex-wrap gap-2">
        {changing && <Button onClick={() => setChanging(false)}>{t.cancel}</Button>}
        <Button
          variant="primary"
          disabled={busy || !ready}
          onClick={() => ready && void run({ dateFrom: range.start!, dateTo: range.end! }, t.fixedToast(rangeLabel(range.start!, range.end!)))}
        >
          {busy ? t.saving : t.fixThese}
        </Button>
      </div>
    </Card>
  );
}

function BestSoFar({ view }: { view: DatesView }) {
  const t = useCopy(COPY);
  const best = bestDateOptions(view);
  const counts = new Map(dateCounts(view).map((c) => [c.id, c]));
  if (!best.length) {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-sm font-bold text-muted uppercase">{t.leading}</span>
        <Heading size="subheading">{t.nobodyYet}</Heading>
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
      <span className="text-sm font-bold text-muted uppercase">{best.length > 1 ? t.tied : t.leading}</span>
      <Heading size="headline">{labels.join(" · ")}</Heading>
      <span className="text-sm text-muted">{t.counts(c.yes, c.maybe, c.no)}</span>
    </div>
  );
}

export const ANSWER_TONE: Record<DateAnswer, BadgeTone> = { yes: "accent", maybe: "neutral", no: "muted" };

// People by windows: who can go when. The organiser chooses from here.
function DatesTable({ view, people, onChoose }: { view: DatesView; people: { id: string; name: string }[]; onChoose?: (o: DateOption) => void }) {
  const t = useCopy(COPY);
  const best = new Set(bestDateOptions(view));
  const counts = new Map(dateCounts(view).map((c) => [c.id, c]));
  const byMember = new Map(view.responses.map((r) => [r.memberId, r]));
  return (
    <Card variant="raised" padding="sm" className="overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse text-sm">
        <caption className="sr-only">{t.caption}</caption>
        <thead>
          <tr className="text-left align-bottom">
            <th scope="col" className="px-3 py-2.5 text-xs font-bold text-muted uppercase">
              {t.person}
            </th>
            {view.options.map((o) => (
              <th key={o.id} scope="col" className={cn("px-3 py-2.5", o.id === view.chosenOptionId && "bg-accent-soft")}>
                <span className="flex flex-col items-start gap-1">
                  <span className="font-bold whitespace-nowrap">{rangeLabel(o.dateFrom, o.dateTo)}</span>
                  <span className="text-xs font-normal text-muted">
                    {shortDate(o.dateFrom)} · {t.nights(nightsOf(o))}
                  </span>
                  {o.id === view.chosenOptionId ? (
                    <Badge tone="accent-solid">{t.chosenBadge}</Badge>
                  ) : (
                    view.status === "open" && best.has(o.id) && <Badge tone="accent">{t.best}</Badge>
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
                      {r?.note && <span className="text-xs text-muted">{t.note(r.note)}</span>}
                      {!r && <span className="text-xs text-muted">{t.noAnswer}</span>}
                    </span>
                  </span>
                </th>
                {view.options.map((o) => {
                  const a = r?.answers[o.id];
                  return (
                    <td key={o.id} className={cn("px-3 py-2.5", o.id === view.chosenOptionId && "bg-accent-soft/60")}>
                      {a ? <Badge tone={ANSWER_TONE[a]}>{dateAnswerLabel(a)}</Badge> : <span className="text-faint">—</span>}
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
              {t.total}
            </th>
            {view.options.map((o) => {
              const c = counts.get(o.id)!;
              return (
                <td key={o.id} className="px-3 py-2.5">
                  <span className="flex flex-col gap-2">
                    <span className="text-xs text-ink-2 tabular-nums">{t.counts(c.yes, c.maybe, c.no)}</span>
                    {onChoose && (
                      <Button size="sm" onClick={() => onChoose(o)} aria-label={t.chooseAria(rangeLabel(o.dateFrom, o.dateTo))}>
                        {t.choose}
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
  const t = useCopy(COPY);
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
    if (windows.length < MIN_DATE_OPTIONS) return setError(t.minError(MIN_DATE_OPTIONS));
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
    <section aria-label={t.section} className="grid gap-5 lg:grid-cols-2">
      <Card variant="raised" className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <Heading size="subheading">{t.pick}</Heading>
          <span className="text-sm font-semibold text-accent-strong tabular-nums" aria-live="polite">
            {datesSummary(range)}
          </span>
        </div>
        <Calendar {...month} onMonthChange={setMonth} start={range.start} end={range.end} min={min} onPick={(d) => setRange(pickRange(range, d))} />
        <Button variant="primary" disabled={!picked || !!duplicate || full} onClick={add}>
          {full ? t.atMost(MAX_DATE_OPTIONS) : duplicate ? t.already : t.addThese}
        </Button>
      </Card>

      <Card variant="raised" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <Heading size="subheading">{t.options}</Heading>
          <span className="text-sm text-muted">{t.optionsHint(MIN_DATE_OPTIONS, MAX_DATE_OPTIONS)}</span>
        </div>
        {sorted.length ? (
          <ul aria-label={t.options} className="m-0 flex list-none flex-col gap-2 p-0">
            {sorted.map((w) => {
              const label = rangeLabel(w.dateFrom, w.dateTo);
              return (
                <li key={dateOptionId(w.dateFrom, w.dateTo)} className="flex items-center justify-between gap-3 rounded-xl bg-surface-2 px-3.5 py-2.5">
                  <span className="flex flex-col">
                    <span className="font-semibold">{label}</span>
                    <span className="text-[13px] text-muted">
                      {t.fromTo(shortDate(w.dateFrom), shortDate(w.dateTo), t.nights(nightsOf(w)))}
                    </span>
                  </span>
                  <IconButton label={t.removeAria(label)} size="md" onClick={() => setWindows(windows.filter((x) => x !== w))}>
                    <TrashIcon size={16} />
                  </IconButton>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="m-0 rounded-xl bg-surface-2 px-3.5 py-3 text-sm text-muted">{t.empty}</p>
        )}
        <Field label={t.deadline} aside={deadline ? deadlineLabel(new Date(`${deadline}T23:59:00`).toISOString()) : undefined}>
          {({ inputId }) => <TextInput id={inputId} type="date" min={min} value={deadline} onChange={(e) => setDeadline(e.target.value)} />}
        </Field>
        {reopening && <Notice>{t.reopenNotice}</Notice>}
        {error && <Notice role="alert">{error}</Notice>}
        <div className="mt-auto flex flex-wrap justify-end gap-2 border-t border-line-faint pt-3.5">
          {onCancel && <Button onClick={onCancel}>{t.cancel}</Button>}
          <Button variant="primary" disabled={busy || windows.length < MIN_DATE_OPTIONS} onClick={() => void submit()}>
            {busy ? t.saving : submitLabel}
          </Button>
        </div>
      </Card>
    </section>
  );
}
