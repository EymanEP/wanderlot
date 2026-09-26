import { useEffect, useState, type FormEvent } from "react";
import { baseStay, euros, groupFlightsCents, stayTotalCents, type Plan, type Proposal } from "@wanderlot/core";
import { Button, DataRow, Dialog, Field, Notice, TextInput } from "@wanderlot/ui";
import type { CheckedPrices } from "../data/backend.ts";

export interface PriceDialogProps {
  proposal: Proposal | undefined;
  plan: Plan;
  onSave: (prices: CheckedPrices) => Promise<void>;
  onClose: () => void;
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

// The organiser checked the real prices (airline, Airbnb, booking site) and
// types them in the way those sites show them: what the whole group pays for
// the flights there and back, and for the whole stay. The panel works out
// each person's share. From then on the proposal shows as checked by hand
// (SPEC §3).
export function PriceDialog({ proposal: p, plan, onSave, onClose }: PriceDialogProps) {
  const stay = p ? baseStay(p.stays) : undefined;
  const people = plan.partySize;
  const [flights, setFlights] = useState("");
  const [stayTotal, setStayTotal] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!p) return;
    setFlights(toEuros(groupFlightsCents(p, people)));
    setStayTotal(stay ? toEuros(stayTotalCents(stay, plan.nights)) : "");
    setError(null);
    // Refill each time a different proposal opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p?.id]);

  const flightsCents = toCents(flights);
  const stayCents = stay ? toCents(stayTotal) : undefined;
  const share = (cents: number | null | undefined) => (cents === null || cents === undefined ? null : Math.round(cents / people));
  const flightsShare = share(flightsCents);
  const stayShare = share(stayCents);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (flightsCents === null || stayCents === null) return setError("Escribe cada precio en euros, por ejemplo 1044 o 1044,50");
    setBusy(true);
    try {
      await onSave({ flightsCents, ...(stayCents !== undefined ? { stayCents } : {}) });
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const euroField = (label: string, hint: string, value: string, set: (v: string) => void) => (
    <Field label={label}>
      {({ inputId }) => (
        <>
          <TextInput id={inputId} aria-describedby={`${inputId}-hint`} inputMode="decimal" required value={value} onChange={(e) => set(e.target.value)} />
          <span id={`${inputId}-hint`} className="-mt-1 text-[13px] text-muted">
            {hint}
          </span>
        </>
      )}
    </Field>
  );

  return (
    <Dialog
      open={p !== undefined}
      title={p ? `Precios de ${p.place.city}` : ""}
      onClose={onClose}
      actions={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" type="submit" form="precios" disabled={busy}>
            {busy ? "Guardando…" : "Guardar como comprobados"}
          </Button>
        </>
      }
    >
      <form id="precios" onSubmit={submit} className="flex flex-col gap-3.5">
        <span>
          Pon el total que te piden hoy para los {people}, como lo muestran la aerolínea o Airbnb. Se mostrarán como «Comprobado a mano» durante 72 horas;
          después toca volver a mirarlos.
        </span>
        {p &&
          euroField(
            "Vuelos, ida y vuelta · € en total",
            `${p.outbound.from} → ${p.outbound.to} y vuelta, para ${people} ${people === 1 ? "persona" : "personas"}`,
            flights,
            setFlights,
          )}
        {stay && euroField("Alojamiento · € en total", `${stay.name} · las ${plan.nights} noches, todo el grupo`, stayTotal, setStayTotal)}
        <dl className="m-0 flex flex-col gap-2" aria-label="Por persona">
          <DataRow label="Vuelos por persona" value={flightsShare === null ? "—" : euros(flightsShare)} />
          {stay && <DataRow label="Alojamiento por persona" value={stayShare === null || stayShare === undefined ? "—" : euros(stayShare)} />}
          <DataRow
            variant="highlight"
            label="Total por persona"
            value={flightsShare === null || stayShare === null ? "—" : euros(flightsShare + (stayShare ?? 0))}
          />
        </dl>
        {error && <Notice role="alert">{error}</Notice>}
      </form>
    </Dialog>
  );
}
