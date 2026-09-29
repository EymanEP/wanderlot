import { useEffect, useState, type ComponentProps, type FormEvent } from "react";
import type { Category, Plan } from "@wanderlot/core";
import { Button, Dialog, Field, Notice, Select, TextInput } from "@wanderlot/ui";
import type { ManualProposal } from "../data/backend.ts";
import { toCents } from "./PriceDialog.tsx";

const CATEGORIES: { value: Category; label: string }[] = [
  { value: "ciudad", label: "Ciudad" },
  { value: "escapada", label: "Escapada" },
  { value: "playa", label: "Playa" },
  { value: "naturaleza", label: "Naturaleza" },
];

export interface ManualDialogProps {
  open: boolean;
  plan: Plan;
  onSave: (p: ManualProposal) => Promise<void>;
  onClose: () => void;
}

// "Añadir a mano" (ROADMAP 3.3): a destination the organiser found on their
// own, with the prices they saw. No AI needed; it goes in approved and
// checked, and the price dialog can add the flight times later.
export function ManualDialog({ open, plan, onSave, onClose }: ManualDialogProps) {
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
    for (const set of [setCity, setCountry, setIata, setFlights, setStayName, setStayUrl, setStayTotal]) set("");
    setCategory("ciudad");
    setError(null);
  }, [open]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const code = iata.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(code)) return setError("El aeropuerto va con su código de 3 letras, como LIS o OPO");
    const flightCents = toCents(flights);
    if (flightCents === null) return setError("Pon el precio del vuelo, ida y vuelta, de una persona");
    const stayCents = stayTotal.trim() ? toCents(stayTotal) : undefined;
    if (stayCents === null) return setError("El precio del alojamiento no es un número");
    if (stayCents !== undefined && !stayName.trim()) return setError("Ponle nombre al alojamiento");
    setBusy(true);
    setError(null);
    try {
      await onSave({
        place: { city: city.trim(), country: country.trim(), iata: code },
        category,
        flightCents,
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
      title="Añadir un destino a mano"
      onClose={onClose}
      actions={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" type="submit" form="a-mano" disabled={busy}>
            {busy ? "Añadiendo…" : "Añadir y aprobar"}
          </Button>
        </>
      }
    >
      <form id="a-mano" onSubmit={submit} className="flex flex-col gap-5">
        <span>
          Un sitio que has mirado tú, con los precios que has visto para {plan.partySize} personas. Entra aprobado y «Comprobado a mano»; luego puedes añadirle fotos, pros y contras en
          Comparativa.
        </span>
        <div className="grid gap-3 sm:grid-cols-2">
          {text("Ciudad", city, setCity, { required: true, maxLength: 60, placeholder: "Oporto" })}
          {text("País", country, setCountry, { required: true, maxLength: 60, placeholder: "Portugal" })}
          {text("Aeropuerto de llegada", iata, setIata, { required: true, maxLength: 3, placeholder: "OPO", autoCapitalize: "characters" })}
          <Field label="Tipo de destino">{({ labelId }) => <Select labelledBy={labelId} value={category} options={CATEGORIES} onChange={setCategory} />}</Field>
        </div>
        <div className="border-t border-line-faint pt-4">
          {text("Vuelo, ida y vuelta · € por persona", flights, setFlights, { required: true, inputMode: "decimal", placeholder: `Desde ${plan.origin}` })}
        </div>
        <div className="grid gap-3 border-t border-line-faint pt-4 sm:grid-cols-2">
          {text("Alojamiento (opcional)", stayName, setStayName, { maxLength: 120, placeholder: "Piso en Ribeira, 3 habitaciones" })}
          {text("Enlace (opcional)", stayUrl, setStayUrl, { type: "url", placeholder: "https://www.airbnb.es/rooms/…" })}
          {text(`Alojamiento · € en total, las ${plan.nights} noches`, stayTotal, setStayTotal, { inputMode: "decimal" })}
        </div>
        {error && <Notice role="alert">{error}</Notice>}
      </form>
    </Dialog>
  );
}
