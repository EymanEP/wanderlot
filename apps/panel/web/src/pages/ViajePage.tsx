import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router";
import {
  TransportMode,
  checkedLabel,
  longDate,
  rangeLabel,
  trustState,
  type GuideItem,
  type Proposal,
  type TransportOption,
  type TripPage,
} from "@wanderlot/core";
import {
  Button,
  Card,
  CheckIcon,
  Dialog,
  EmptyState,
  Field,
  Heading,
  IconButton,
  Notice,
  PageHeader,
  PlusIcon,
  Select,
  Skeleton,
  TextArea,
  TextInput,
  TrashIcon,
  buttonClasses,
  cn,
  useToast,
} from "@wanderlot/ui";
import { PanelShell } from "../components/PanelShell.tsx";
import { JobCard } from "../components/JobCard.tsx";
import { PriceDialog } from "../components/PriceDialog.tsx";
import type { ScreenshotImage, SearchStep, TripView } from "../data/backend.ts";
import { useLoad, usePanel, usePlan } from "../data/store.tsx";

const MODES: { value: TransportMode; label: string }[] = [
  { value: "car", label: "Coche" },
  { value: "bus", label: "Autobús" },
  { value: "train", label: "Tren" },
  { value: "metro", label: "Metro" },
  { value: "taxi", label: "Taxi" },
  { value: "shuttle", label: "Lanzadera" },
  { value: "walk", label: "Andando" },
  { value: "other", label: "Otro" },
];

const EMPTY: Omit<TripPage, "destinationId"> = {
  intro: "",
  todo: [],
  food: [],
  sights: [],
  beforeYouGo: [],
  home: "",
  toAirport: [],
  fromAirport: [],
  stay: { address: "", checkIn: "", checkOut: "" },
  tricountUrl: null,
  sources: [],
  preparedAt: null,
};

// Prices checked (by hand or by an API) for these dates: what the trip page
// should show for the flights and the stay.
function pricesChecked(p: Proposal, now: Date): boolean {
  return trustState(p.provenance, now).kind === "verified";
}

// Rows added and left blank don't go anywhere.
function clean(t: TripPage): TripPage {
  const items = (list: GuideItem[]) => list.filter((it) => it.title.trim());
  const ways = (list: TransportOption[]) => list.filter((o) => o.title.trim());
  return {
    ...t,
    todo: items(t.todo),
    food: items(t.food),
    sights: items(t.sights),
    beforeYouGo: items(t.beforeYouGo),
    toAirport: ways(t.toAirport),
    fromAirport: ways(t.fromAirport),
  };
}

function stepText(step: SearchStep): string {
  if (step.kind === "search") return `Buscando «${step.query}»`;
  if (step.kind === "read") return `Leyendo ${step.host}`;
  return step.text;
}

// El viaje (ROADMAP 2.2–2.4): once the destination is decided, check its
// prices, have Claude draft the guide and how to get there, edit it, add the
// stay's details and the Tricount link, and publish it for the group. Each
// step says what's next and does it in place; the AI's work carries on if
// the organiser goes elsewhere in the panel (store.tsx, Task).
export function ViajePage() {
  const { state, trip, prepareTrip, saveTrip, publishTrip, setPrices, extract, browse, takeTask, now, clearJob } = usePanel();
  const plan = usePlan();
  const toast = useToast();
  const { data: view, error, reload, set: setView } = useLoad(`trip:${plan.id}:${plan.winnerDestinationId ?? ""}`, trip);
  const [draft, setDraft] = useState<TripPage | null>(view?.trip ?? null);
  const [dirty, setDirty] = useState(false);
  const [asking, setAsking] = useState(false);
  const [home, setHome] = useState(state.settings?.homeTown ?? "");
  const [pricing, setPricing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [starting, setStarting] = useState(false);

  // The saved page, unless the organiser is editing it.
  useEffect(() => {
    if (!dirty) setDraft(view?.trip ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  // A guide prepared in the background (the panel at /admin): read the trip
  // page again once it's done, here or on another device.
  const job = state.job?.kind === "guide" ? state.job : null;
  useEffect(() => {
    if (job?.status === "done") void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.status]);

  // The guide being prepared here, even if the organiser left and came back.
  const guide = state.tasks.find((t) => t.kind === "guide" && t.planId === plan.id);
  useEffect(() => {
    if (!guide || guide.status === "running") return;
    if (guide.status === "done") {
      // The guide at once; the page read again behind it.
      const t = guide.result as TripPage | undefined;
      if (t && view) setView({ ...view, trip: t });
      setDirty(false);
      if (t) setDraft(t);
      void reload();
      takeTask(guide.id);
    }
    // A failure stays on screen until retried or dismissed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guide?.id, guide?.status]);

  // The group's home town, once the settings have loaded.
  useEffect(() => {
    if (state.settings?.homeTown) setHome((h) => h || state.settings!.homeTown!);
  }, [state.settings]);

  // The panel's own copy, so checked prices show at once.
  const destination = view?.destination ? (state.proposals.find((p) => p.id === view.destination!.id) ?? view.destination) : null;
  const readings = destination ? state.tasks.filter((t) => t.kind === "browse" && t.planId === plan.id && t.proposalId === destination.id) : [];
  const reading = readings.find((t) => t.status === "running");
  // A reading that finished opens the prices to review and save.
  useEffect(() => {
    if (readings.some((t) => t.status !== "running")) setPricing(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readings.map((t) => `${t.id}:${t.status}`).join()]);

  const edit = (patch: Partial<TripPage>) => {
    setDraft((d) => (d ? { ...d, ...patch } : d));
    setDirty(true);
  };

  const prepare = async () => {
    setAsking(false);
    if (guide) takeTask(guide.id);
    setStarting(true);
    try {
      await prepareTrip(home.trim());
    } catch (e) {
      toast(`No se pudo preparar: ${(e as Error).message}`);
    } finally {
      setStarting(false);
    }
  };

  const save = async () => {
    if (!draft) return;
    setBusy(true);
    try {
      setView(await saveTrip(clean(draft)));
      setDirty(false);
      toast("Cambios guardados");
    } catch (e) {
      toast(`No se pudo guardar: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const publish = async (published: boolean) => {
    if (!draft) return;
    setBusy(true);
    try {
      if (dirty) await saveTrip(clean(draft));
      setView(await publishTrip(published));
      setDirty(false);
      toast(published ? "Página del viaje publicada" : "Página del viaje retirada del sitio");
    } catch (e) {
      toast(`No se pudo: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  if (view && !destination) {
    return (
      <PanelShell>
        <main className="mx-auto flex w-full max-w-[1100px] flex-col gap-[26px] px-4 py-8 sm:px-8">
          <PageHeader title="El viaje" subtitle={plan.name} />
          <EmptyState
            title="Todavía no hay destino decidido"
            action={
              <Link to="/votacion" className={buttonClasses({ variant: "primary" })}>
                Ir a Votación
              </Link>
            }
          >
            Cuando la votación se cierre y el destino esté decidido, aquí prepararás la página del viaje para el grupo.
          </EmptyState>
        </main>
      </PanelShell>
    );
  }

  const checked = destination ? pricesChecked(destination, now) : false;
  // Research needs an AI; the panel the site serves needs one that runs in
  // the background (it takes minutes), and one guide at a time.
  const hosted = !!state.status?.hosted;
  const preparing = guide?.status === "running" || job?.status === "running" || starting;
  const canPrepare = state.status?.research !== "none" && (!hosted || !!state.status?.ai?.background);
  const ai = state.status?.ai?.name ?? "Claude";
  const published = !!view?.published && !dirty;

  return (
    <PanelShell>
      <main className="mx-auto flex w-full max-w-[1100px] flex-col gap-[26px] px-4 py-8 pb-28 sm:px-8">
        <PageHeader
          title="El viaje"
          subtitle={destination ? `${plan.name} · ${destination.place.city} · ${rangeLabel(plan.dateFrom, plan.dateTo)}` : plan.name}
          actions={
            destination &&
            draft && (
              <div className="flex flex-wrap gap-2">
                {view?.published && (
                  <Button variant="ghost" disabled={busy} onClick={() => void publish(false)}>
                    Retirar del sitio
                  </Button>
                )}
                <Button variant="primary" disabled={busy || preparing || published} onClick={() => void publish(true)}>
                  {view?.published ? (dirty ? "Guardar y publicar" : "Publicada") : "Publicar el viaje"}
                </Button>
              </div>
            )
          }
        />

        {error && !view && (
          <Notice role="alert">
            No se pudo cargar el viaje: {error}{" "}
            <button type="button" onClick={() => void reload()} className="cursor-pointer border-0 bg-transparent p-0 font-semibold text-accent">
              Reintentar
            </button>
          </Notice>
        )}
        {!view && !error && <Skeleton className="h-40 rounded-card" />}

        {destination && (
          <Card variant="raised" className="flex flex-col gap-3" aria-label="Antes de publicar">
            <Heading size="subheading">Antes de publicar</Heading>
            <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
              <Check done title={`Destino decidido: ${destination.place.city}`} />
              <Check
                done={checked}
                title={
                  checked
                    ? destination.provenance.kind === "api"
                      ? "Precios comprobados con la API de vuelos"
                      : `Precios comprobados · ${checkedLabel(destination.provenance)}`
                    : "Comprueba los precios de vuelos y alojamiento"
                }
                detail={
                  reading
                    ? `${ai} está mirando ${reading.site === "flight" ? "Google Flights" : "Airbnb"} en la ventana del navegador${reading.steps.at(-1) ? ` · ${stepText(reading.steps.at(-1)!)}` : ""}`
                    : checked
                      ? "La página del viaje los muestra tal cual."
                      : state.status?.browse
                        ? `Ahora son los de ${ai} o de otras fechas. ${ai} puede mirarlos en Google Flights y Airbnb por ti, o pégalos tú.`
                        : `Ahora son los de ${ai} o de otras fechas. Mira el vuelo y el alojamiento reales, y pega las capturas.`
                }
                busy={!!reading}
                action={
                  <span className="flex flex-wrap gap-2">
                    {state.status?.browse && !checked && (
                      <>
                        <Button size="sm" variant="secondary" disabled={!!reading} onClick={() => browse(destination.id, "flight")}>
                          Mirar en Google Flights
                        </Button>
                        <Button size="sm" variant="secondary" disabled={!!reading} onClick={() => browse(destination.id, "stay")}>
                          Mirar en Airbnb
                        </Button>
                      </>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => setPricing(true)}>
                      {checked ? "Cambiar precios" : "Ponerlos a mano"}
                    </Button>
                  </span>
                }
              />
              <Check
                done={!!draft && !preparing}
                busy={preparing}
                title={
                  preparing
                    ? `${ai} está preparando la guía`
                    : draft
                      ? `Guía ${draft.preparedAt ? `preparada el ${longDate(draft.preparedAt)}` : "escrita a mano"}`
                      : "Prepara la guía"
                }
                detail={
                  preparing
                    ? undefined
                    : draft
                      ? "Revísala abajo: quita lo que no encaje y añade la dirección, la hora de entrada y el Tricount."
                      : `${ai} busca qué hacer, qué comer, qué ver, qué saber antes de ir y cómo llegar. Sus precios son aproximados y el sitio lo dice.`
                }
                action={
                  !preparing &&
                  (draft ? (
                    canPrepare && (
                      <Button size="sm" variant="ghost" onClick={() => setAsking(true)}>
                        Volver a preparar
                      </Button>
                    )
                  ) : (
                    <span className="flex flex-wrap items-end gap-2">
                      {canPrepare && (
                        <>
                          <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
                            Salís desde
                            <TextInput className="h-9 w-36" maxLength={60} placeholder="Logroño" value={home} onChange={(e) => setHome(e.target.value)} />
                          </label>
                          <Button size="sm" variant="primary" onClick={() => void prepare()}>
                            Preparar con {ai}
                          </Button>
                        </>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => setDraft({ ...EMPTY, destinationId: destination.id, home: home.trim() })}>
                        Escribirla a mano
                      </Button>
                    </span>
                  ))
                }
              >
                {guide?.status === "running" && <TaskProgress steps={guide.steps} startedAt={guide.startedAt} searches={state.status?.ai?.search !== false} />}
                {guide?.status === "failed" && (
                  <Notice role="alert">
                    <span className="flex flex-wrap items-center justify-between gap-3">
                      <span>No se pudo preparar: {guide.error}</span>
                      <span className="flex gap-2">
                        <Button size="sm" onClick={() => takeTask(guide.id)}>
                          Cerrar
                        </Button>
                        <Button size="sm" variant="primary" onClick={() => void prepare()}>
                          Volver a probar
                        </Button>
                      </span>
                    </span>
                  </Notice>
                )}
              </Check>
              <Check
                done={published}
                title={view?.published ? (dirty ? "Hay cambios sin publicar" : "Publicada en el sitio") : "Publícala para el grupo"}
                action={
                  draft &&
                  !published && (
                    <Button size="sm" variant="primary" disabled={busy || preparing} onClick={() => void publish(true)}>
                      {view?.published ? "Guardar y publicar" : "Publicar el viaje"}
                    </Button>
                  )
                }
              />
            </ol>
          </Card>
        )}

        {job && <JobCard job={job} onClear={() => void clearJob().catch((e: Error) => toast(`No se pudo: ${e.message}`))} />}

        {draft && destination && (
          <TripEditor trip={draft} city={destination.place.city} origin={destination.outbound.from} iata={destination.place.iata} onChange={edit} />
        )}
      </main>

      {draft && dirty && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line-soft bg-surface/95 px-4 py-3 backdrop-blur sm:px-8">
          <div className="mx-auto flex max-w-[1100px] items-center justify-between gap-3">
            <span className="text-sm text-ink-2">Cambios sin guardar</span>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  setDirty(false);
                  setDraft(view?.trip ?? null);
                }}
              >
                Descartar
              </Button>
              <Button variant="primary" disabled={busy} onClick={() => void save()}>
                Guardar cambios
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={asking} title="¿Volver a preparar la guía?" confirmLabel={`Preparar con ${ai}`} onConfirm={() => void prepare()} onClose={() => setAsking(false)}>
        <div className="flex flex-col gap-3.5">
          <span>Sustituye la guía de ahora. La dirección, las horas y el Tricount se quedan.</span>
          <Field label="Salís desde (opcional)" aside="Para ir al aeropuerto">
            {({ inputId }) => <TextInput id={inputId} maxLength={60} placeholder="Logroño" value={home} onChange={(e) => setHome(e.target.value)} />}
          </Field>
        </div>
      </Dialog>

      {destination && (
        <PriceDialog
          proposal={pricing ? destination : undefined}
          plan={plan}
          aiName={ai}
          {...(state.status?.browse
            ? {
                browse: {
                  tasks: readings,
                  start: (kind: "flight" | "stay") => browse(destination.id, kind),
                  take: takeTask,
                },
              }
            : {})}
          {...(state.status?.research !== "none" ? { onExtract: (kind: "flight" | "stay", images: ScreenshotImage[]) => extract(destination.id, kind, images) } : {})}
          onClose={() => setPricing(false)}
          onSave={async (prices) => {
            await setPrices(destination.id, prices);
            toast(`${destination.place.city}: precios comprobados`);
          }}
        />
      )}
    </PanelShell>
  );
}

// What the AI is doing, in one line: the latest step and how long it's
// been; the rest folded away.
function TaskProgress({ steps, startedAt, searches }: { steps: SearchStep[]; startedAt: number; searches: boolean }) {
  const [now, setNow] = useState(() => Date.now());
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const secs = Math.max(0, Math.floor((now - startedAt) / 1000));
  const elapsed = secs < 60 ? `${secs} s` : `${Math.floor(secs / 60)} min ${secs % 60} s`;
  const last = steps.at(-1);
  return (
    <div role="status" aria-label="Progreso" className="flex flex-col gap-1.5 text-[13px] text-ink-2">
      <span className="flex flex-wrap items-center gap-x-2">
        <span className="tabular-nums text-muted">{elapsed}</span>
        <span className="min-w-0 truncate">{last ? stepText(last) : searches ? "Empezando a buscar en la web…" : "Empezando…"}</span>
      </span>
      <span className="text-muted">Tarda unos minutos. Puedes seguir por el panel: te avisamos al terminar.</span>
      {steps.length > 1 && (
        <button type="button" onClick={() => setOpen((o) => !o)} className="cursor-pointer self-start border-0 bg-transparent p-0 text-[13px] font-semibold text-accent" aria-expanded={open}>
          {open ? "Ocultar lo que hace" : `Ver lo que hace (${steps.length})`}
        </button>
      )}
      {open && (
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {steps.slice(-12).map((s, i) => (
            <li key={i}>{stepText(s)}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

// One step before publishing: done, pending, or with the AI working on it.
function Check({ done, busy, title, detail, action, children }: { done: boolean; busy?: boolean; title: string; detail?: string; action?: ReactNode; children?: ReactNode }) {
  return (
    <li className="flex flex-col gap-2.5 rounded-xl bg-surface-2 px-3.5 py-3" aria-busy={busy || undefined}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <span className="flex min-w-0 flex-1 items-start gap-2.5">
          <span
            aria-hidden
            className={cn(
              "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full",
              busy ? "border-2 border-accent border-t-transparent motion-safe:animate-spin" : done ? "bg-accent text-white" : "border-2 border-line bg-surface",
            )}
          >
            {done && !busy && <CheckIcon size={12} />}
          </span>
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className={cn("text-sm font-semibold", !done && "text-ink")}>
              {title}
              <span className="sr-only">{busy ? " (en marcha)" : done ? " (hecho)" : " (pendiente)"}</span>
            </span>
            {detail && <span className="text-[13px] text-muted">{detail}</span>}
          </span>
        </span>
        {action}
      </div>
      {children && <div className="pl-[30px]">{children}</div>}
    </li>
  );
}

const euroValue = (cents: number | null | undefined) => (typeof cents === "number" ? String(cents / 100) : "");
const toCents = (v: string) => (v.trim() === "" ? null : Math.max(0, Math.round(Number(v.replace(",", ".")) * 100)) || 0);

// Everything the trip page shows that the organiser can change.
function TripEditor({ trip, city, origin, iata, onChange }: { trip: TripPage; city: string; origin: string; iata: string; onChange: (patch: Partial<TripPage>) => void }) {
  const [tricount, setTricount] = useState(trip.tricountUrl ?? "");
  useEffect(() => setTricount(trip.tricountUrl ?? ""), [trip.tricountUrl]);
  const tricountOk = tricount === "" || /^https:\/\/\S+$/.test(tricount);

  return (
    <div className="flex flex-col gap-5">
      <Section title="Presentación" hint={`Dos o tres frases sobre ${city}. Van arriba del todo.`}>
        <Field label="Presentación" hideLabel>
          {({ inputId }) => <TextArea id={inputId} rows={3} maxLength={1000} value={trip.intro} onChange={(e) => onChange({ intro: e.target.value })} />}
        </Field>
      </Section>

      <Section title="Alojamiento y dinero" hint="Lo que la IA no sabe: dónde está exactamente, a qué hora se entra y el Tricount del grupo.">
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
          <Field label="Dirección">
            {({ inputId }) => (
              <TextInput id={inputId} maxLength={200} value={trip.stay.address} onChange={(e) => onChange({ stay: { ...trip.stay, address: e.target.value } })} />
            )}
          </Field>
          <Field label="Entrada">
            {({ inputId }) => (
              <TextInput id={inputId} maxLength={60} placeholder="15:00" value={trip.stay.checkIn} onChange={(e) => onChange({ stay: { ...trip.stay, checkIn: e.target.value } })} />
            )}
          </Field>
          <Field label="Salida">
            {({ inputId }) => (
              <TextInput id={inputId} maxLength={60} placeholder="11:00" value={trip.stay.checkOut} onChange={(e) => onChange({ stay: { ...trip.stay, checkOut: e.target.value } })} />
            )}
          </Field>
        </div>
        <Field label="Enlace del Tricount (opcional)" aside={tricountOk ? "Las cuentas del viaje siguen en Tricount" : "Tiene que empezar por https://"}>
          {({ inputId }) => (
            <TextInput
              id={inputId}
              type="url"
              placeholder="https://tricount.com/…"
              value={tricount}
              onChange={(e) => {
                const v = e.target.value.trim();
                setTricount(v);
                if (v === "" || /^https:\/\/\S+$/.test(v)) onChange({ tricountUrl: v || null });
              }}
            />
          )}
        </Field>
      </Section>

      <Section title="Cómo llegar" hint="Precios por persona, aproximados. El sitio avisa de que hay que confirmarlos.">
        <Field label="Salís desde">
          {({ inputId }) => <TextInput id={inputId} maxLength={60} placeholder="Logroño" value={trip.home} onChange={(e) => onChange({ home: e.target.value })} />}
        </Field>
        <TransportList title={`De ${trip.home || "casa"} al aeropuerto (${origin})`} options={trip.toAirport} onChange={(toAirport) => onChange({ toAirport })} />
        <TransportList title={`Del aeropuerto (${iata}) al alojamiento`} options={trip.fromAirport} onChange={(fromAirport) => onChange({ fromAirport })} />
      </Section>

      <Section title="Qué hacer" hint="Cosas concretas, con lo que cuestan por persona. Sin horarios: es un empujón, no un plan.">
        <ItemList label="Qué hacer" items={trip.todo} price onChange={(todo) => onChange({ todo })} />
      </Section>
      <Section title="Qué comer" hint="Y dónde es típico probarlo.">
        <ItemList label="Qué comer" items={trip.food} where onChange={(food) => onChange({ food })} />
      </Section>
      <Section title="Sitios que ver">
        <ItemList label="Sitios que ver" items={trip.sights} onChange={(sights) => onChange({ sights })} />
      </Section>
      <Section title="Antes de ir" hint="El país en pocas líneas: dinero, enchufes, propinas, transporte, de qué tener cuidado.">
        <ItemList label="Antes de ir" items={trip.beforeYouGo} onChange={(beforeYouGo) => onChange({ beforeYouGo })} />
      </Section>

      {trip.sources.length > 0 && (
        <p className="m-0 text-[13px] text-muted">
          Fuentes de {trip.by ?? "Claude"}:{" "}
          {trip.sources.map((s, i) => (
            <span key={s.url}>
              {i > 0 && " · "}
              <a href={s.url} target="_blank" rel="noreferrer">
                {s.label}
              </a>
            </span>
          ))}
        </p>
      )}
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <Card as="section" variant="raised" aria-label={title} className="flex flex-col gap-3.5">
      <div className="flex flex-col gap-1">
        <Heading size="subheading">{title}</Heading>
        {hint && <span className="text-sm text-muted">{hint}</span>}
      </div>
      {children}
    </Card>
  );
}

function ItemList({ label, items, price, where, onChange }: { label: string; items: GuideItem[]; price?: boolean; where?: boolean; onChange: (items: GuideItem[]) => void }) {
  const set = (i: number, patch: Partial<GuideItem>) => onChange(items.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  return (
    <div className="flex flex-col gap-2.5">
      {items.length === 0 && <p className="m-0 text-sm text-muted">Nada todavía.</p>}
      <ul aria-label={label} className="m-0 flex list-none flex-col gap-2.5 p-0">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-2.5 rounded-xl bg-surface-2 p-3">
            <div className={cn("grid min-w-0 flex-1 gap-2", price || where ? "sm:grid-cols-[1fr_2fr_auto]" : "sm:grid-cols-[1fr_2fr]")}>
              <TextInput aria-label={`${label} ${i + 1}: título`} maxLength={120} value={it.title} onChange={(e) => set(i, { title: e.target.value })} />
              <TextInput aria-label={`${label} ${i + 1}: detalle`} maxLength={600} value={it.detail} onChange={(e) => set(i, { detail: e.target.value })} />
              {price && (
                <TextInput
                  aria-label={`${label} ${i + 1}: € por persona`}
                  inputMode="decimal"
                  placeholder="€"
                  className="sm:w-24"
                  value={euroValue(it.priceCents)}
                  onChange={(e) => set(i, { priceCents: toCents(e.target.value) })}
                />
              )}
              {where && (
                <TextInput aria-label={`${label} ${i + 1}: dónde`} maxLength={200} placeholder="Dónde" className="sm:w-56" value={it.where ?? ""} onChange={(e) => set(i, { where: e.target.value })} />
              )}
            </div>
            <IconButton label={`Quitar ${it.title || `${label} ${i + 1}`}`} size="md" onClick={() => onChange(items.filter((_, j) => j !== i))}>
              <TrashIcon size={16} />
            </IconButton>
          </li>
        ))}
      </ul>
      <Button size="sm" variant="ghost" icon={<PlusIcon size={14} />} className="self-start" disabled={items.length >= 15} onClick={() => onChange([...items, { title: "", detail: "" }])}>
        Añadir
      </Button>
    </div>
  );
}

function TransportList({ title, options, onChange }: { title: string; options: TransportOption[]; onChange: (options: TransportOption[]) => void }) {
  const set = (i: number, patch: Partial<TransportOption>) => onChange(options.map((o, j) => (j === i ? { ...o, ...patch } : o)));
  return (
    <div className="flex flex-col gap-2.5">
      <Heading as="h3" size="card">
        {title}
      </Heading>
      <ul aria-label={title} className="m-0 flex list-none flex-col gap-2.5 p-0">
        {options.map((o, i) => (
          <li key={i} className="flex items-start gap-2.5 rounded-xl bg-surface-2 p-3">
            <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[9rem_1fr_6rem_6rem]">
              <Select size="sm" label={`${title} ${i + 1}: medio`} value={o.mode} options={MODES} onChange={(mode) => set(i, { mode })} />
              <TextInput aria-label={`${title} ${i + 1}: título`} maxLength={120} value={o.title} onChange={(e) => set(i, { title: e.target.value })} />
              <TextInput
                aria-label={`${title} ${i + 1}: minutos`}
                inputMode="numeric"
                placeholder="min"
                value={o.minutes ?? ""}
                onChange={(e) => set(i, { minutes: Math.round(Number(e.target.value)) > 0 ? Math.round(Number(e.target.value)) : null })}
              />
              <TextInput
                aria-label={`${title} ${i + 1}: € por persona`}
                inputMode="decimal"
                placeholder="€"
                value={euroValue(o.priceCents)}
                onChange={(e) => set(i, { priceCents: toCents(e.target.value) })}
              />
              <TextArea
                aria-label={`${title} ${i + 1}: detalle`}
                rows={2}
                maxLength={600}
                className="sm:col-span-4"
                value={o.detail}
                onChange={(e) => set(i, { detail: e.target.value })}
              />
            </div>
            <IconButton label={`Quitar ${o.title || `${title} ${i + 1}`}`} size="md" onClick={() => onChange(options.filter((_, j) => j !== i))}>
              <TrashIcon size={16} />
            </IconButton>
          </li>
        ))}
      </ul>
      <Button
        size="sm"
        variant="ghost"
        icon={<PlusIcon size={14} />}
        className="self-start"
        disabled={options.length >= 6}
        onClick={() => onChange([...options, { mode: "bus", title: "", detail: "", minutes: null, priceCents: null }])}
      >
        Añadir una opción
      </Button>
    </div>
  );
}
