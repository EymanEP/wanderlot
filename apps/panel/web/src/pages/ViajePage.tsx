import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router";
import {
  TransportMode,
  allLeaveApproved,
  leaveCounts,
  checkedLabel,
  copy,
  pick,
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
  useCopy,
  useToast,
} from "@wanderlot/ui";
import { PanelShell } from "../components/PanelShell.tsx";
import { JobCard } from "../components/JobCard.tsx";
import { useLeave } from "../components/LeaveCard.tsx";
import { PriceDialog } from "../components/PriceDialog.tsx";
import type { ScreenshotImage, SearchStep, TripView } from "../data/backend.ts";
import { useLoad, usePanel, usePlan } from "../data/store.tsx";

const COPY = copy({
  es: {
    modes: { car: "Coche", bus: "Autobús", train: "Tren", metro: "Metro", taxi: "Taxi", shuttle: "Lanzadera", walk: "Andando", other: "Otro" } as Record<TransportMode, string>,
    searching: (q: string) => `Buscando «${q}»`,
    reading: (host: string) => `Leyendo ${host}`,
    prepareFailed: (msg: string) => `No se pudo preparar: ${msg}`,
    saved: "Cambios guardados",
    saveFailed: (msg: string) => `No se pudo guardar: ${msg}`,
    published: "Página del viaje publicada",
    unpublished: "Página del viaje retirada del sitio",
    failed: (msg: string) => `No se pudo: ${msg}`,
    title: "El viaje",
    noDestination: "Todavía no hay destino decidido",
    goVote: "Ir a Votación",
    noDestinationText: "Cuando la votación se cierre y el destino esté decidido, aquí prepararás la página del viaje para el grupo.",
    saveAndPublish: "Guardar y publicar",
    publishChanges: "Publicar cambios",
    isPublished: "Publicada",
    publishTrip: "Publicar el viaje",
    unpublish: "Retirar del sitio",
    loadFailed: (msg: string) => `No se pudo cargar el viaje: ${msg}`,
    retry: "Reintentar",
    beforePublishing: "Antes de publicar",
    decided: (city: string) => `Destino decidido: ${city}`,
    allLeave: "Todos tienen los días libres",
    leaveCount: (approved: number, of: number) => `Días libres: ${approved} de ${of} aprobados`,
    leaveDenied: (names: string[]) => `A ${names.join(" y ")} no le dan los días: habladlo antes de reservar.`,
    leaveMissing: (names: string[]) => `Falta ${names.join(", ")}. Mejor no reservar nada hasta que estén todos.`,
    seeMissing: "Ver quién falta",
    pricesApi: "Precios comprobados con la API de vuelos",
    pricesChecked: (label: string | null) => (label ? `Precios comprobados · ${label}` : "Precios comprobados"),
    checkPrices: "Comprueba los precios de vuelos y alojamiento",
    yourBrowser: "tu navegador",
    lookingFlights: (ai: string, browser: string, step: string | null) => `${ai} está mirando Google Flights en una ventana de ${browser}${step ? ` · ${step}` : ""}`,
    pricesAsIs: "La página del viaje los muestra tal cual.",
    pricesBrowse: (ai: string) => `Ahora son los de ${ai} o de otras fechas. ${ai} trae de Google Flights los mejores vuelos para que elijas uno; el alojamiento míralo en Airbnb, o pega una captura.`,
    pricesHand: (ai: string) => `Ahora son los de ${ai} o de otras fechas. Mira el vuelo y el alojamiento reales, y pega las capturas.`,
    checking: "Comprobando…",
    checkAgain: "Comprobar vuelos otra vez",
    checkFlights: "Comprobar vuelos",
    changePrices: "Cambiar precios",
    byHand: "Ponerlos a mano",
    aiPreparing: (ai: string) => `${ai} está preparando la guía`,
    guidePrepared: (date: string) => `Guía preparada el ${date}`,
    guideByHand: "Guía escrita a mano",
    prepareGuide: "Prepara la guía",
    reviewGuide: "Revísala abajo: quita lo que no encaje y añade la dirección, la hora de entrada y el Tricount.",
    aiSearches: (ai: string) => `${ai} busca qué hacer, qué comer, qué ver, qué saber antes de ir y cómo llegar. Sus precios son aproximados y el sitio lo dice.`,
    prepareAgain: "Volver a preparar",
    leavingFrom: "Salís desde",
    homePlaceholder: "Logroño",
    prepareWith: (ai: string) => `Preparar con ${ai}`,
    writeByHand: "Escribirla a mano",
    close: "Cerrar",
    tryAgain: "Volver a probar",
    unpublishedChanges: "Hay cambios sin publicar",
    publishedOnSite: "Publicada en el sitio",
    publishForGroup: "Publícala para el grupo",
    behind: "Algo cambió desde que la publicaste (precios, fechas o la guía), y el grupo aún ve lo de antes.",
    unsaved: "Cambios sin guardar",
    discard: "Descartar",
    saveChanges: "Guardar cambios",
    prepareAgainQ: "¿Volver a preparar la guía?",
    replaces: "Sustituye la guía de ahora. La dirección, las horas y el Tricount se quedan.",
    leavingFromOptional: "Salís desde (opcional)",
    toAirport: "Para ir al aeropuerto",
    pricesSaved: (city: string) => `${city}: precios comprobados`,
    progress: "Progreso",
    startingWeb: "Empezando a buscar en la web…",
    starting: "Empezando…",
    takesMinutes: "Tarda unos minutos. Puedes seguir por el panel: te avisamos al terminar.",
    hideSteps: "Ocultar lo que hace",
    showSteps: (n: number) => `Ver lo que hace (${n})`,
    running: " (en marcha)",
    done: " (hecho)",
    pending: " (pendiente)",
    intro: "Presentación",
    introHint: (city: string) => `Dos o tres frases sobre ${city}. Van arriba del todo.`,
    stay: "Alojamiento y dinero",
    stayHint: "Lo que la IA no sabe: dónde está exactamente, a qué hora se entra y el Tricount del grupo.",
    address: "Dirección",
    checkIn: "Entrada",
    checkOut: "Salida",
    tricount: "Enlace del Tricount (opcional)",
    tricountAside: "Las cuentas del viaje siguen en Tricount",
    tricountHttps: "Tiene que empezar por https://",
    gettingThere: "Cómo llegar",
    gettingThereHint: "Precios por persona, aproximados. El sitio avisa de que hay que confirmarlos.",
    home: "casa",
    toAirportTitle: (home: string, code: string) => `De ${home} al aeropuerto (${code})`,
    fromAirportTitle: (code: string) => `Del aeropuerto (${code}) al alojamiento`,
    todo: "Qué hacer",
    todoHint: "Cosas concretas, con lo que cuestan por persona. Sin horarios: es un empujón, no un plan.",
    food: "Qué comer",
    foodHint: "Y dónde es típico probarlo.",
    sights: "Sitios que ver",
    beforeYouGo: "Antes de ir",
    beforeYouGoHint: "El país en pocas líneas: dinero, enchufes, propinas, transporte, de qué tener cuidado.",
    sources: (by: string) => `Fuentes de ${by}:`,
    nothingYet: "Nada todavía.",
    itemTitle: (label: string, n: number) => `${label} ${n}: título`,
    itemDetail: (label: string, n: number) => `${label} ${n}: detalle`,
    itemPrice: (label: string, n: number) => `${label} ${n}: € por persona`,
    itemWhere: (label: string, n: number) => `${label} ${n}: dónde`,
    itemMode: (label: string, n: number) => `${label} ${n}: medio`,
    itemMinutes: (label: string, n: number) => `${label} ${n}: minutos`,
    where: "Dónde",
    remove: (what: string) => `Quitar ${what}`,
    nth: (label: string, n: number) => `${label} ${n}`,
    add: "Añadir",
    addOption: "Añadir una opción",
  },
  en: {
    modes: { car: "Car", bus: "Bus", train: "Train", metro: "Metro", taxi: "Taxi", shuttle: "Shuttle", walk: "On foot", other: "Other" },
    searching: (q: string) => `Searching “${q}”`,
    reading: (host: string) => `Reading ${host}`,
    prepareFailed: (msg: string) => `Couldn't prepare it: ${msg}`,
    saved: "Changes saved",
    saveFailed: (msg: string) => `Couldn't save: ${msg}`,
    published: "Trip page published",
    unpublished: "Trip page taken off the site",
    failed: (msg: string) => `That didn't work: ${msg}`,
    title: "The trip",
    noDestination: "No destination decided yet",
    goVote: "Go to Vote",
    noDestinationText: "Once the vote closes and the destination is decided, this is where you'll prepare the trip page for the group.",
    saveAndPublish: "Save and publish",
    publishChanges: "Publish changes",
    isPublished: "Published",
    publishTrip: "Publish the trip",
    unpublish: "Take off the site",
    loadFailed: (msg: string) => `Couldn't load the trip: ${msg}`,
    retry: "Retry",
    beforePublishing: "Before publishing",
    decided: (city: string) => `Destination decided: ${city}`,
    allLeave: "Everyone has the days off",
    leaveCount: (approved: number, of: number) => `Days off: ${approved} of ${of} approved`,
    leaveDenied: (names: string[]) => `${names.join(" and ")} can't get the days off: talk it over before booking.`,
    leaveMissing: (names: string[]) => `Still waiting on ${names.join(", ")}. Best not to book anything until everyone has them.`,
    seeMissing: "See who's missing",
    pricesApi: "Prices checked with the flights API",
    pricesChecked: (label: string | null) => (label ? `Prices checked · ${label}` : "Prices checked"),
    checkPrices: "Check the flight and accommodation prices",
    yourBrowser: "your browser",
    lookingFlights: (ai: string, browser: string, step: string | null) => `${ai} is looking at Google Flights in a ${browser} window${step ? ` · ${step}` : ""}`,
    pricesAsIs: "The trip page shows them as they are.",
    pricesBrowse: (ai: string) => `For now they're ${ai}'s or for other dates. ${ai} fetches the best flights from Google Flights for you to pick one; check the accommodation on Airbnb, or paste a screenshot.`,
    pricesHand: (ai: string) => `For now they're ${ai}'s or for other dates. Look up the real flight and accommodation, and paste the screenshots.`,
    checking: "Checking…",
    checkAgain: "Check flights again",
    checkFlights: "Check flights",
    changePrices: "Change prices",
    byHand: "Enter them by hand",
    aiPreparing: (ai: string) => `${ai} is preparing the guide`,
    guidePrepared: (date: string) => `Guide prepared on ${date}`,
    guideByHand: "Guide written by hand",
    prepareGuide: "Prepare the guide",
    reviewGuide: "Review it below: remove what doesn't fit and add the address, check-in time and the Tricount.",
    aiSearches: (ai: string) => `${ai} looks up what to do, what to eat, what to see, what to know before you go and how to get there. Its prices are approximate and the site says so.`,
    prepareAgain: "Prepare again",
    leavingFrom: "Leaving from",
    homePlaceholder: "Logroño",
    prepareWith: (ai: string) => `Prepare with ${ai}`,
    writeByHand: "Write it by hand",
    close: "Close",
    tryAgain: "Try again",
    unpublishedChanges: "There are unpublished changes",
    publishedOnSite: "Published on the site",
    publishForGroup: "Publish it for the group",
    behind: "Something changed since you published it (prices, dates or the guide), and the group still sees the old version.",
    unsaved: "Unsaved changes",
    discard: "Discard",
    saveChanges: "Save changes",
    prepareAgainQ: "Prepare the guide again?",
    replaces: "It replaces the current guide. The address, times and Tricount stay.",
    leavingFromOptional: "Leaving from (optional)",
    toAirport: "For getting to the airport",
    pricesSaved: (city: string) => `${city}: prices checked`,
    progress: "Progress",
    startingWeb: "Starting to search the web…",
    starting: "Starting…",
    takesMinutes: "It takes a few minutes. You can carry on around the panel: we'll let you know when it's done.",
    hideSteps: "Hide what it's doing",
    showSteps: (n: number) => `See what it's doing (${n})`,
    running: " (in progress)",
    done: " (done)",
    pending: " (pending)",
    intro: "Introduction",
    introHint: (city: string) => `Two or three sentences about ${city}. They go right at the top.`,
    stay: "Accommodation and money",
    stayHint: "What the AI doesn't know: exactly where it is, what time check-in is and the group's Tricount.",
    address: "Address",
    checkIn: "Check-in",
    checkOut: "Check-out",
    tricount: "Tricount link (optional)",
    tricountAside: "The trip's accounts stay in Tricount",
    tricountHttps: "It has to start with https://",
    gettingThere: "Getting there",
    gettingThereHint: "Prices per person, approximate. The site warns they need confirming.",
    home: "home",
    toAirportTitle: (home: string, code: string) => `From ${home} to the airport (${code})`,
    fromAirportTitle: (code: string) => `From the airport (${code}) to the accommodation`,
    todo: "What to do",
    todoHint: "Specific things, with what they cost per person. No timetables: it's a nudge, not a plan.",
    food: "What to eat",
    foodHint: "And where it's typical to try it.",
    sights: "Places to see",
    beforeYouGo: "Before you go",
    beforeYouGoHint: "The country in a few lines: money, plugs, tipping, transport, what to watch out for.",
    sources: (by: string) => `${by}'s sources:`,
    nothingYet: "Nothing yet.",
    itemTitle: (label: string, n: number) => `${label} ${n}: title`,
    itemDetail: (label: string, n: number) => `${label} ${n}: details`,
    itemPrice: (label: string, n: number) => `${label} ${n}: € per person`,
    itemWhere: (label: string, n: number) => `${label} ${n}: where`,
    itemMode: (label: string, n: number) => `${label} ${n}: mode`,
    itemMinutes: (label: string, n: number) => `${label} ${n}: minutes`,
    where: "Where",
    remove: (what: string) => `Remove ${what}`,
    nth: (label: string, n: number) => `${label} ${n}`,
    add: "Add",
    addOption: "Add an option",
  },
});

const MODES: TransportMode[] = ["car", "bus", "train", "metro", "taxi", "shuttle", "walk", "other"];

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
  const t = pick(COPY);
  if (step.kind === "search") return t.searching(step.query);
  if (step.kind === "read") return t.reading(step.host);
  return step.text;
}

// El viaje (ROADMAP 2.2–2.4): once the destination is decided, check its
// prices, have Claude draft the guide and how to get there, edit it, add the
// stay's details and the Tricount link, and publish it for the group. Each
// step says what's next and does it in place; the AI's work carries on if
// the organiser goes elsewhere in the panel (store.tsx, Task).
export function ViajePage() {
  const { state, trip, prepareTrip, saveTrip, publishTrip, publishStatus, setPrices, extract, browse, takeTask, now, clearJob } = usePanel();
  const plan = usePlan();
  const toast = useToast();
  const t = useCopy(COPY);
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
  const guide = state.tasks.find((k) => k.kind === "guide" && k.planId === plan.id);
  useEffect(() => {
    if (!guide || guide.status === "running") return;
    if (guide.status === "done") {
      // The guide at once; the page read again behind it.
      const ready = guide.result as TripPage | undefined;
      if (ready && view) setView({ ...view, trip: ready });
      setDirty(false);
      if (ready) setDraft(ready);
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
  const readings = destination ? state.tasks.filter((k) => k.kind === "browse" && k.planId === plan.id && k.proposalId === destination.id) : [];
  const reading = readings.find((k) => k.status === "running");
  // A reading that finished opens the prices to review and save.
  useEffect(() => {
    if (readings.some((k) => k.status !== "running")) setPricing(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readings.map((k) => `${k.id}:${k.status}`).join()]);

  // Days off: before booking anything, everyone should have them.
  const leave = useLeave().data?.leave;

  // Once published, whether the site is behind: prices checked, dates fixed
  // or the guide saved since (the site only changes when it's published).
  const [behind, setBehind] = useState(false);
  useEffect(() => {
    if (!view?.published) return setBehind(false);
    let live = true;
    publishStatus().then(
      (s) => live && setBehind(s.changed),
      () => {},
    );
    return () => {
      live = false;
    };
    // Not on `publishStatus` itself: it's a new function on every panel change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, plan, state.proposals]);

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
      toast(t.prepareFailed((e as Error).message));
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
      toast(t.saved);
    } catch (e) {
      toast(t.saveFailed((e as Error).message));
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
      setBehind(false);
      toast(published ? t.published : t.unpublished);
    } catch (e) {
      toast(t.failed((e as Error).message));
    } finally {
      setBusy(false);
    }
  };

  if (view && !destination) {
    return (
      <PanelShell>
        <main className="mx-auto flex w-full max-w-[1100px] flex-col gap-[26px] px-4 py-8 sm:px-8">
          <PageHeader title={t.title} subtitle={plan.name} />
          <EmptyState
            title={t.noDestination}
            action={
              <Link to="/votacion" className={buttonClasses({ variant: "primary" })}>
                {t.goVote}
              </Link>
            }
          >
            {t.noDestinationText}
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
  const published = !!view?.published && !dirty && !behind;
  const publishLabel = view?.published ? (dirty ? t.saveAndPublish : behind ? t.publishChanges : t.isPublished) : t.publishTrip;

  return (
    <PanelShell>
      <main className="mx-auto flex w-full max-w-[1100px] flex-col gap-[26px] px-4 py-8 pb-28 sm:px-8">
        <PageHeader
          title={t.title}
          subtitle={destination ? `${plan.name} · ${destination.place.city} · ${rangeLabel(plan.dateFrom, plan.dateTo)}` : plan.name}
          actions={
            destination &&
            draft && (
              <div className="flex flex-wrap gap-2">
                {view?.published && (
                  <Button variant="ghost" disabled={busy} onClick={() => void publish(false)}>
                    {t.unpublish}
                  </Button>
                )}
                <Button variant="primary" disabled={busy || preparing || published} onClick={() => void publish(true)}>
                  {publishLabel}
                </Button>
              </div>
            )
          }
        />

        {error && !view && (
          <Notice role="alert">
            {t.loadFailed(error)}{" "}
            <button type="button" onClick={() => void reload()} className="cursor-pointer border-0 bg-transparent p-0 font-semibold text-accent">
              {t.retry}
            </button>
          </Notice>
        )}
        {!view && !error && <Skeleton className="h-40 rounded-card" />}

        {destination && (
          <Card variant="raised" className="flex flex-col gap-3" aria-label={t.beforePublishing}>
            <Heading size="subheading">{t.beforePublishing}</Heading>
            <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
              <Check done title={t.decided(destination.place.city)} />
              {leave && leave.people.length > 0 && (
                <Check
                  done={allLeaveApproved(leave)}
                  title={allLeaveApproved(leave) ? t.allLeave : t.leaveCount(leaveCounts(leave).approved, leave.people.length)}
                  {...(!allLeaveApproved(leave)
                    ? {
                        detail: leaveCounts(leave).denied
                          ? t.leaveDenied(leave.people.filter((p) => p.status === "denied").map((p) => p.name))
                          : t.leaveMissing(leave.people.filter((p) => p.status !== "approved").map((p) => p.name)),
                      }
                    : {})}
                  action={
                    !allLeaveApproved(leave) && (
                      <Link to="/fechas" className={buttonClasses({ size: "sm", variant: "ghost" })}>
                        {t.seeMissing}
                      </Link>
                    )
                  }
                />
              )}
              <Check
                done={checked}
                title={
                  checked
                    ? destination.provenance.kind === "api"
                      ? t.pricesApi
                      : t.pricesChecked(checkedLabel(destination.provenance))
                    : t.checkPrices
                }
                detail={
                  reading
                    ? t.lookingFlights(ai, state.status?.browser ?? t.yourBrowser, reading.steps.at(-1) ? stepText(reading.steps.at(-1)!) : null)
                    : checked
                      ? t.pricesAsIs
                      : state.status?.browse
                        ? t.pricesBrowse(ai)
                        : t.pricesHand(ai)
                }
                busy={!!reading}
                action={
                  <span className="flex flex-wrap gap-2">
                    {state.status?.browse && (
                      <Button size="sm" variant={checked ? "ghost" : "secondary"} disabled={!!reading} onClick={() => browse(destination.id)}>
                        {reading ? t.checking : checked ? t.checkAgain : t.checkFlights}
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => setPricing(true)}>
                      {checked ? t.changePrices : t.byHand}
                    </Button>
                  </span>
                }
              />
              <Check
                done={!!draft && !preparing}
                busy={preparing}
                title={
                  preparing
                    ? t.aiPreparing(ai)
                    : draft
                      ? draft.preparedAt
                        ? t.guidePrepared(longDate(draft.preparedAt))
                        : t.guideByHand
                      : t.prepareGuide
                }
                detail={
                  preparing
                    ? undefined
                    : draft
                      ? t.reviewGuide
                      : t.aiSearches(ai)
                }
                action={
                  !preparing &&
                  (draft ? (
                    canPrepare && (
                      <Button size="sm" variant="ghost" onClick={() => setAsking(true)}>
                        {t.prepareAgain}
                      </Button>
                    )
                  ) : (
                    <span className="flex flex-wrap items-end gap-2">
                      {canPrepare && (
                        <>
                          <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
                            {t.leavingFrom}
                            <TextInput className="h-9 w-36" maxLength={60} placeholder={t.homePlaceholder} value={home} onChange={(e) => setHome(e.target.value)} />
                          </label>
                          <Button size="sm" variant="primary" onClick={() => void prepare()}>
                            {t.prepareWith(ai)}
                          </Button>
                        </>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => setDraft({ ...EMPTY, destinationId: destination.id, home: home.trim() })}>
                        {t.writeByHand}
                      </Button>
                    </span>
                  ))
                }
              >
                {guide?.status === "running" && <TaskProgress steps={guide.steps} startedAt={guide.startedAt} searches={state.status?.ai?.search !== false} />}
                {guide?.status === "failed" && (
                  <Notice role="alert">
                    <span className="flex flex-wrap items-center justify-between gap-3">
                      <span>{t.prepareFailed(guide.error ?? "")}</span>
                      <span className="flex gap-2">
                        <Button size="sm" onClick={() => takeTask(guide.id)}>
                          {t.close}
                        </Button>
                        <Button size="sm" variant="primary" onClick={() => void prepare()}>
                          {t.tryAgain}
                        </Button>
                      </span>
                    </span>
                  </Notice>
                )}
              </Check>
              <Check
                done={published}
                title={view?.published ? (dirty || behind ? t.unpublishedChanges : t.publishedOnSite) : t.publishForGroup}
                {...(behind && !dirty ? { detail: t.behind } : {})}
                action={
                  draft &&
                  !published && (
                    <Button size="sm" variant="primary" disabled={busy || preparing} onClick={() => void publish(true)}>
                      {publishLabel}
                    </Button>
                  )
                }
              />
            </ol>
          </Card>
        )}

        {job && <JobCard job={job} onClear={() => void clearJob().catch((e: Error) => toast(t.failed(e.message)))} />}

        {draft && destination && (
          <TripEditor trip={draft} city={destination.place.city} origin={destination.outbound.from} iata={destination.place.iata} onChange={edit} />
        )}
      </main>

      {draft && dirty && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line-soft bg-surface/95 px-4 py-3 backdrop-blur sm:px-8">
          <div className="mx-auto flex max-w-[1100px] items-center justify-between gap-3">
            <span className="text-sm text-ink-2">{t.unsaved}</span>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  setDirty(false);
                  setDraft(view?.trip ?? null);
                }}
              >
                {t.discard}
              </Button>
              <Button variant="primary" disabled={busy} onClick={() => void save()}>
                {t.saveChanges}
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={asking} title={t.prepareAgainQ} confirmLabel={t.prepareWith(ai)} onConfirm={() => void prepare()} onClose={() => setAsking(false)}>
        <div className="flex flex-col gap-3.5">
          <span>{t.replaces}</span>
          <Field label={t.leavingFromOptional} aside={t.toAirport}>
            {({ inputId }) => <TextInput id={inputId} maxLength={60} placeholder={t.homePlaceholder} value={home} onChange={(e) => setHome(e.target.value)} />}
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
                  start: () => browse(destination.id),
                  take: takeTask,
                },
              }
            : {})}
          {...(state.status?.research !== "none" ? { onExtract: (kind: "flight" | "stay", images: ScreenshotImage[]) => extract(destination.id, kind, images) } : {})}
          onClose={() => setPricing(false)}
          onSave={async (prices) => {
            await setPrices(destination.id, prices);
            toast(t.pricesSaved(destination.place.city));
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
  const t = useCopy(COPY);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const secs = Math.max(0, Math.floor((now - startedAt) / 1000));
  const elapsed = secs < 60 ? `${secs} s` : `${Math.floor(secs / 60)} min ${secs % 60} s`;
  const last = steps.at(-1);
  return (
    <div role="status" aria-label={t.progress} className="flex flex-col gap-1.5 text-[13px] text-ink-2">
      <span className="flex flex-wrap items-center gap-x-2">
        <span className="tabular-nums text-muted">{elapsed}</span>
        <span className="min-w-0 truncate">{last ? stepText(last) : searches ? t.startingWeb : t.starting}</span>
      </span>
      <span className="text-muted">{t.takesMinutes}</span>
      {steps.length > 1 && (
        <button type="button" onClick={() => setOpen((o) => !o)} className="cursor-pointer self-start border-0 bg-transparent p-0 text-[13px] font-semibold text-accent" aria-expanded={open}>
          {open ? t.hideSteps : t.showSteps(steps.length)}
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
  const t = useCopy(COPY);
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
              <span className="sr-only">{busy ? t.running : done ? t.done : t.pending}</span>
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
  const t = useCopy(COPY);
  const [tricount, setTricount] = useState(trip.tricountUrl ?? "");
  useEffect(() => setTricount(trip.tricountUrl ?? ""), [trip.tricountUrl]);
  const tricountOk = tricount === "" || /^https:\/\/\S+$/.test(tricount);

  return (
    <div className="flex flex-col gap-5">
      <Section title={t.intro} hint={t.introHint(city)}>
        <Field label={t.intro} hideLabel>
          {({ inputId }) => <TextArea id={inputId} rows={3} maxLength={1000} value={trip.intro} onChange={(e) => onChange({ intro: e.target.value })} />}
        </Field>
      </Section>

      <Section title={t.stay} hint={t.stayHint}>
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
          <Field label={t.address}>
            {({ inputId }) => (
              <TextInput id={inputId} maxLength={200} value={trip.stay.address} onChange={(e) => onChange({ stay: { ...trip.stay, address: e.target.value } })} />
            )}
          </Field>
          <Field label={t.checkIn}>
            {({ inputId }) => (
              <TextInput id={inputId} maxLength={60} placeholder="15:00" value={trip.stay.checkIn} onChange={(e) => onChange({ stay: { ...trip.stay, checkIn: e.target.value } })} />
            )}
          </Field>
          <Field label={t.checkOut}>
            {({ inputId }) => (
              <TextInput id={inputId} maxLength={60} placeholder="11:00" value={trip.stay.checkOut} onChange={(e) => onChange({ stay: { ...trip.stay, checkOut: e.target.value } })} />
            )}
          </Field>
        </div>
        <Field label={t.tricount} aside={tricountOk ? t.tricountAside : t.tricountHttps}>
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

      <Section title={t.gettingThere} hint={t.gettingThereHint}>
        <Field label={t.leavingFrom}>
          {({ inputId }) => <TextInput id={inputId} maxLength={60} placeholder={t.homePlaceholder} value={trip.home} onChange={(e) => onChange({ home: e.target.value })} />}
        </Field>
        <TransportList title={t.toAirportTitle(trip.home || t.home, origin)} options={trip.toAirport} onChange={(toAirport) => onChange({ toAirport })} />
        <TransportList title={t.fromAirportTitle(iata)} options={trip.fromAirport} onChange={(fromAirport) => onChange({ fromAirport })} />
      </Section>

      <Section title={t.todo} hint={t.todoHint}>
        <ItemList label={t.todo} items={trip.todo} price onChange={(todo) => onChange({ todo })} />
      </Section>
      <Section title={t.food} hint={t.foodHint}>
        <ItemList label={t.food} items={trip.food} where onChange={(food) => onChange({ food })} />
      </Section>
      <Section title={t.sights}>
        <ItemList label={t.sights} items={trip.sights} onChange={(sights) => onChange({ sights })} />
      </Section>
      <Section title={t.beforeYouGo} hint={t.beforeYouGoHint}>
        <ItemList label={t.beforeYouGo} items={trip.beforeYouGo} onChange={(beforeYouGo) => onChange({ beforeYouGo })} />
      </Section>

      {trip.sources.length > 0 && (
        <p className="m-0 text-[13px] text-muted">
          {t.sources(trip.by ?? "Claude")}{" "}
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
  const t = useCopy(COPY);
  const set = (i: number, patch: Partial<GuideItem>) => onChange(items.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  return (
    <div className="flex flex-col gap-2.5">
      {items.length === 0 && <p className="m-0 text-sm text-muted">{t.nothingYet}</p>}
      <ul aria-label={label} className="m-0 flex list-none flex-col gap-2.5 p-0">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-2.5 rounded-xl bg-surface-2 p-3">
            <div className={cn("grid min-w-0 flex-1 gap-2", price || where ? "sm:grid-cols-[1fr_2fr_auto]" : "sm:grid-cols-[1fr_2fr]")}>
              <TextInput aria-label={t.itemTitle(label, i + 1)} maxLength={120} value={it.title} onChange={(e) => set(i, { title: e.target.value })} />
              <TextInput aria-label={t.itemDetail(label, i + 1)} maxLength={600} value={it.detail} onChange={(e) => set(i, { detail: e.target.value })} />
              {price && (
                <TextInput
                  aria-label={t.itemPrice(label, i + 1)}
                  inputMode="decimal"
                  placeholder="€"
                  className="sm:w-24"
                  value={euroValue(it.priceCents)}
                  onChange={(e) => set(i, { priceCents: toCents(e.target.value) })}
                />
              )}
              {where && (
                <TextInput aria-label={t.itemWhere(label, i + 1)} maxLength={200} placeholder={t.where} className="sm:w-56" value={it.where ?? ""} onChange={(e) => set(i, { where: e.target.value })} />
              )}
            </div>
            <IconButton label={t.remove(it.title || t.nth(label, i + 1))} size="md" onClick={() => onChange(items.filter((_, j) => j !== i))}>
              <TrashIcon size={16} />
            </IconButton>
          </li>
        ))}
      </ul>
      <Button size="sm" variant="ghost" icon={<PlusIcon size={14} />} className="self-start" disabled={items.length >= 15} onClick={() => onChange([...items, { title: "", detail: "" }])}>
        {t.add}
      </Button>
    </div>
  );
}

function TransportList({ title, options, onChange }: { title: string; options: TransportOption[]; onChange: (options: TransportOption[]) => void }) {
  const t = useCopy(COPY);
  const modes = MODES.map((value) => ({ value, label: t.modes[value] }));
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
              <Select size="sm" label={t.itemMode(title, i + 1)} value={o.mode} options={modes} onChange={(mode) => set(i, { mode })} />
              <TextInput aria-label={t.itemTitle(title, i + 1)} maxLength={120} value={o.title} onChange={(e) => set(i, { title: e.target.value })} />
              <TextInput
                aria-label={t.itemMinutes(title, i + 1)}
                inputMode="numeric"
                placeholder="min"
                value={o.minutes ?? ""}
                onChange={(e) => set(i, { minutes: Math.round(Number(e.target.value)) > 0 ? Math.round(Number(e.target.value)) : null })}
              />
              <TextInput
                aria-label={t.itemPrice(title, i + 1)}
                inputMode="decimal"
                placeholder="€"
                value={euroValue(o.priceCents)}
                onChange={(e) => set(i, { priceCents: toCents(e.target.value) })}
              />
              <TextArea
                aria-label={t.itemDetail(title, i + 1)}
                rows={2}
                maxLength={600}
                className="sm:col-span-4"
                value={o.detail}
                onChange={(e) => set(i, { detail: e.target.value })}
              />
            </div>
            <IconButton label={t.remove(o.title || t.nth(title, i + 1))} size="md" onClick={() => onChange(options.filter((_, j) => j !== i))}>
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
        {t.addOption}
      </Button>
    </div>
  );
}
