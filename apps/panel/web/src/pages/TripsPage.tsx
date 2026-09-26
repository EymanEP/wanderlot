import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { addDaysIso, mediumDate, rangeLabel, type Plan } from "@wanderlot/core";
import { Badge, Button, Card, Dialog, EmptyState, Field, Heading, Notice, PageHeader, Skeleton, TextInput, buttonClasses, nightsBetween, useToast, type DateRange } from "@wanderlot/ui";
import { PanelShell } from "../components/PanelShell.tsx";
import { TripDates, type FlexDays } from "../components/TripDates.tsx";
import type { TripSummary } from "../data/backend.ts";
import { usePanel } from "../data/store.tsx";

const STATUS = {
  draft: { label: "Borrador", tone: "neutral" },
  voting: { label: "En votación", tone: "accent" },
  closed: { label: "Votación cerrada", tone: "muted" },
} as const;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// Where the organiser starts: every trip, how far along it is, and opening,
// editing or deleting one.
export function TripsPage() {
  const { state, now, trips, selectPlan, savePlan, deletePlan } = usePanel();
  const navigate = useNavigate();
  const toast = useToast();
  const [list, setList] = useState<TripSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [deleting, setDeleting] = useState<TripSummary | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    trips().then(
      (t) => {
        setList(t);
        setError(null);
      },
      (e: Error) => setError(e.message),
    );
    // Not on `trips` itself: it's a new function on every panel change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.plans]);
  useEffect(load, [load]);

  const open = async (t: TripSummary) => {
    await selectPlan(t.plan.id);
    navigate(t.proposals ? "/revisar" : "/generar");
  };

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await deletePlan(deleting.plan.id);
      toast(`${deleting.plan.name} borrado`);
      setDeleting(null);
    } catch (e) {
      toast(`No se pudo borrar: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <PanelShell showPlan={false}>
      <main className="mx-auto flex w-full max-w-[1100px] flex-col gap-6 px-4 py-8 sm:px-8">
        <PageHeader
          title="Viajes"
          subtitle={list ? `${plural(list.length, "viaje", "viajes")} · ${plural(list.filter((t) => t.plan.status === "voting").length, "en votación", "en votación")}` : "Cargando…"}
          actions={
            <Link to="/planes/nuevo" className={buttonClasses({ variant: "primary" })}>
              Nuevo viaje
            </Link>
          }
        />
        {error && <Notice role="alert">No se pudieron cargar los viajes: {error}</Notice>}
        {!list && !error ? (
          <div aria-busy="true" className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-44" />
            <Skeleton className="h-44" />
          </div>
        ) : list?.length === 0 ? (
          <EmptyState
            title="Todavía no hay ningún viaje"
            action={
              <Link to="/planes/nuevo" className={buttonClasses({ variant: "primary" })}>
                Crear el primero
              </Link>
            }
          >
            Un viaje es una ventana de fechas, quién va y cuánto gastar. Luego buscas destinos, los apruebas y la cuadrilla vota.
          </EmptyState>
        ) : (
          <ul className="m-0 grid list-none gap-4 p-0 md:grid-cols-2">
            {list?.map((t) => {
              const current = state.plan?.id === t.plan.id;
              return (
                <li key={t.plan.id}>
                  <Card as="article" variant="raised" aria-label={t.plan.name} className="flex h-full flex-col gap-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <Heading as="h2" size="subheading">
                        {t.plan.name}
                      </Heading>
                      <div className="flex gap-1.5">
                        {current && <Badge tone="dark">Abierto</Badge>}
                        <Badge tone={STATUS[t.plan.status].tone}>{STATUS[t.plan.status].label}</Badge>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 text-sm text-ink-2">
                      <span>
                        {rangeLabel(t.plan.dateFrom, t.plan.dateTo)} · {plural(t.plan.nights, "noche", "noches")} · {plural(t.participants, "persona", "personas")}
                      </span>
                      <span>
                        {t.proposals ? `${plural(t.proposals, "propuesta", "propuestas")} · ${t.approved} ${t.approved === 1 ? "aprobada" : "aprobadas"} · ${t.pending} por revisar` : "Sin propuestas todavía"}
                      </span>
                      <span className={t.changed ? "font-semibold text-claude" : "text-muted"}>
                        {t.publishedAt ? `Publicado el ${mediumDate(t.publishedAt)}${t.changed ? " · cambios sin publicar" : ""}` : "Sin publicar"}
                      </span>
                    </div>
                    <div className="mt-auto flex flex-wrap gap-2 border-t border-line-faint pt-3">
                      <Button variant="primary" onClick={() => void open(t)}>
                        Abrir
                      </Button>
                      <Button onClick={() => setEditing(t.plan)}>Editar</Button>
                      <Button variant="ghost" onClick={() => setDeleting(t)}>
                        Borrar
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
          toast(`${p.name} guardado`);
          setEditing(null);
          load();
        }}
      />

      <Dialog
        open={deleting !== null}
        title={deleting ? `¿Borrar ${deleting.plan.name}?` : ""}
        confirmLabel={busy ? "Borrando…" : "Borrar viaje"}
        tone="warning"
        busy={busy}
        onConfirm={() => void remove()}
        onClose={() => setDeleting(null)}
      >
        Se borran aquí sus {deleting?.proposals ?? 0} propuestas y, en el sitio, sus destinos, votos, comentarios e ideas. No se puede deshacer.
      </Dialog>
    </PanelShell>
  );
}

function EditTripDialog({ plan, min, onClose, onSave }: { plan: Plan | null; min: string; onClose: () => void; onSave: (p: Plan) => Promise<void> }) {
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
    if (!name.trim()) return setError("Ponle un nombre");
    if (!range.start || !range.end) return setError("Elige en el calendario el día de salida y el de vuelta");
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
      title={plan ? `Editar ${plan.name}` : ""}
      onClose={onClose}
      actions={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" type="submit" form="editar-viaje" disabled={busy}>
            {busy ? "Guardando…" : "Guardar"}
          </Button>
        </>
      }
    >
      <form id="editar-viaje" onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Nombre">
          {({ inputId }) => <TextInput id={inputId} required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />}
        </Field>
        {plan && <TripDates value={range} onChange={setRange} flexDays={flex} onFlexChange={setFlex} min={range.start && range.start < min ? range.start : min} />}
        <span className="text-[13px] text-muted">Quién va y el presupuesto se cambian en Personas y en Generar. Publica de nuevo para que la cuadrilla vea los cambios.</span>
        {error && <Notice role="alert">{error}</Notice>}
      </form>
    </Dialog>
  );
}
