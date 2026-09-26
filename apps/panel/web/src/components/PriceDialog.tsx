import { useEffect, useRef, useState, type FormEvent } from "react";
import { baseStay, euros, flightDetailsKnown, flightPriceCents, localTime, shortDate, stayTotalCents, stopsLabel, type Plan, type Proposal } from "@wanderlot/core";
import { Button, DataRow, Dialog, Field, Notice, TextInput } from "@wanderlot/ui";
import type { CheckedPrices } from "../data/backend.ts";
import type { Extracted, ExtractedLeg, ScreenshotImage } from "../data/backend.ts";

export interface PriceDialogProps {
  proposal: Proposal | undefined;
  plan: Plan;
  onSave: (prices: CheckedPrices) => Promise<void>;
  onClose: () => void;
  // Claude reading screenshots of the flights or the stay.
  onExtract: (kind: "flight" | "stay", images: ScreenshotImage[]) => Promise<Extracted>;
}

const toEuros = (cents: number) => String(Math.round(cents) / 100).replace(".", ",");
// "1044", "1044,50", "1.044,50" or "1044.5" → cents; null if it isn't a price.
const toCents = (text: string): number | null => {
  let t = text.trim().replace(/\s|€/g, "");
  // "1.044,50": the dot groups thousands.
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "");
  const n = Number(t);
  return t !== "" && Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
};

const TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;
const MAX_BYTES = 5 * 1024 * 1024;

function readImages(files: FileList): Promise<ScreenshotImage[]> {
  const list = [...files].slice(0, 4);
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

// "Leer captura": a button that opens the file picker and hands the images over.
function ScreenshotButton({ label, busy, onImages }: { label: string; busy: boolean; onImages: (files: FileList) => void }) {
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
          if (e.target.files?.length) onImages(e.target.files);
          e.target.value = "";
        }}
      />
      <Button size="sm" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? "Leyendo la captura…" : label}
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
export function PriceDialog({ proposal: p, plan, onSave, onClose, onExtract }: PriceDialogProps) {
  const stay = p ? baseStay(p.stays) : undefined;
  const people = plan.partySize;
  const [flights, setFlights] = useState("");
  const [legs, setLegs] = useState<{ outbound: ExtractedLeg; inbound: ExtractedLeg } | null>(null);
  const [stayName, setStayName] = useState("");
  const [stayUrl, setStayUrl] = useState("");
  const [stayDescription, setStayDescription] = useState<string | undefined>(undefined);
  const [stayTotal, setStayTotal] = useState("");
  const [reading, setReading] = useState<"flight" | "stay" | null>(null);
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
    // Refill each time a different proposal opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p?.id]);

  const flightCents = toCents(flights);
  const hasStay = stayTotal.trim() !== "";
  const stayCents = hasStay ? toCents(stayTotal) : undefined;
  const stayShare = stayCents === null || stayCents === undefined ? stayCents : Math.round(stayCents / people);

  const read = async (kind: "flight" | "stay", files: FileList) => {
    setReading(kind);
    setError(null);
    try {
      const got = await onExtract(kind, await readImages(files));
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
        if (got.nights !== null && got.nights !== plan.nights) missing.push(`La captura es para ${got.nights} noches y el viaje tiene ${plan.nights}: revisa el precio.`);
      }
      setNotes(missing);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setReading(null);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (flightCents === null || stayCents === null) return setError("Escribe cada precio en euros, por ejemplo 174 o 1044,50");
    if (hasStay && !stayName.trim()) return setError("Ponle nombre al alojamiento");
    const url = stayUrl.trim();
    if (url && !/^https:\/\/\S+$/.test(url)) return setError("El enlace del alojamiento tiene que empezar por https://");
    setBusy(true);
    try {
      await onSave({
        flightCents,
        ...(legs ?? {}),
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
          <Button variant="primary" type="submit" form="precios" disabled={busy || reading !== null}>
            {busy ? "Guardando…" : "Guardar como comprobados"}
          </Button>
        </>
      }
    >
      <form id="precios" onSubmit={submit} className="flex flex-col gap-5">
        <span>
          Pon lo que cuestan hoy, o sube una captura y Claude lo rellena por ti: el vuelo de una persona, y el alojamiento entero para los {people}, como lo muestra
          Airbnb. Revisa lo que lea antes de guardar. Se mostrarán como «Comprobado a mano» durante 72 horas.
        </span>

        <section aria-label="Vuelos" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <strong className="text-[15px]">Vuelos</strong>
            <ScreenshotButton label="Leer captura del vuelo" busy={reading === "flight"} onImages={(f) => void read("flight", f)} />
          </div>
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

        <section aria-label="Alojamiento" className="flex flex-col gap-3 border-t border-line-faint pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <strong className="text-[15px]">Alojamiento</strong>
            <ScreenshotButton label="Leer captura del alojamiento" busy={reading === "stay"} onImages={(f) => void read("stay", f)} />
          </div>
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
