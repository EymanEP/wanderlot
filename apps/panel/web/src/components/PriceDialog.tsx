import { useEffect, useRef, useState, type ClipboardEvent, type FormEvent } from "react";
import { airbnbUrl, baseStay, copy, currentLocale, duration, euros, flightDetailsKnown, flightPriceCents, googleFlightsUrl, localTime, shortDate, stayTotalCents, pick, stopsLabel, type Plan, type Proposal } from "@wanderlot/core";
import { Button, CarIcon, Dialog, ExternalIcon, Field, HouseIcon, Notice, PlaneIcon, RadioCard, TextInput, buttonClasses, cn, useCopy } from "@wanderlot/ui";
import type { Browsed, Extracted, ExtractedLeg, FlightChoice, PriceSave, ScreenshotImage, SearchStep } from "../data/backend.ts";
import type { Task } from "../data/store.tsx";

const COPY = copy({
  es: {
    badType: "Sube capturas en PNG, JPG, WebP o GIF",
    tooBig: "Cada captura tiene que pesar menos de 5 MB",
    unreadableFile: "No se pudo leer el archivo",
    noImage: "No hay ninguna imagen copiada",
    paste: "Pegar captura",
    reading: "Leyendo…",
    upload: "Subir captura",
    looking: (host: string) => `Mirando ${host}…`,
    searching: (query: string) => `Buscando «${query}»…`,
    unreadablePage: "No se pudo leer la página",
    noFlightsSeen: "No vi vuelos con precio en Google Flights: búscalo tú y escribe el precio.",
    theScreenshot: "la captura",
    noFlightPrice: "No vi el precio del vuelo por persona: escríbelo tú.",
    noLegs: "No vi los dos vuelos, ida y vuelta, así que la cuadrilla verá solo el precio.",
    noStayPrice: "No vi el precio total del alojamiento: escríbelo tú.",
    nightsMismatch: (from: string, got: number, nights: number) => `${from[0]!.toUpperCase()}${from.slice(1)} es para ${got} noches y el viaje tiene ${nights}: revisa el precio.`,
    badPrice: "Escribe cada precio en euros, por ejemplo 174 o 1044,50",
    nameStay: "Ponle nombre al alojamiento",
    badUrl: "El enlace del alojamiento tiene que empezar por https://",
    title: (city: string) => `Precios de ${city}`,
    nights: (n: number) => `${n} ${n === 1 ? "noche" : "noches"}`,
    people: (n: number) => `${n} personas`,
    cancel: "Cancelar",
    saving: "Guardando…",
    save: "Guardar como comprobados",
    intro: "Lo que cuesta hoy: el vuelo de una persona y el alojamiento entero para el grupo. En el sitio se verá como «Comprobado a mano».",
    canPaste: (ai: string) => ` Puedes pegar (Ctrl+V) una captura y ${ai} la lee.`,
    needsAi: " Leer capturas necesita una IA: mira en Ajustes cómo añadir una.",
    opening: "Abriendo Google Flights en el navegador…",
    captcha: " Si sale un aviso de cookies o un CAPTCHA, resuélvelo en esa ventana.",
    whichLabel: "¿De qué es la captura?",
    whichText: "¿De qué es la captura que has pegado?",
    ofFlight: "Del vuelo",
    ofStay: "Del alojamiento",
    flights: "Vuelos",
    flight: "Vuelo",
    returnPerPerson: "ida y vuelta, por persona",
    lookingShort: "Mirando…",
    lookGoogle: "Mirar en Google Flights",
    readFlight: "Leer captura del vuelo",
    uploadFlight: "Subir captura del vuelo",
    found: "Vuelos encontrados",
    out: (leg: string) => `Ida · ${leg}`,
    back: (leg: string) => `Vuelta · ${leg}`,
    bookedPrice: (bookWith: string | null | undefined, listed: string | null) => `Precio al reservar${bookWith ? ` con ${bookWith}` : ""}${listed ? ` (en la lista ponía ${listed})` : ""}`,
    listPrice: "Precio de la lista: puede cambiar al reservar",
    flightInput: "Vuelo, ida y vuelta · € por persona",
    perPersonPrice: "Precio por persona",
    openGoogle: "Abrir Google Flights",
    removeTimes: "Quitar horarios",
    noTimes: "Sin horarios, el grupo verá solo el precio.",
    stay: "Alojamiento",
    wholeGroup: (nights: string) => `Todo el grupo, ${nights}`,
    seeAirbnb: "Ver en Airbnb",
    searchAirbnb: "Buscar en Airbnb",
    readStay: "Leer captura del alojamiento",
    uploadStay: "Subir captura del alojamiento",
    name: "Nombre",
    stayName: "Nombre del alojamiento",
    namePlaceholder: "Piso con terraza en el centro",
    stayInput: "Alojamiento · € en total",
    stayTotal: "Total de la estancia",
    link: "Enlace (opcional)",
    leaveEmpty: "Déjalo vacío si no hay alojamiento.",
    onlyThis: " Al guardar, en el sitio solo se verá este; las otras opciones de la búsqueda se quitan.",
    perPerson: "Por persona",
    noStay: "Sin alojamiento",
    access: "Llegar al aeropuerto",
    accessFrom: (home: string, airport: string) => `Desde ${home} hasta ${airport} y vuelta, por persona`,
    accessInput: "Llegar al aeropuerto y volver, por persona, en euros",
    accessTotal: "Por persona, ida y vuelta",
    accessEstimate: "Lo estimó la IA: corrígelo si sabes lo que cuesta.",
    accessOptions: "Cómo vamos al aeropuerto",
    accessCounts: "La que elijas cuenta en el precio por persona.",
    totalPerPerson: "Total por persona",
  },
  en: {
    badType: "Upload screenshots as PNG, JPG, WebP or GIF",
    tooBig: "Each screenshot has to be under 5 MB",
    unreadableFile: "Couldn't read the file",
    noImage: "There's no image copied",
    paste: "Paste screenshot",
    reading: "Reading…",
    upload: "Upload screenshot",
    looking: (host: string) => `Looking at ${host}…`,
    searching: (query: string) => `Searching for “${query}”…`,
    unreadablePage: "Couldn't read the page",
    noFlightsSeen: "I didn't see any priced flights on Google Flights: look it up yourself and type the price.",
    theScreenshot: "the screenshot",
    noFlightPrice: "I didn't see the flight price per person: type it in yourself.",
    noLegs: "I didn't see both flights, there and back, so the group will only see the price.",
    noStayPrice: "I didn't see the stay's total price: type it in yourself.",
    nightsMismatch: (from: string, got: number, nights: number) => `${from[0]!.toUpperCase()}${from.slice(1)} is for ${got} nights and the trip has ${nights}: check the price.`,
    badPrice: "Type each price in euros, for example 174 or 1044.50",
    nameStay: "Give the stay a name",
    badUrl: "The stay's link has to start with https://",
    title: (city: string) => `Prices for ${city}`,
    nights: (n: number) => `${n} ${n === 1 ? "night" : "nights"}`,
    people: (n: number) => `${n} people`,
    cancel: "Cancel",
    saving: "Saving…",
    save: "Save as checked",
    intro: "What it costs today: one person's flight and the whole stay for the group. On the site it will show as “Checked by hand”.",
    canPaste: (ai: string) => ` You can paste (Ctrl+V) a screenshot and ${ai} reads it.`,
    needsAi: " Reading screenshots needs an AI: see Settings for how to add one.",
    opening: "Opening Google Flights in the browser…",
    captcha: " If a cookie notice or a CAPTCHA appears, deal with it in that window.",
    whichLabel: "What is the screenshot of?",
    whichText: "What is the screenshot you pasted of?",
    ofFlight: "The flight",
    ofStay: "The stay",
    flights: "Flights",
    flight: "Flight",
    returnPerPerson: "return, per person",
    lookingShort: "Looking…",
    lookGoogle: "Look on Google Flights",
    readFlight: "Read flight screenshot",
    uploadFlight: "Upload flight screenshot",
    found: "Flights found",
    out: (leg: string) => `Out · ${leg}`,
    back: (leg: string) => `Back · ${leg}`,
    bookedPrice: (bookWith: string | null | undefined, listed: string | null) => `Price when booking${bookWith ? ` with ${bookWith}` : ""}${listed ? ` (the list said ${listed})` : ""}`,
    listPrice: "Price from the list: it may change when booking",
    flightInput: "Flight, return · € per person",
    perPersonPrice: "Price per person",
    openGoogle: "Open Google Flights",
    removeTimes: "Remove times",
    noTimes: "Without times, the group will only see the price.",
    stay: "Stay",
    wholeGroup: (nights: string) => `The whole group, ${nights}`,
    seeAirbnb: "See on Airbnb",
    searchAirbnb: "Search Airbnb",
    readStay: "Read stay screenshot",
    uploadStay: "Upload stay screenshot",
    name: "Name",
    stayName: "Name of the stay",
    namePlaceholder: "Flat with a terrace in the centre",
    stayInput: "Stay · € in total",
    stayTotal: "Total for the stay",
    link: "Link (optional)",
    leaveEmpty: "Leave it empty if there's no stay.",
    onlyThis: " Once saved, the site will only show this one; the other options from the search are removed.",
    perPerson: "Per person",
    noStay: "No stay",
    access: "Getting to the airport",
    accessFrom: (home: string, airport: string) => `From ${home} to ${airport} and back, per person`,
    accessInput: "Getting to the airport and back, per person, in euros",
    accessTotal: "Per person, there and back",
    accessEstimate: "The AI's estimate: correct it if you know what it costs.",
    accessOptions: "How we get to the airport",
    accessCounts: "The one you pick counts in the price per person.",
    totalPerPerson: "Total per person",
  },
});

export interface PriceDialogProps {
  proposal: Proposal | undefined;
  plan: Plan;
  onSave: (prices: PriceSave) => Promise<void>;
  onClose: () => void;
  // An AI reading screenshots of the flights or the stay; without one set up,
  // the prices are typed.
  onExtract?: (kind: "flight" | "stay", images: ScreenshotImage[]) => Promise<Extracted>;
  // Which AI reads them: "Claude", "OpenAI".
  aiName?: string;
  // "Mirar en Google Flights": Claude reads the real page in a
  // browser on the laptop (ROADMAP 3.4). Only for the finalists. The reading
  // is a task in the panel (store.tsx), so it carries on if the dialog closes
  // and its result fills the fields when it opens again.
  browse?: { tasks: Task[]; start: () => void; take: (id: string) => void };
}

// The decimal comma in Spanish, the point in English.
const toEuros = (cents: number) => String(Math.round(cents) / 100).replace(".", currentLocale() === "en" ? "." : ",");
// "1044", "1044,50", "1.044,50", "1044.5" or, in English, "1,044.50" →
// cents; null if it isn't a price.
export const toCents = (text: string): number | null => {
  let t = text.trim().replace(/\s|€/g, "");
  // Both: whichever comes last is the decimal mark ("1.044,50", "1,044.50").
  if (t.includes(",") && t.includes(".")) t = t.lastIndexOf(",") > t.lastIndexOf(".") ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
  // A comma alone: decimals in Spanish; in English "1,044" groups thousands.
  else if (t.includes(",")) t = currentLocale() === "en" && /^\d{1,3}(,\d{3})+$/.test(t) ? t.replace(/,/g, "") : t.replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "");
  const n = Number(t);
  return t !== "" && Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
};

const TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;
const MAX_BYTES = 5 * 1024 * 1024;

function readImages(files: File[]): Promise<ScreenshotImage[]> {
  const list = files.slice(0, 4);
  for (const f of list) {
    if (!TYPES.includes(f.type as (typeof TYPES)[number])) return Promise.reject(new Error(pick(COPY).badType));
    if (f.size > MAX_BYTES) return Promise.reject(new Error(pick(COPY).tooBig));
  }
  return Promise.all(
    list.map(
      (f) =>
        new Promise<ScreenshotImage>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve({ mediaType: f.type as ScreenshotImage["mediaType"], data: String(r.result).split(",")[1] ?? "" });
          r.onerror = () => reject(new Error(pick(COPY).unreadableFile));
          r.readAsDataURL(f);
        }),
    ),
  );
}

// In the list of flights, where the dates are the trip's: "11:55 BIO → 14:05 AMS · KLM KL1524 · directo"
const legShort = (l: ExtractedLeg) => `${localTime(l.departAt)} ${l.from} → ${localTime(l.arriveAt)} ${l.to} · ${l.carrier} ${l.flightNumber} · ${stopsLabel(l.stops).toLowerCase()}`;

// "11:55 BIO → 14:05 AMS · mié 18 nov · KLM KL1524 · directo"
const legLine = (l: ExtractedLeg) => `${localTime(l.departAt)} ${l.from} → ${localTime(l.arriveAt)} ${l.to} · ${shortDate(l.departAt)} · ${l.carrier} ${l.flightNumber} · ${stopsLabel(l.stops).toLowerCase()}`;

// Images on the clipboard, where the browser lets a page read them (Chrome,
// Edge, Safari); elsewhere Ctrl/Cmd+V into the dialog does the same.
const canReadClipboard = typeof navigator !== "undefined" && typeof navigator.clipboard?.read === "function";
async function clipboardImages(): Promise<File[]> {
  const files: File[] = [];
  for (const item of await navigator.clipboard.read()) {
    const type = item.types.find((t) => t.startsWith("image/"));
    if (type) files.push(new File([await item.getType(type)], "captura", { type }));
  }
  if (!files.length) throw new Error(pick(COPY).noImage);
  return files;
}

// "Leer captura": a button that opens the file picker and hands the images
// over, and "Pegar captura" beside it for one copied to the clipboard.
function ScreenshotButton({ label, uploadLabel, busy, onImages }: { label: string; uploadLabel: string; busy: boolean; onImages: (files: File[]) => void }) {
  const t = useCopy(COPY);
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={input}
        type="file"
        accept={TYPES.join(",")}
        multiple
        hidden
        aria-label={label}
        onChange={(e) => {
          if (e.target.files?.length) onImages([...e.target.files]);
          e.target.value = "";
        }}
      />
      {canReadClipboard && !busy && (
        <Button size="sm" variant="ghost" onClick={() => void clipboardImages().then(onImages, (e: Error) => onImages(Object.assign([], { error: e.message })))}>
          {t.paste}
        </Button>
      )}
      <Button size="sm" variant="ghost" aria-label={uploadLabel} disabled={busy} onClick={() => input.current?.click()}>
        {busy ? t.reading : t.upload}
      </Button>
    </>
  );
}

// The organiser checked the real prices (airline, Airbnb, booking site) and
// types them in, or has Claude read them off a screenshot, the way those
// sites show them: one person's flights there and back, and what the whole
// group pays for the stay. From then on the proposal shows as checked by hand
// (SPEC §3). Without a screenshot of the flights, the site shows their price
// alone: research's times would sit beside a real price.
const SITE = { flight: { name: "Google Flights", id: "google-flights" }, stay: { name: "Airbnb", id: "airbnb" } } as const;

// What the browser is doing, in a line.
const stepLine = (s: SearchStep) => (s.kind === "read" ? pick(COPY).looking(s.host) : s.kind === "search" ? pick(COPY).searching(s.query) : s.text);

export function PriceDialog({ proposal: p, plan, onSave, onClose, onExtract, browse, aiName = "Claude" }: PriceDialogProps) {
  const t = useCopy(COPY);
  const stay = p ? baseStay(p.stays) : undefined;
  const people = plan.partySize;
  const [flights, setFlights] = useState("");
  const [legs, setLegs] = useState<{ outbound: ExtractedLeg; inbound: ExtractedLeg } | null>(null);
  const [stayName, setStayName] = useState("");
  const [stayUrl, setStayUrl] = useState("");
  const [stayDescription, setStayDescription] = useState<string | undefined>(undefined);
  const [stayTotal, setStayTotal] = useState("");
  const [access, setAccess] = useState("");
  // Which of the ways to the airport counts: 0 is the one counting now.
  const [choice, setChoice] = useState(0);
  const [reading, setReading] = useState<"flight" | "stay" | null>(null);
  // Read in the browser: the best flights to pick from.
  const [flightOptions, setFlightOptions] = useState<FlightChoice[] | null>(null);
  const [flightPick, setFlightPick] = useState(0);
  // Where the prices were read in the browser, for the sources.

  const [seen, setSeen] = useState<{ flight?: string; stay?: string }>({});
  // Where a pasted screenshot goes: the section last worked in, or asked.
  const [focus, setFocus] = useState<"flight" | "stay" | null>(null);
  const [pasted, setPasted] = useState<File[] | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!p) return;
    setFlights(toEuros(flightPriceCents(p)));
    setLegs(null);
    setStayName(stay?.name ?? "");
    setStayUrl(stay?.url ?? "");
    setStayDescription(stay?.description);
    setStayTotal(stay ? toEuros(stayTotalCents(stay, plan.nights)) : "");
    setAccess(p.access ? toEuros(p.access.cents) : "");
    setChoice(0);
    setNotes([]);
    setError(null);
    setFocus(null);
    setPasted(null);
    setSeen({});
    setFlightOptions(null);
    // Refill each time a different proposal opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p?.id]);

  const flightCents = toCents(flights);
  const hasStay = stayTotal.trim() !== "";
  const stayCents = hasStay ? toCents(stayTotal) : undefined;
  const stayShare = stayCents === null || stayCents === undefined ? stayCents : Math.round(stayCents / people);
  // Only when research worked it out: there's an estimate to correct.
  const accessCents = p?.access ? toCents(access) : undefined;
  const ways = p?.access ? [p.access, ...(p.access.alternatives ?? [])] : [];
  const way = ways[choice];
  const chooseWay = (i: number) => {
    setChoice(i);
    setAccess(toEuros(ways[i]!.cents));
  };

  const read = async (kind: "flight" | "stay", files: File[] & { error?: string }) => {
    if (files.error) return setError(files.error);
    setReading(kind);
    setPasted(null);
    setError(null);
    try {
      fill(await onExtract!(kind, await readImages(files)), t.theScreenshot);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setReading(null);
    }
  };

  // Claude reads the real page in the browser window on the laptop.
  // The browser's readings for this proposal: running ones show their step;
  // finished ones fill the fields (or say what failed) once, then go.
  const running = browse?.tasks.find((t) => t.status === "running");
  const browsing = running ? ("flight" as const) : null;
  const step = running?.steps.at(-1) ? stepLine(running.steps.at(-1)!) : null;
  const finished = browse?.tasks.filter((t) => t.status !== "running") ?? [];
  useEffect(() => {
    if (!p || !finished.length) return;
    for (const task of finished) {
      if (task.status === "failed") setError(task.error ?? t.unreadablePage);
      else if (task.result && "kind" in task.result) {
        const got = task.result as Browsed;
        // What got in the way, in Claude's words, when it couldn't read it.
        const why = got.problem ? [`Google Flights: ${got.problem}`] : [];
        if (got.options.length) {
          setFlightOptions(got.options);
          pickFlight(got.options, 0);
          setNotes(why);
        } else setNotes([...why, t.noFlightsSeen]);
        setSeen((s) => ({ ...s, flight: got.options[0]?.bookingUrl || got.pageUrl || "" }));
      }
      browse!.take(task.id);
    }
    // Once per finished reading, while this proposal's dialog is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p?.id, finished.map((t) => t.id).join()]);
  const look = () => {
    setError(null);
    browse!.start();
  };

  // A flight from the list, into the fields.
  const pickFlight = (options: FlightChoice[], i: number) => {
    const o = options[i]!;
    setFlightPick(i);
    setFlights(toEuros(o.flightCents));
    setLegs(o.outbound && o.inbound ? { outbound: o.outbound, inbound: o.inbound } : null);
    // The source is where it's booked, when it got that far.
    if (o.bookingUrl) setSeen((s) => ({ ...s, flight: o.bookingUrl! }));
  };
  // What was read, into the fields; says what's missing.
  const fill = (got: Extracted, from: string) => {
    const missing: string[] = [];
    if (got.kind === "flight") {
      if (got.flightCents !== null) setFlights(toEuros(got.flightCents));
      else missing.push(t.noFlightPrice);
      if (got.outbound && got.inbound) setLegs({ outbound: got.outbound, inbound: got.inbound });
      else missing.push(t.noLegs);
    } else {
      if (got.name) setStayName(got.name);
      setStayDescription(got.description ?? undefined);
      if (got.stayCents !== null) setStayTotal(toEuros(got.stayCents));
      else missing.push(t.noStayPrice);
      if (got.nights !== null && got.nights !== plan.nights) missing.push(t.nightsMismatch(from, got.nights, plan.nights));
    }
    setNotes(missing);
  };

  // Ctrl/Cmd+V with an image: read it into the section being worked in.
  const onPaste = (e: ClipboardEvent) => {
    const images = [...e.clipboardData.files].filter((f) => f.type.startsWith("image/"));
    if (!images.length || reading || !onExtract) return;
    e.preventDefault();
    if (focus) void read(focus, images);
    else setPasted(images);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (flightCents === null || stayCents === null || accessCents === null) return setError(t.badPrice);
    if (hasStay && !stayName.trim()) return setError(t.nameStay);
    const url = stayUrl.trim();
    if (url && !/^https:\/\/\S+$/.test(url)) return setError(t.badUrl);
    setBusy(true);
    try {
      const kinds = (["flight", "stay"] as const).filter((k) => seen[k] !== undefined);
      await onSave({
        flightCents,
        ...(legs ?? {}),
        ...(kinds.length
          ? {
              seenOn: kinds.map((k) => SITE[k].id),
              sources: kinds.flatMap((k) => (seen[k] && /^https:\/\//.test(seen[k]!) ? [{ label: SITE[k].name, url: seen[k]! }] : [])),
            }
          : {}),
        ...(choice > 0 ? { accessChoice: choice - 1 } : {}),
        ...(accessCents !== undefined && accessCents !== way?.cents ? { accessCents } : {}),
        ...(stayCents !== undefined
          ? { stayCents, stay: { name: stayName.trim(), ...(stayDescription ? { description: stayDescription } : {}), ...(url ? { url } : {}) } }
          : {}),
      });
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // A price in euros, with a short visible label and the full one for
  // screen readers.
  const euroInput = (name: string, label: string, value: string, set: (v: string) => void, required = true) => (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-semibold text-ink-2">{label}</span>
      <span className="relative flex items-center">
        <TextInput aria-label={name} inputMode="decimal" required={required} value={value} onChange={(e) => set(e.target.value)} className="pr-9 text-[17px] font-bold tabular-nums" />
        <span aria-hidden className="pointer-events-none absolute right-3.5 text-[15px] font-semibold text-muted">
          €
        </span>
      </span>
    </label>
  );

  const timesKnown = legs !== null || (p ? flightDetailsKnown(p) && p.provenance.kind !== "claude" : false);
  const linkClass = "inline-flex items-center gap-1 text-[13px] font-semibold text-accent no-underline hover:text-accent-hover";
  const total = flightCents === null || stayShare === null || accessCents === null ? null : flightCents + (stayShare ?? 0) + (accessCents ?? 0);

  return (
    <Dialog
      open={p !== undefined}
      wide
      title={p ? t.title(p.place.city) : ""}
      subtitle={`${shortDate(plan.dateFrom)} – ${shortDate(plan.dateTo)} · ${t.nights(plan.nights)} · ${t.people(people)}`}
      onClose={onClose}
      actions={
        <>
          <Button onClick={onClose}>{t.cancel}</Button>
          <Button variant="primary" type="submit" form="precios" disabled={busy || reading !== null || browsing !== null}>
            {busy ? t.saving : t.save}
          </Button>
        </>
      }
    >
      <form id="precios" onSubmit={submit} onPaste={onPaste} className="flex flex-col gap-4">
        <span className="text-sm text-ink-2">
          {t.intro}
          {onExtract ? t.canPaste(aiName) : t.needsAi}
        </span>

        {browsing && (
          <div role="status" className="flex items-center gap-3 rounded-xl bg-accent-soft px-3.5 py-3 text-sm text-accent-strong">
            <span aria-hidden className="size-3.5 shrink-0 rounded-full border-2 border-accent border-t-transparent motion-safe:animate-spin" />
            <span>
              {step ?? t.opening}
              {t.captcha}
            </span>
          </div>
        )}

        {pasted && (
          <div role="group" aria-label={t.whichLabel} className="flex flex-wrap items-center gap-2 rounded-xl bg-surface-2 px-3.5 py-3 text-sm">
            <span className="mr-auto">{t.whichText}</span>
            <Button size="sm" onClick={() => void read("flight", pasted)}>
              {t.ofFlight}
            </Button>
            <Button size="sm" onClick={() => void read("stay", pasted)}>
              {t.ofStay}
            </Button>
          </div>
        )}

        <section aria-label={t.flights} className="flex flex-col gap-3.5 rounded-card border border-line-soft p-3 sm:p-4" onFocus={() => setFocus("flight")}>
          <header className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-full bg-surface-2 text-ink-2">
                <PlaneIcon size={18} />
              </span>
              <div className="flex flex-col">
                <strong className="text-[15px]">{t.flight}</strong>
                {p && (
                  <span className="text-[13px] text-muted">
                    {p.outbound.from} ⇄ {p.outbound.to} · {t.returnPerPerson}
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              {browse && (
                <Button size="sm" variant="secondary" disabled={browsing !== null || reading !== null} onClick={look}>
                  {browsing ? t.lookingShort : t.lookGoogle}
                </Button>
              )}
              {onExtract && <ScreenshotButton label={t.readFlight} uploadLabel={t.uploadFlight} busy={reading === "flight"} onImages={(f) => void read("flight", f)} />}
            </div>
          </header>

          {flightOptions && (
            <div role="radiogroup" aria-label={t.found} className="flex flex-col overflow-hidden rounded-xl border border-line-soft">
              {flightOptions.map((o, i) => (
                <label
                  key={i}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 px-3.5 py-3 [&+&]:border-t [&+&]:border-line-faint",
                    flightPick === i ? "bg-accent-soft" : "hover:bg-surface-2",
                  )}
                >
                  <input type="radio" name="vuelo" checked={flightPick === i} onChange={() => pickFlight(flightOptions, i)} className="mt-1 accent-[var(--color-accent)]" />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-[15px] font-bold tabular-nums">{euros(o.flightCents)}</span>
                      {o.note && <span className="text-sm font-semibold">{o.note}</span>}
                    </span>
                    {o.outbound && <span className="text-[13px] text-ink-2">{t.out(legShort(o.outbound))}</span>}
                    {o.inbound && <span className="text-[13px] text-ink-2">{t.back(legShort(o.inbound))}</span>}
                    <span className="text-xs text-muted">
                      {o.checkedToEnd
                        ? t.bookedPrice(o.bookWith, o.listedCents !== null && o.listedCents !== o.flightCents ? euros(o.listedCents) : null)
                        : t.listPrice}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
            <div className="w-full sm:w-[220px]">{euroInput(t.flightInput, t.perPersonPrice, flights, setFlights)}</div>
            {p && (
              <a href={googleFlightsUrl(p.outbound.from, p.outbound.to, plan.dateFrom, plan.dateTo)} target="_blank" rel="noreferrer" className={cn(linkClass, "pb-3")}>
                {t.openGoogle} <ExternalIcon size={13} />
              </a>
            )}
          </div>
          {legs && !flightOptions ? (
            <div className="flex flex-wrap items-start justify-between gap-2 rounded-xl bg-surface-2 px-3.5 py-2.5 text-[13px]">
              <span className="flex flex-col gap-0.5">
                <span>{t.out(legLine(legs.outbound))}</span>
                <span>{t.back(legLine(legs.inbound))}</span>
              </span>
              <button type="button" onClick={() => setLegs(null)} className="cursor-pointer border-0 bg-transparent p-0 text-[13px] font-semibold text-accent underline">
                {t.removeTimes}
              </button>
            </div>
          ) : (
            !timesKnown && !legs && <span className="text-[13px] text-muted">{t.noTimes}</span>
          )}
        </section>

        <section aria-label={t.stay} className="flex flex-col gap-3.5 rounded-card border border-line-soft p-3 sm:p-4" onFocus={() => setFocus("stay")}>
          <header className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-full bg-surface-2 text-ink-2">
                <HouseIcon size={18} />
              </span>
              <div className="flex flex-col">
                <strong className="text-[15px]">{t.stay}</strong>
                <span className="text-[13px] text-muted">
                  {t.wholeGroup(t.nights(plan.nights))}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              {p && (
                <a
                  href={airbnbUrl({ city: p.place.city, dateFrom: plan.dateFrom, dateTo: plan.dateTo, partySize: people }, stay?.url)}
                  target="_blank"
                  rel="noreferrer"
                  className={buttonClasses({ size: "sm", variant: "secondary" })}
                >
                  {stay?.url && /airbnb\./.test(stay.url) ? t.seeAirbnb : t.searchAirbnb} <ExternalIcon size={13} />
                </a>
              )}
              {onExtract && <ScreenshotButton label={t.readStay} uploadLabel={t.uploadStay} busy={reading === "stay"} onImages={(f) => void read("stay", f)} />}
            </div>
          </header>
          <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
            <Field label={t.name}>
              {({ inputId }) => <TextInput id={inputId} aria-label={t.stayName} maxLength={120} placeholder={t.namePlaceholder} value={stayName} onChange={(e) => setStayName(e.target.value)} />}
            </Field>
            {euroInput(t.stayInput, t.stayTotal, stayTotal, setStayTotal, false)}
          </div>
          <Field label={t.link}>
            {({ inputId }) => <TextInput id={inputId} type="url" placeholder="https://www.airbnb.es/rooms/…" value={stayUrl} onChange={(e) => setStayUrl(e.target.value)} />}
          </Field>
          <span className="text-[13px] text-muted">
            {t.leaveEmpty}
            {stay ? t.onlyThis : ""}
          </span>
        </section>

        {p?.access && (
          <section aria-label={t.access} className="flex flex-col gap-3 rounded-card border border-line-soft p-3 sm:p-4">
            <div className="grid items-end gap-3 sm:grid-cols-[1fr_200px]">
              <div className="flex items-center gap-2.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-2">
                  <CarIcon size={18} />
                </span>
                <div className="flex min-w-0 flex-col">
                  <strong className="text-[15px]">{t.access}</strong>
                  <span className="text-[13px] text-muted">{t.accessFrom(p.access.home, p.outbound.from)}</span>
                  {ways.length > 1 && <span className="text-[13px] text-ink-2">{t.accessCounts}</span>}
                </div>
              </div>
              {euroInput(t.accessInput, t.accessTotal, access, setAccess)}
            </div>
            <div role="radiogroup" aria-label={t.accessOptions} className="flex flex-col gap-2">
              {ways.map((w, i) => (
                <RadioCard
                  key={`${i}:${w.title}`}
                  name="llegar"
                  title={`${w.title}${w.minutes ? ` · ${duration(w.minutes)}` : ""}`}
                  description={`${w.checked ? "" : "≈ "}${euros(w.cents)}${w.detail ? ` · ${w.detail}` : ""}`}
                  checked={choice === i}
                  onChange={() => chooseWay(i)}
                />
              ))}
            </div>
            {!way?.checked && <span className="text-[13px] text-muted">{t.accessEstimate}</span>}
          </section>
        )}

        {notes.map((n) => (
          <Notice key={n} tone="neutral">
            {n}
          </Notice>
        ))}
        {error && <Notice role="alert">{error}</Notice>}

        <dl aria-label={t.perPerson} className="m-0 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-card bg-surface-2 px-4 py-3.5">
          <div className="flex gap-6">
            <div className="flex flex-col">
              <dt className="text-xs text-muted">{t.flight}</dt>
              <dd className="m-0 text-[15px] font-semibold tabular-nums">{flightCents === null ? "—" : euros(flightCents)}</dd>
            </div>
            <div className="flex flex-col">
              <dt className="text-xs text-muted">{t.stay}</dt>
              <dd className="m-0 text-[15px] font-semibold tabular-nums">{stayShare === null ? "—" : stayShare === undefined ? t.noStay : euros(stayShare)}</dd>
            </div>
            {accessCents !== undefined && (
              <div className="flex flex-col">
                <dt className="text-xs text-muted">{t.access}</dt>
                <dd className="m-0 text-[15px] font-semibold tabular-nums">{accessCents === null ? "—" : euros(accessCents)}</dd>
              </div>
            )}
          </div>
          <div className="flex flex-col items-end">
            <dt className="text-xs font-semibold text-muted">{t.totalPerPerson}</dt>
            <dd className="m-0 text-[22px] font-extrabold tracking-[-0.02em] tabular-nums">{total === null ? "—" : euros(total)}</dd>
          </div>
        </dl>
      </form>
    </Dialog>
  );
}
