import { useEffect, useState, type ComponentProps, type FormEvent } from "react";
import { addDaysIso, copy, type Category, type Plan } from "@wanderlot/core";
import { Button, Dialog, Field, Notice, Select, TextInput, useCopy } from "@wanderlot/ui";
import type { ManualProposal } from "../data/backend.ts";
import { toCents } from "./PriceDialog.tsx";

const COPY = copy({
  es: {
    ciudad: "Ciudad",
    escapada: "Escapada",
    playa: "Playa",
    naturaleza: "Naturaleza",
    badIata: "El aeropuerto va con su código de 3 letras, como LIS o OPO",
    noFlight: "Pon el precio del vuelo, ida y vuelta, de una persona",
    badStay: "El precio del alojamiento no es un número",
    nameStay: "Ponle nombre al alojamiento",
    title: "Añadir un destino a mano",
    cancel: "Cancelar",
    adding: "Añadiendo…",
    add: "Añadir y aprobar",
    intro: (n: number) => `Un sitio que has mirado tú, con los precios que has visto para ${n} personas. Entra aprobado y «Comprobado a mano»; luego puedes añadirle fotos, pros y contras en Comparativa.`,
    city: "Ciudad",
    cityPlaceholder: "Oporto",
    country: "País",
    countryPlaceholder: "Portugal",
    airport: "Aeropuerto de llegada",
    kind: "Tipo de destino",
    flight: "Vuelo, ida y vuelta · € por persona",
    start: (n: number) => `Salida (el viaje es de ${n} noches)`,
    pickStart: "Elige el día de salida, dentro de la ventana del viaje",
    from: (origin: string) => `Desde ${origin}`,
    stay: "Alojamiento (opcional)",
    stayPlaceholder: "Piso en Ribeira, 3 habitaciones",
    link: "Enlace (opcional)",
    stayTotal: (nights: number) => `Alojamiento · € en total, las ${nights} noches`,
  },
  en: {
    ciudad: "City",
    escapada: "Getaway",
    playa: "Beach",
    naturaleza: "Nature",
    badIata: "The airport goes in as its 3-letter code, like LIS or OPO",
    noFlight: "Enter one person's return flight price",
    badStay: "The stay's price isn't a number",
    nameStay: "Give the stay a name",
    title: "Add a destination by hand",
    cancel: "Cancel",
    adding: "Adding…",
    add: "Add and approve",
    intro: (n: number) => `A place you've looked into yourself, with the prices you saw for ${n} people. It goes in approved and “Checked by hand”; later you can add photos, pros and cons in Compare.`,
    city: "City",
    cityPlaceholder: "Porto",
    country: "Country",
    countryPlaceholder: "Portugal",
    airport: "Arrival airport",
    kind: "Type of destination",
    flight: "Flight, return · € per person",
    start: (n: number) => `Leaving on (the trip is ${n} nights)`,
    pickStart: "Choose the day you leave, within the trip's window",
    from: (origin: string) => `From ${origin}`,
    stay: "Stay (optional)",
    stayPlaceholder: "Flat in Ribeira, 3 bedrooms",
    link: "Link (optional)",
    stayTotal: (nights: number) => `Stay · € in total, all ${nights} nights`,
  },
});

const CATEGORIES: Category[] = ["ciudad", "escapada", "playa", "naturaleza"];

export interface ManualDialogProps {
  open: boolean;
  plan: Plan;
  // A trip deciding the place and the dates together: ask when it starts.
  ownDates?: boolean;
  onSave: (p: ManualProposal) => Promise<void>;
  onClose: () => void;
}

// "Añadir a mano" (ROADMAP 3.3): a destination the organiser found on their
// own, with the prices they saw. No AI needed; it goes in approved and
// checked, and the price dialog can add the flight times later.
export function ManualDialog({ open, plan, ownDates = false, onSave, onClose }: ManualDialogProps) {
  const t = useCopy(COPY);
  // Deciding the place and the dates together (ROADMAP 2.7): its own start.
  const [start, setStart] = useState("");
  const lastStart = plan.window ? addDaysIso(plan.window.to, -plan.nights) : undefined;
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [iata, setIata] = useState("");
  const [category, setCategory] = useState<Category>("ciudad");
  const [flights, setFlights] = useState("");
  const [stayName, setStayName] = useState("");
  const [stayUrl, setStayUrl] = useState("");
  const [stayTotal, setStayTotal] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    for (const set of [setCity, setCountry, setIata, setFlights, setStayName, setStayUrl, setStayTotal, setStart]) set("");
    setCategory("ciudad");
    setError(null);
  }, [open]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const code = iata.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(code)) return setError(t.badIata);
    const flightCents = toCents(flights);
    if (flightCents === null) return setError(t.noFlight);
    const stayCents = stayTotal.trim() ? toCents(stayTotal) : undefined;
    if (stayCents === null) return setError(t.badStay);
    if (stayCents !== undefined && !stayName.trim()) return setError(t.nameStay);
    if (ownDates && !start) return setError(t.pickStart);
    setBusy(true);
    setError(null);
    try {
      await onSave({
        place: { city: city.trim(), country: country.trim(), iata: code },
        category,
        flightCents,
        ...(ownDates ? { dateFrom: start } : {}),
        ...(stayCents !== undefined
          ? { stayCents, stay: { name: stayName.trim(), ...(stayUrl.trim() ? { url: stayUrl.trim() } : {}) } }
          : {}),
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const text = (label: string, value: string, set: (v: string) => void, props: Partial<ComponentProps<typeof TextInput>> = {}) => (
    <Field label={label}>{({ inputId }) => <TextInput id={inputId} value={value} onChange={(e) => set(e.target.value)} {...props} />}</Field>
  );

  return (
    <Dialog
      open={open}
      wide
      title={t.title}
      onClose={onClose}
      actions={
        <>
          <Button onClick={onClose}>{t.cancel}</Button>
          <Button variant="primary" type="submit" form="a-mano" disabled={busy}>
            {busy ? t.adding : t.add}
          </Button>
        </>
      }
    >
      <form id="a-mano" onSubmit={submit} className="flex flex-col gap-5">
        <span>{t.intro(plan.partySize)}</span>
        <div className="grid gap-3 sm:grid-cols-2">
          {text(t.city, city, setCity, { required: true, maxLength: 60, placeholder: t.cityPlaceholder })}
          {text(t.country, country, setCountry, { required: true, maxLength: 60, placeholder: t.countryPlaceholder })}
          {text(t.airport, iata, setIata, { required: true, maxLength: 3, placeholder: "OPO", autoCapitalize: "characters" })}
          <Field label={t.kind}>{({ labelId }) => <Select labelledBy={labelId} value={category} options={CATEGORIES.map((c) => ({ value: c, label: t[c] }))} onChange={setCategory} />}</Field>
        </div>
        <div className="grid gap-3 border-t border-line-faint pt-4 sm:grid-cols-2">
          {ownDates && text(t.start(plan.nights), start, setStart, { type: "date", required: true, ...(plan.window ? { min: plan.window.from } : {}), ...(lastStart ? { max: lastStart } : {}) })}
          {text(t.flight, flights, setFlights, { required: true, inputMode: "decimal", placeholder: t.from(plan.origin) })}
        </div>
        <div className="grid gap-3 border-t border-line-faint pt-4 sm:grid-cols-2">
          {text(t.stay, stayName, setStayName, { maxLength: 120, placeholder: t.stayPlaceholder })}
          {text(t.link, stayUrl, setStayUrl, { type: "url", placeholder: "https://www.airbnb.es/rooms/…" })}
          {text(t.stayTotal(plan.nights), stayTotal, setStayTotal, { inputMode: "decimal" })}
        </div>
        {error && <Notice role="alert">{error}</Notice>}
      </form>
    </Dialog>
  );
}
