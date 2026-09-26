import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { addDaysIso, airportCity } from "@wanderlot/core";
import { Button, Card, Field, Notice, PageHeader, TextInput, nightsBetween, type DateRange } from "@wanderlot/ui";
import { PanelShell } from "../components/PanelShell.tsx";
import { originCode } from "../components/SearchForm.tsx";
import { TripDates, type FlexDays } from "../components/TripDates.tsx";
import { WhoGoes } from "../components/WhoGoes.tsx";
import { BudgetField } from "../components/BudgetField.tsx";
import { usePanel } from "../data/store.tsx";

// A new trip window (SPEC §1): what the searches in Generar will look for.
export function NewPlanPage() {
  const { state, now, createPlan } = usePanel();
  const navigate = useNavigate();
  const today = now.toISOString().slice(0, 10);
  const origin0 = state.settings?.defaultOrigin ?? "MAD";
  const [name, setName] = useState("");
  const [origin, setOrigin] = useState(`${airportCity(origin0)} · ${origin0}`);
  // No dates until the organiser picks them; the calendar opens on this month.
  const [dates, setDates] = useState<DateRange>({ start: null, end: null });
  const [flexDays, setFlexDays] = useState<FlexDays>(1);
  // Everyone in the group by default; untick who isn't coming. The group may
  // still be loading on arrival, so fill it in once it's there.
  const [going, setGoing] = useState<string[] | null>(null);
  useEffect(() => {
    if (going === null && state.members.length) setGoing(state.members.map((m) => m.id));
  }, [going, state.members]);
  const [maxPrice, setMaxPrice] = useState<number | null>(400);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const { start, end } = dates;
    if (!start || !end) return setError("Elige en el calendario el día de salida y el de vuelta");
    setBusy(true);
    setError(null);
    try {
      await createPlan({ name: name.trim(), origin: originCode(origin, origin0), dateFrom: start, nights: nightsBetween(start, end), flexDays, partySize: Math.max(1, (going ?? []).length), participants: going ?? [], maxPriceCents: maxPrice === null ? null : maxPrice * 100 });
      navigate("/generar");
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <PanelShell showPlan={state.plans.length > 0}>
      <main className="mx-auto flex w-full max-w-[720px] flex-col gap-[26px] px-4 py-8 sm:px-8">
        <PageHeader title="Nuevo plan" subtitle="Una ventana de viaje con sus fechas, quién va y cuánto gastar. Luego generas propuestas para ella." />
        <Card as="form" variant="flat" onSubmit={submit} className="flex flex-col gap-5">
          <Field label="Nombre">
            {({ inputId }) => <TextInput id={inputId} required maxLength={60} placeholder="Semana Santa 2027" value={name} onChange={(e) => setName(e.target.value)} />}
          </Field>
          <Field label="Salimos desde">
            {({ inputId }) => <TextInput id={inputId} value={origin} onChange={(e) => setOrigin(e.target.value)} />}
          </Field>
          <TripDates value={dates} onChange={setDates} flexDays={flexDays} onFlexChange={setFlexDays} min={addDaysIso(today, 1)} />
          <WhoGoes people={state.members} value={going ?? []} onChange={setGoing} />
          <BudgetField value={maxPrice} onChange={setMaxPrice} max={1500} />
          {error && <Notice role="alert">{error}</Notice>}
          <Button type="submit" variant="primary" size="lg" disabled={busy || !name.trim() || !dates.end}>
            {busy ? "Creando…" : "Crear el plan"}
          </Button>
        </Card>
      </main>
    </PanelShell>
  );
}
