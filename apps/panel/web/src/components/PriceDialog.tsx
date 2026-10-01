import { useEffect, useRef, useState, type ClipboardEvent, type FormEvent } from "react";
import { airbnbUrl, baseStay, euros, flightDetailsKnown, flightPriceCents, googleFlightsUrl, localTime, shortDate, stayTotalCents, stopsLabel, type Plan, type Proposal } from "@wanderlot/core";
import { Button, DataRow, Dialog, Field, Notice, RadioCard, TextInput } from "@wanderlot/ui";
import type { Browsed, Extracted, ExtractedLeg, FlightChoice, PriceSave, ScreenshotImage, SearchStep } from "../data/backend.ts";
import type { Task } from "../data/store.tsx";

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

const toEuros = (cents: number) => String(Math.round(cents) / 100).replace(".", ",");
// "1044", "1044,50", "1.044,50" or "1044.5" → cents; null if it isn't a price.
export const toCents = (text: string): number | null => {
  let t = text.trim().replace(/\s|€/g, "");
  // "1.044,50": the dot groups thousands.
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "");
  const n = Number(t);
  return t !== "" && Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
};

const TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;
const MAX_BYTES = 5 * 1024 * 1024;

function readImages(files: File[]): Promise<ScreenshotImage[]> {
  const list = files.slice(0, 4);
  for (const f of list) {
    if (!TYPES.includes(f.type as (typeof TYPES)[number])) return Promise.reject(new Error("Sube capturas en PNG, JPG, WebP o GIF"));
    if (f.size > MAX_BYTES) return Promise.reject(new Error("Cada captura tiene que pesar menos de 5 MB"));
  }
  return Promise.all(
    list.map(
      (f) =>
        new Promise<ScreenshotImage>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve({ mediaType: f.type as ScreenshotImage["mediaType"], data: String(r.result).split(",")[1] ?? "" });
          r.onerror = () => reject(new Error("No se pudo leer el archivo"));
          r.readAsDataURL(f);
        }),
    ),
  );
}

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
  if (!files.length) throw new Error("No hay ninguna imagen copiada");
  return files;
}

// "Leer captura": a button that opens the file picker and hands the images
// over, and "Pegar captura" beside it for one copied to the clipboard.
function ScreenshotButton({ label, busy, onImages }: { label: string; busy: boolean; onImages: (files: File[]) => void }) {
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
      <div className="flex flex-wrap gap-2">
        {canReadClipboard && !busy && (
          <Button size="sm" variant="ghost" onClick={() => void clipboardImages().then(onImages, (e: Error) => onImages(Object.assign([], { error: e.message })))}>
            Pegar captura
          </Button>
        )}
        <Button size="sm" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? "Leyendo la captura…" : label}
        </Button>
      </div>
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
const stepLine = (s: SearchStep) => (s.kind === "read" ? `Mirando ${s.host}…` : s.kind === "search" ? `Buscando «${s.query}»…` : s.text);

export function PriceDialog({ proposal: p, plan, onSave, onClose, onExtract, browse, aiName = "Claude" }: PriceDialogProps) {
  const stay = p ? baseStay(p.stays) : undefined;
  const people = plan.partySize;
  const [flights, setFlights] = useState("");
  const [legs, setLegs] = useState<{ outbound: ExtractedLeg; inbound: ExtractedLeg } | null>(null);
  const [stayName, setStayName] = useState("");
  const [stayUrl, setStayUrl] = useState("");
  const [stayDescription, setStayDescription] = useState<string | undefined>(undefined);
  const [stayTotal, setStayTotal] = useState("");
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

  const read = async (kind: "flight" | "stay", files: File[] & { error?: string }) => {
    if (files.error) return setError(files.error);
    setReading(kind);
    setPasted(null);
    setError(null);
    try {
      fill(await onExtract!(kind, await readImages(files)), "la captura");
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
    for (const t of finished) {
      if (t.status === "failed") setError(t.error ?? "No se pudo leer la página");
      else if (t.result && "kind" in t.result) {
        const got = t.result as Browsed;
        // What got in the way, in Claude's words, when it couldn't read it.
        const why = got.problem ? [`Google Flights: ${got.problem}`] : [];
        if (got.options.length) {
          setFlightOptions(got.options);
          pickFlight(got.options, 0);
          setNotes(why);
        } else setNotes([...why, "No vi vuelos con precio en Google Flights: búscalo tú y escribe el precio."]);
        setSeen((s) => ({ ...s, flight: got.options[0]?.bookingUrl || got.pageUrl || "" }));
      }
      browse!.take(t.id);
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
      else missing.push("No vi el precio del vuelo por persona: escríbelo tú.");
      if (got.outbound && got.inbound) setLegs({ outbound: got.outbound, inbound: got.inbound });
      else missing.push("No vi los dos vuelos, ida y vuelta, así que la cuadrilla verá solo el precio.");
    } else {
      if (got.name) setStayName(got.name);
      setStayDescription(got.description ?? undefined);
      if (got.stayCents !== null) setStayTotal(toEuros(got.stayCents));
      else missing.push("No vi el precio total del alojamiento: escríbelo tú.");
      if (got.nights !== null && got.nights !== plan.nights) missing.push(`${from[0]!.toUpperCase()}${from.slice(1)} es para ${got.nights} noches y el viaje tiene ${plan.nights}: revisa el precio.`);
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
    if (flightCents === null || stayCents === null) return setError("Escribe cada precio en euros, por ejemplo 174 o 1044,50");
    if (hasStay && !stayName.trim()) return setError("Ponle nombre al alojamiento");
    const url = stayUrl.trim();
    if (url && !/^https:\/\/\S+$/.test(url)) return setError("El enlace del alojamiento tiene que empezar por https://");
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

  const euroField = (label: string, hint: string, value: string, set: (v: string) => void, required = true) => (
    <Field label={label}>
      {({ inputId }) => (
        <>
          <TextInput id={inputId} aria-describedby={`${inputId}-hint`} inputMode="decimal" required={required} value={value} onChange={(e) => set(e.target.value)} />
          <span id={`${inputId}-hint`} className="-mt-1 text-[13px] text-muted">
            {hint}
          </span>
        </>
      )}
    </Field>
  );

  const timesKnown = legs !== null || (p ? flightDetailsKnown(p) && p.provenance.kind !== "claude" : false);

  return (
    <Dialog
      open={p !== undefined}
      wide
      title={p ? `Precios de ${p.place.city}` : ""}
      onClose={onClose}
      actions={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" type="submit" form="precios" disabled={busy || reading !== null || browsing !== null}>
            {busy ? "Guardando…" : "Guardar como comprobados"}
          </Button>
        </>
      }
    >
      <form id="precios" onSubmit={submit} onPaste={onPaste} className="flex flex-col gap-5">
        <span>
          {onExtract
            ? `Pon lo que cuestan hoy, o sube o pega (Ctrl+V) una captura y ${aiName} lo rellena por ti: el vuelo de una persona, y el alojamiento entero para los ${people}, como lo muestra Airbnb. Revisa lo que lea antes de guardar.`
            : `Pon lo que cuestan hoy: el vuelo de una persona, y el alojamiento entero para los ${people}, como lo muestra Airbnb. Leer capturas necesita una IA: mira en Ajustes cómo añadir una.`}{" "}
          Se mostrarán como «Comprobado a mano» durante 72 horas.
          {browse && ` Con «Mirar en Google Flights», ${aiName} abre Google Flights en una ventana de este ordenador y trae los mejores vuelos, con el precio de la página de reserva, para que elijas uno: mírala, y si sale un aviso de cookies o un CAPTCHA, resuélvelo tú. El alojamiento míralo tú en Airbnb con el enlace de abajo.`}
        </span>

        {browsing && (
          <div role="status" className="rounded-xl bg-surface-2 px-3.5 py-3 text-sm">
            {step ?? "Abriendo Google Flights en el navegador…"}
          </div>
        )}

        {pasted && (
          <div role="group" aria-label="¿De qué es la captura?" className="flex flex-wrap items-center gap-2 rounded-xl bg-surface-2 px-3.5 py-3 text-sm">
            <span className="mr-auto">¿De qué es la captura que has pegado?</span>
            <Button size="sm" onClick={() => void read("flight", pasted)}>
              Del vuelo
            </Button>
            <Button size="sm" onClick={() => void read("stay", pasted)}>
              Del alojamiento
            </Button>
          </div>
        )}

        <section aria-label="Vuelos" className="flex flex-col gap-3" onFocus={() => setFocus("flight")}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <strong className="text-[15px]">Vuelos</strong>
            <div className="flex flex-wrap items-center gap-2">
              {browse && (
                <Button size="sm" variant="secondary" disabled={browsing !== null || reading !== null} onClick={look}>
                  {browsing ? "Mirando en Google Flights…" : "Mirar en Google Flights"}
                </Button>
              )}
              {onExtract && <ScreenshotButton label="Leer captura del vuelo" busy={reading === "flight"} onImages={(f) => void read("flight", f)} />}
            </div>
          </div>
          {p && (
            <a
              href={googleFlightsUrl(p.outbound.from, p.outbound.to, plan.dateFrom, plan.dateTo)}
              target="_blank"
              rel="noreferrer"
              className="self-start text-[13px] font-semibold text-accent hover:text-accent-hover"
            >
              Buscar en Google Flights · {shortDate(plan.dateFrom)} – {shortDate(plan.dateTo)}
            </a>
          )}
          {flightOptions && (
            <div role="radiogroup" aria-label="Vuelos encontrados" className="flex flex-col gap-2">
              <span className="text-[13px] text-muted">Las mejores opciones que vio en Google Flights. Elige una:</span>
              {flightOptions.map((o, i) => (
                <RadioCard
                  key={i}
                  name="vuelo"
                  title={`${euros(o.flightCents)} por persona${o.note ? ` · ${o.note}` : ""}`}
                  description={[
                    o.checkedToEnd
                      ? `Precio al reservar${o.bookWith ? ` con ${o.bookWith}` : ""}${o.listedCents !== null && o.listedCents !== o.flightCents ? ` (en la lista ponía ${euros(o.listedCents)})` : ""}`
                      : "Precio de la lista: puede cambiar al reservar",
                    o.outbound ? `Ida ${legLine(o.outbound)}${o.inbound ? ` · Vuelta ${legLine(o.inbound)}` : ""}` : "Sin horarios",
                  ].join(" · ")}
                  checked={flightPick === i}
                  onChange={() => pickFlight(flightOptions, i)}
                />
              ))}
            </div>
          )}
          {p &&
            euroField(
              "Vuelo, ida y vuelta · € por persona",
              `${p.outbound.from} → ${p.outbound.to} y vuelta, una persona`,
              flights,
              setFlights,
            )}
          {legs ? (
            <div className="flex flex-col gap-1 rounded-xl bg-accent-soft px-3.5 py-3 text-[13px] text-accent-strong">
              <span>Ida · {legLine(legs.outbound)}</span>
              <span>Vuelta · {legLine(legs.inbound)}</span>
              <button type="button" onClick={() => setLegs(null)} className="cursor-pointer self-start border-0 bg-transparent p-0 font-semibold text-accent-strong underline">
                Quitar horarios
              </button>
            </div>
          ) : (
            !timesKnown && <span className="text-[13px] text-muted">Sin captura del vuelo, la cuadrilla verá solo el precio, sin horarios ni fechas.</span>
          )}
        </section>

        <section aria-label="Alojamiento" className="flex flex-col gap-3 border-t border-line-faint pt-4" onFocus={() => setFocus("stay")}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <strong className="text-[15px]">Alojamiento</strong>
            <div className="flex flex-wrap items-center gap-2">
              {onExtract && <ScreenshotButton label="Leer captura del alojamiento" busy={reading === "stay"} onImages={(f) => void read("stay", f)} />}
            </div>
          </div>
          {p && (
            <a
              href={airbnbUrl({ city: p.place.city, dateFrom: plan.dateFrom, dateTo: plan.dateTo, partySize: people }, stay?.url)}
              target="_blank"
              rel="noreferrer"
              className="self-start text-[13px] font-semibold text-accent hover:text-accent-hover"
            >
              {stay?.url && /airbnb\./.test(stay.url) ? "Ver el alojamiento en Airbnb" : "Buscar en Airbnb"} · {shortDate(plan.dateFrom)} – {shortDate(plan.dateTo)} · {people} personas
            </a>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nombre del alojamiento">
              {({ inputId }) => <TextInput id={inputId} maxLength={120} value={stayName} onChange={(e) => setStayName(e.target.value)} />}
            </Field>
            <Field label="Enlace (opcional)">
              {({ inputId }) => <TextInput id={inputId} type="url" placeholder="https://www.airbnb.es/rooms/…" value={stayUrl} onChange={(e) => setStayUrl(e.target.value)} />}
            </Field>
          </div>
          {euroField("Alojamiento · € en total", `Las ${plan.nights} noches, todo el grupo. Déjalo vacío si no hay alojamiento.`, stayTotal, setStayTotal, false)}
          {stay && <span className="text-[13px] text-muted">Al guardar, en el sitio solo se verá este alojamiento; las otras opciones de la búsqueda se quitan.</span>}
        </section>

        <dl className="m-0 flex flex-col gap-2" aria-label="Por persona">
          <DataRow label="Vuelo por persona" value={flightCents === null ? "—" : euros(flightCents)} />
          <DataRow label="Alojamiento por persona" value={stayShare === null ? "—" : stayShare === undefined ? "Sin alojamiento" : euros(stayShare)} />
          <DataRow variant="highlight" label="Total por persona" value={flightCents === null || stayShare === null ? "—" : euros(flightCents + (stayShare ?? 0))} />
        </dl>
        {notes.map((n) => (
          <Notice key={n} tone="neutral">
            {n}
          </Notice>
        ))}
        {error && <Notice role="alert">{error}</Notice>}
      </form>
    </Dialog>
  );
}
