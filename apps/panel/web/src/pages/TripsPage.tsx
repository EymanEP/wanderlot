import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { addDaysIso, copy, mediumDate, rangeLabel, type Plan } from "@wanderlot/core";
import { Badge, Button, Card, Dialog, EmptyState, Field, Heading, Notice, PageHeader, Skeleton, TextInput, buttonClasses, nightsBetween, useCopy, useToast, type DateRange } from "@wanderlot/ui";
import { PanelShell } from "../components/PanelShell.tsx";
import { TripDates, type FlexDays } from "../components/TripDates.tsx";
import type { TripSummary } from "../data/backend.ts";
import { useLoad, usePanel } from "../data/store.tsx";
import { downloadJson } from "../lib/download.ts";

const COPY = copy({
  es: {
    status: { draft: "Borrador", voting: "En votación", closed: "Votación cerrada" },
    exportFile: "viajes",
    exported: (name: string) => `${name} exportado`,
    allExported: "Viajes exportados",
    exportFailed: (msg: string) => `No se pudo exportar: ${msg}`,
    deleted: (name: string) => `${name} borrado`,
    deleteFailed: (msg: string) => `No se pudo borrar: ${msg}`,
    title: "Viajes",
    summary: (trips: number, voting: number) => `${trips} ${trips === 1 ? "viaje" : "viajes"} · ${voting} en votación`,
    loading: "Cargando…",
    exportAllTitle: "Los viajes publicados, con votos, comentarios e ideas, en un archivo JSON",
    exportAll: "Exportar todo",
    newTrip: "Nuevo viaje",
    loadFailed: (msg: string) => `No se pudieron cargar los viajes: ${msg}`,
    noTrips: "Todavía no hay ningún viaje",
    createFirst: "Crear el primero",
    tripIs: "Un viaje es una ventana de fechas, quién va y cuánto gastar. Luego buscas destinos, los apruebas y la cuadrilla vota.",
    open: "Abierto",
    nights: (n: number) => `${n} ${n === 1 ? "noche" : "noches"}`,
    people: (n: number) => `${n} ${n === 1 ? "persona" : "personas"}`,
    proposals: (n: number, approved: number, pending: number) => `${n} ${n === 1 ? "propuesta" : "propuestas"} · ${approved} ${approved === 1 ? "aprobada" : "aprobadas"} · ${pending} por revisar`,
    noProposals: "Sin propuestas todavía",
    published: (date: string, changed: boolean) => `Publicado el ${date}${changed ? " · cambios sin publicar" : ""}`,
    notPublished: "Sin publicar",
    openBtn: "Abrir",
    datesTitle: "Proponer fechas y ver quién puede cuándo",
    dates: "Fechas",
    edit: "Editar",
    export: "Exportar",
    delete: "Borrar",
    saved: (name: string) => `${name} guardado`,
    deleteQ: (name: string) => `¿Borrar ${name}?`,
    deleting: "Borrando…",
    deleteTrip: "Borrar viaje",
    deleteText: (n: number) => `Se borran aquí sus ${n} propuestas y, en el sitio, sus destinos, votos, comentarios e ideas. No se puede deshacer.`,
    needName: "Ponle un nombre",
    pickDates: "Elige en el calendario el día de salida y el de vuelta",
    editTitle: (name: string) => `Editar ${name}`,
    cancel: "Cancelar",
    saving: "Guardando…",
    save: "Guardar",
    name: "Nombre",
    editNote: "Quién va y el presupuesto se cambian en Personas y en Generar. Publica de nuevo para que la cuadrilla vea los cambios.",
  },
  en: {
    status: { draft: "Draft", voting: "Voting", closed: "Voting closed" },
    exportFile: "trips",
    exported: (name: string) => `${name} exported`,
    allExported: "Trips exported",
    exportFailed: (msg: string) => `Couldn't export: ${msg}`,
    deleted: (name: string) => `${name} deleted`,
    deleteFailed: (msg: string) => `Couldn't delete: ${msg}`,
    title: "Trips",
    summary: (trips: number, voting: number) => `${trips} ${trips === 1 ? "trip" : "trips"} · ${voting} voting`,
    loading: "Loading…",
    exportAllTitle: "The published trips, with votes, comments and ideas, in a JSON file",
    exportAll: "Export all",
    newTrip: "New trip",
    loadFailed: (msg: string) => `Couldn't load the trips: ${msg}`,
    noTrips: "There are no trips yet",
    createFirst: "Create the first one",
    tripIs: "A trip is a window of dates, who's going and how much to spend. Then you search for destinations, approve them and the group votes.",
    open: "Open",
    nights: (n: number) => `${n} ${n === 1 ? "night" : "nights"}`,
    people: (n: number) => `${n} ${n === 1 ? "person" : "people"}`,
    proposals: (n: number, approved: number, pending: number) => `${n} ${n === 1 ? "proposal" : "proposals"} · ${approved} approved · ${pending} to review`,
    noProposals: "No proposals yet",
    published: (date: string, changed: boolean) => `Published on ${date}${changed ? " · unpublished changes" : ""}`,
    notPublished: "Not published",
    openBtn: "Open",
    datesTitle: "Suggest dates and see who can make when",
    dates: "Dates",
    edit: "Edit",
    export: "Export",
    delete: "Delete",
    saved: (name: string) => `${name} saved`,
    deleteQ: (name: string) => `Delete ${name}?`,
    deleting: "Deleting…",
    deleteTrip: "Delete trip",
    deleteText: (n: number) => `This deletes its ${n} proposals here and, on the site, its destinations, votes, comments and ideas. It can't be undone.`,
    needName: "Give it a name",
    pickDates: "Pick the departure and return days on the calendar",
    editTitle: (name: string) => `Edit ${name}`,
    cancel: "Cancel",
    saving: "Saving…",
    save: "Save",
    name: "Name",
    editNote: "Who's going and the budget are changed in People and Generate. Publish again so the group sees the changes.",
  },
});

const STATUS_TONE = { draft: "neutral", voting: "accent", closed: "muted" } as const;

// Where the organiser starts: every trip, how far along it is, and opening,
// editing or deleting one.
export function TripsPage() {
  const { state, now, trips, selectPlan, savePlan, deletePlan, exportData } = usePanel();
  const navigate = useNavigate();
  const toast = useToast();
  const t = useCopy(COPY);
  // Shown at once from the last visit, and read again (see useLoad).
  const { data: list, error, reload } = useLoad<TripSummary[]>("trips", trips);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [deleting, setDeleting] = useState<TripSummary | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => void reload(), [reload]);
  // Again when a trip is added, renamed or deleted.
  useEffect(load, [load, state.plans]);

  const open = async (t: TripSummary, to = t.proposals ? "/revisar" : "/generar") => {
    await selectPlan(t.plan.id);
    navigate(to);
  };

  // What the group made on the site, to keep: one trip or all of them.
  const exportTrips = async (trip?: TripSummary) => {
    try {
      const data = await exportData(trip?.plan.id);
      downloadJson(`wanderlot-${trip?.plan.id ?? t.exportFile}-${now.toISOString().slice(0, 10)}.json`, data);
      toast(trip ? t.exported(trip.plan.name) : t.allExported);
    } catch (e) {
      toast(t.exportFailed((e as Error).message));
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await deletePlan(deleting.plan.id);
      toast(t.deleted(deleting.plan.name));
      setDeleting(null);
    } catch (e) {
      toast(t.deleteFailed((e as Error).message));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PanelShell trip={false}>
      <main className="mx-auto flex w-full max-w-[1100px] flex-col gap-6 px-4 py-8 sm:px-8">
        <PageHeader
          title={t.title}
          subtitle={list ? t.summary(list.length, list.filter((x) => x.plan.status === "voting").length) : t.loading}
          actions={
            <>
              {list?.some((x) => x.publishedAt) && (
                <Button variant="ghost" onClick={() => void exportTrips()} title={t.exportAllTitle}>
                  {t.exportAll}
                </Button>
              )}
              <Link to="/planes/nuevo" className={buttonClasses({ variant: "primary" })}>
                {t.newTrip}
              </Link>
            </>
          }
        />
        {error && <Notice role="alert">{t.loadFailed(error)}</Notice>}
        {!list && !error ? (
          <div aria-busy="true" className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-44" />
            <Skeleton className="h-44" />
          </div>
        ) : list?.length === 0 ? (
          <EmptyState
            title={t.noTrips}
            action={
              <Link to="/planes/nuevo" className={buttonClasses({ variant: "primary" })}>
                {t.createFirst}
              </Link>
            }
          >
            {t.tripIs}
          </EmptyState>
        ) : (
          <ul data-stagger className="m-0 grid list-none gap-4 p-0 md:grid-cols-2">
            {list?.map((trip) => {
              const current = state.plan?.id === trip.plan.id;
              return (
                <li key={trip.plan.id}>
                  <Card as="article" variant="raised" aria-label={trip.plan.name} className="flex h-full flex-col gap-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <Heading as="h2" size="subheading">
                        {trip.plan.name}
                      </Heading>
                      <div className="flex gap-1.5">
                        {current && <Badge tone="dark">{t.open}</Badge>}
                        <Badge tone={STATUS_TONE[trip.plan.status]}>{t.status[trip.plan.status]}</Badge>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 text-sm text-ink-2">
                      <span>
                        {rangeLabel(trip.plan.dateFrom, trip.plan.dateTo)} · {t.nights(trip.plan.nights)} · {t.people(trip.participants)}
                      </span>
                      <span>
                        {trip.proposals ? t.proposals(trip.proposals, trip.approved, trip.pending) : t.noProposals}
                      </span>
                      <span className={trip.changed ? "font-semibold text-claude" : "text-muted"}>
                        {trip.publishedAt ? t.published(mediumDate(trip.publishedAt), trip.changed) : t.notPublished}
                      </span>
                    </div>
                    <div className="mt-auto flex flex-wrap gap-2 border-t border-line-faint pt-3">
                      <Button variant="primary" onClick={() => void open(trip)}>
                        {t.openBtn}
                      </Button>
                      <Button onClick={() => void open(trip, "/fechas")} title={t.datesTitle}>
                        {t.dates}
                      </Button>
                      <Button onClick={() => setEditing(trip.plan)}>{t.edit}</Button>
                      {trip.publishedAt && (
                        <Button variant="ghost" onClick={() => void exportTrips(trip)}>
                          {t.export}
                        </Button>
                      )}
                      <Button variant="ghost" onClick={() => setDeleting(trip)}>
                        {t.delete}
                      </Button>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      <EditTripDialog
        plan={editing}
        min={addDaysIso(now.toISOString().slice(0, 10), 1)}
        onClose={() => setEditing(null)}
        onSave={async (p) => {
          await savePlan(p);
          toast(t.saved(p.name));
          setEditing(null);
          load();
        }}
      />

      <Dialog
        open={deleting !== null}
        title={deleting ? t.deleteQ(deleting.plan.name) : ""}
        confirmLabel={busy ? t.deleting : t.deleteTrip}
        tone="warning"
        busy={busy}
        onConfirm={() => void remove()}
        onClose={() => setDeleting(null)}
      >
        {t.deleteText(deleting?.proposals ?? 0)}
      </Dialog>
    </PanelShell>
  );
}

function EditTripDialog({ plan, min, onClose, onSave }: { plan: Plan | null; min: string; onClose: () => void; onSave: (p: Plan) => Promise<void> }) {
  const t = useCopy(COPY);
  const [name, setName] = useState("");
  const [range, setRange] = useState<DateRange>({ start: null, end: null });
  const [flex, setFlex] = useState<FlexDays>(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!plan) return;
    setName(plan.name);
    setRange({ start: plan.dateFrom, end: plan.dateTo });
    setFlex(plan.flexDays);
    setError(null);
  }, [plan]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!plan) return;
    if (!name.trim()) return setError(t.needName);
    if (!range.start || !range.end) return setError(t.pickDates);
    setBusy(true);
    try {
      await onSave({ ...plan, name: name.trim(), dateFrom: range.start, dateTo: range.end, nights: nightsBetween(range.start, range.end), flexDays: flex });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={plan !== null}
      wide
      title={plan ? t.editTitle(plan.name) : ""}
      onClose={onClose}
      actions={
        <>
          <Button onClick={onClose}>{t.cancel}</Button>
          <Button variant="primary" type="submit" form="editar-viaje" disabled={busy}>
            {busy ? t.saving : t.save}
          </Button>
        </>
      }
    >
      <form id="editar-viaje" onSubmit={submit} className="flex flex-col gap-4">
        <Field label={t.name}>
          {({ inputId }) => <TextInput id={inputId} required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />}
        </Field>
        {plan && <TripDates value={range} onChange={setRange} flexDays={flex} onFlexChange={setFlex} min={range.start && range.start < min ? range.start : min} />}
        <span className="text-[13px] text-muted">{t.editNote}</span>
        {error && <Notice role="alert">{error}</Notice>}
      </form>
    </Dialog>
  );
}
