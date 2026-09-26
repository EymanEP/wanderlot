import { useEffect, useState, type FormEvent } from "react";
import { baseStay, type Proposal } from "@wanderlot/core";
import { Button, Dialog, Field, Notice, TextInput } from "@wanderlot/ui";
import type { CheckedPrices } from "../data/backend.ts";

export interface PriceDialogProps {
  proposal: Proposal | undefined;
  onSave: (prices: CheckedPrices) => Promise<void>;
  onClose: () => void;
}

const toEuros = (cents: number) => String(Math.round(cents) / 100);
// "137", "137,50" or "137.5" → cents; null if it isn't a price.
const toCents = (text: string): number | null => {
  const n = Number(text.trim().replace(",", "."));
  return text.trim() !== "" && Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
};

// The organiser checked the real prices (airline, booking site) and types
// them in; from then on the proposal shows as checked by hand (SPEC §3).
export function PriceDialog({ proposal: p, onSave, onClose }: PriceDialogProps) {
  const stay = p ? baseStay(p.stays) : undefined;
  const [outbound, setOutbound] = useState("");
  const [inbound, setInbound] = useState("");
  const [nightly, setNightly] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!p) return;
    setOutbound(toEuros(p.outbound.priceCents));
    setInbound(toEuros(p.inbound.priceCents));
    setNightly(stay ? toEuros(stay.nightlyCents) : "");
    setError(null);
    // Refill each time a different proposal opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p?.id]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const outboundCents = toCents(outbound);
    const inboundCents = toCents(inbound);
    const stayNightlyCents = stay ? toCents(nightly) : undefined;
    if (outboundCents === null || inboundCents === null || stayNightlyCents === null) return setError("Escribe cada precio en euros, por ejemplo 137 o 137,50");
    setBusy(true);
    try {
      await onSave({ outboundCents, inboundCents, ...(stayNightlyCents !== undefined ? { stayNightlyCents } : {}) });
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const euroField = (label: string, value: string, set: (v: string) => void) => (
    <Field label={label}>
      {({ inputId }) => <TextInput id={inputId} inputMode="decimal" required value={value} onChange={(e) => set(e.target.value)} />}
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
        <span>Pon lo que cuestan de verdad hoy. Se mostrarán como «Comprobado a mano» durante 72 horas; después toca volver a mirarlos.</span>
        <div className="grid gap-3 sm:grid-cols-2">
          {euroField(`Ida ${p?.outbound.from ?? ""} → ${p?.outbound.to ?? ""} · € por persona`, outbound, setOutbound)}
          {euroField(`Vuelta ${p?.inbound.from ?? ""} → ${p?.inbound.to ?? ""} · € por persona`, inbound, setInbound)}
        </div>
        {stay && euroField(`${stay.name} · € por noche, todo el grupo`, nightly, setNightly)}
        {error && <Notice role="alert">{error}</Notice>}
      </form>
    </Dialog>
  );
}
