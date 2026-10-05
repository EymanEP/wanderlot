import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { addDaysIso, airportCity, copy } from "@wanderlot/core";
import { Button, Card, Field, Notice, PageHeader, RadioCard, TextInput, nightsBetween, useCopy, type DateRange } from "@wanderlot/ui";
import { WindowField, windowOf, type Month } from "../components/WindowField.tsx";
import { PanelShell } from "../components/PanelShell.tsx";
import { originCode } from "../components/SearchForm.tsx";
import { TripDates, type FlexDays } from "../components/TripDates.tsx";
import { WhoGoes } from "../components/WhoGoes.tsx";
import { BudgetField } from "../components/BudgetField.tsx";
import { usePanel } from "../data/store.tsx";

const COPY = copy({
  es: {
    pickDates: "Elige en el calendario el día de salida y el de vuelta",
    title: "Nuevo plan",
    subtitle: "Una ventana de viaje con sus fechas, quién va y cuánto gastar. Luego generas propuestas para ella.",
    name: "Nombre",
    namePlaceholder: "Semana Santa 2027",
    from: "Salimos desde",
    order: "Qué decidís primero",
    datesFirst: "Las fechas",
    datesFirstHint: "Elegís los días (o votáis entre varias opciones) y luego el destino.",
    placeFirst: "El destino, con sus fechas",
    placeFirstHint: "Dais uno o dos meses y cuántas noches: cada propuesta trae sus mejores fechas y se vota todo junto.",
    pickMonths: "Elige el mes, o los dos meses, en que puede ser el viaje",
    creating: "Creando…",
    create: "Crear el plan",
  },
  en: {
    pickDates: "Pick the departure and return days on the calendar",
    title: "New plan",
    subtitle: "A travel window with its dates, who's going and how much to spend. Then you generate proposals for it.",
    name: "Name",
    namePlaceholder: "Easter 2027",
    from: "Flying from",
    order: "What you decide first",
    datesFirst: "The dates",
    datesFirstHint: "You pick the days (or vote between options), then the destination.",
    placeFirst: "The destination, with its dates",
    placeFirstHint: "You give a month or two and how many nights: each proposal brings its best dates and it's all voted together.",
    pickMonths: "Choose the month, or two months, the trip could be in",
    creating: "Creating…",
    create: "Create the plan",
  },
});

// A new trip window (SPEC §1): what the searches in Generar will look for.
export function NewPlanPage() {
  const { state, now, createPlan } = usePanel();
  const t = useCopy(COPY);
  const navigate = useNavigate();
  const today = now.toISOString().slice(0, 10);
  const origin0 = state.settings?.defaultOrigin ?? "MAD";
  const [name, setName] = useState("");
  const [origin, setOrigin] = useState(`${airportCity(origin0)} · ${origin0}`);
  // No dates until the organiser picks them; the calendar opens on this month.
  const [dates, setDates] = useState<DateRange>({ start: null, end: null });
  const [flexDays, setFlexDays] = useState<FlexDays>(1);
  // Or the place first, with its dates (ROADMAP 2.7).
  const [placeFirst, setPlaceFirst] = useState(false);
  const [months, setMonths] = useState<[Month, Month] | null>(null);
  const [nights, setNights] = useState(5);
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
    if (placeFirst ? !months : !start || !end) return setError(placeFirst ? t.pickMonths : t.pickDates);
    const placeWindow = placeFirst ? windowOf(months!, today) : null;
    setBusy(true);
    setError(null);
    try {
      await createPlan({
        name: name.trim(),
        origin: originCode(origin, origin0),
        dateFrom: placeWindow ? placeWindow.from : start!,
        nights: placeWindow ? nights : nightsBetween(start!, end!),
        flexDays,
        partySize: Math.max(1, (going ?? []).length),
        participants: going ?? [],
        maxPriceCents: maxPrice === null ? null : maxPrice * 100,
        ...(placeWindow ? { datesBy: "place" as const, window: placeWindow } : {}),
      });
      navigate("/generar");
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <PanelShell trip={false}>
      <main className="mx-auto flex w-full max-w-[720px] flex-col gap-[26px] px-4 py-8 sm:px-8">
        <PageHeader title={t.title} subtitle={t.subtitle} />
        <Card as="form" variant="flat" onSubmit={submit} className="flex flex-col gap-5">
          <Field label={t.name}>
            {({ inputId }) => <TextInput id={inputId} required maxLength={60} placeholder={t.namePlaceholder} value={name} onChange={(e) => setName(e.target.value)} />}
          </Field>
          <Field label={t.from}>
            {({ inputId }) => <TextInput id={inputId} value={origin} onChange={(e) => setOrigin(e.target.value)} />}
          </Field>
          <div role="radiogroup" aria-label={t.order} className="flex flex-col gap-2">
            <span className="text-[13px] font-bold">{t.order}</span>
            <div className="grid gap-2 sm:grid-cols-2">
              <RadioCard name="orden" title={t.datesFirst} description={t.datesFirstHint} checked={!placeFirst} onChange={() => setPlaceFirst(false)} />
              <RadioCard name="orden" title={t.placeFirst} description={t.placeFirstHint} checked={placeFirst} onChange={() => setPlaceFirst(true)} />
            </div>
          </div>
          {placeFirst ? (
            <WindowField today={today} months={months} onMonthsChange={setMonths} nights={nights} onNightsChange={setNights} />
          ) : (
            <TripDates value={dates} onChange={setDates} flexDays={flexDays} onFlexChange={setFlexDays} min={addDaysIso(today, 1)} />
          )}
          <WhoGoes people={state.members} value={going ?? []} onChange={setGoing} />
          <BudgetField value={maxPrice} onChange={setMaxPrice} max={1500} />
          {error && <Notice role="alert">{error}</Notice>}
          <Button type="submit" variant="primary" size="lg" disabled={busy || !name.trim() || (placeFirst ? !months : !dates.end)}>
            {busy ? t.creating : t.create}
          </Button>
        </Card>
      </main>
    </PanelShell>
  );
}
