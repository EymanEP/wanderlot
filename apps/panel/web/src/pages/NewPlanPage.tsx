import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { addDaysIso, airportCity, rangeLabel } from "@wanderlot/core";
import { Button, Calendar, Card, Chip, Field, Fieldset, Notice, PageHeader, Range, Stepper, TextInput } from "@wanderlot/ui";
import { PanelShell } from "../components/PanelShell.tsx";
import { originCode } from "../components/SearchForm.tsx";
import { usePanel } from "../data/store.tsx";

const NIGHTS = [3, 5, 7, 10] as const;
const FLEX = [
  { value: 0, label: "Fechas exactas" },
  { value: 1, label: "± 1 día" },
  { value: 2, label: "± 2 días" },
] as const;

// A new trip window (SPEC §1): what the searches in Generar will look for.
export function NewPlanPage() {
  const { state, now, createPlan } = usePanel();
  const navigate = useNavigate();
  const today = now.toISOString().slice(0, 10);
  const origin0 = state.settings?.defaultOrigin ?? "MAD";
  const [name, setName] = useState("");
  const [origin, setOrigin] = useState(`${airportCity(origin0)} · ${origin0}`);
  const [start, setStart] = useState(addDaysIso(today, 45));
  const [month, setMonth] = useState({ year: Number(start.slice(0, 4)), month0: Number(start.slice(5, 7)) - 1 });
  const [nights, setNights] = useState<(typeof NIGHTS)[number]>(7);
  const [flexDays, setFlexDays] = useState<0 | 1 | 2>(1);
  const [people, setPeople] = useState(Math.max(2, state.members.length || 6));
  const [maxPrice, setMaxPrice] = useState(400);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await createPlan({ name: name.trim(), origin: originCode(origin, origin0), dateFrom: start, nights, flexDays, partySize: people, maxPriceCents: maxPrice * 100 });
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
          <Fieldset
            legend={
              <span className="flex items-center justify-between">
                Fechas y duración
                <span className="font-semibold text-accent-strong tabular-nums">
                  {rangeLabel(start, addDaysIso(start, nights))} · {nights} noches
                </span>
              </span>
            }
          >
            <Card variant="outline" radius="tile" padding="sm" className="flex flex-col gap-2.5">
              <Calendar {...month} onMonthChange={setMonth} start={start} end={addDaysIso(start, nights)} onPick={(d) => d > today && setStart(d)} />
              <div className="flex flex-col gap-2 border-t border-line-faint pt-3">
                <div role="group" aria-label="Noches" className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                  {NIGHTS.map((n) => (
                    <Chip key={n} on={nights === n} onClick={() => setNights(n)}>
                      {n} noches
                    </Chip>
                  ))}
                </div>
                <div role="group" aria-label="Flexibilidad" className="flex gap-1.5">
                  {FLEX.map((f) => (
                    <Chip key={f.value} variant="subtle" size="sm" on={flexDays === f.value} onClick={() => setFlexDays(f.value)} className="flex-1">
                      {f.label}
                    </Chip>
                  ))}
                </div>
              </div>
            </Card>
          </Fieldset>
          <Field label="Personas">
            {() => <Stepper value={people} onChange={setPeople} min={1} max={30} unit="viajamos" decrementLabel="Quitar una persona" incrementLabel="Añadir una persona" />}
          </Field>
          <Field label="Tope por persona" aside={`${maxPrice} €`}>
            {({ inputId }) => <Range id={inputId} min={80} max={1500} step={10} value={maxPrice} onChange={(e) => setMaxPrice(Number(e.target.value))} />}
          </Field>
          {error && <Notice role="alert">{error}</Notice>}
          <Button type="submit" variant="primary" size="lg" disabled={busy || !name.trim()}>
            {busy ? "Creando…" : "Crear el plan"}
          </Button>
        </Card>
      </main>
    </PanelShell>
  );
}
