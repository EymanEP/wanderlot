import { useState, type FormEvent } from "react";
import { airportCity, copy, type Plan } from "@wanderlot/core";
import { Link } from "react-router";
import { BudgetField } from "./BudgetField.tsx";
import { TripDates, datesSummary, type FlexDays } from "./TripDates.tsx";
import {
  Button,
  ChoiceChip,
  Field,
  Fieldset,
  Heading,
  RadioCard,
  SearchIcon,
  Select,
  Text,
  TextInput,
  useCopy,
} from "@wanderlot/ui";

const COPY = copy({
  es: {
    newSearch: "Nueva búsqueda",
    intro: "Nada llega al sitio de la cuadrilla hasta que tú lo apruebes.",
    from: "Salimos desde",
    destination: "Destino",
    any: "Cualquiera",
    europe: "Solo Europa",
    place: "Destino concreto…",
    where: "¿Adónde?",
    placeHint: "Oporto, las Azores, Islandia…",
    onTrip: (n: number): string => `${n === 1 ? "persona" : "personas"} en este viaje`,
    changeWho: "Cambiar quién va",
    filters: "Filtros",
    direct: "Directo",
    oneStop: "1 escala",
    anyStops: "Indiferente",
    stays: "Estimar alojamiento",
    things: "Qué hacer y ver",
    nearby: "También aeropuertos cercanos",
    nearbyHint: "Salir de otro aeropuerto a unas 2 horas si sale más barato o hay mejores vuelos",
    source: "Fuente de datos",
    flightApi: "API de vuelos",
    realPrices: "Precios reales",
    notYet: "Sin conectar todavía",
    toVerify: "Con fuentes a verificar",
    estimated: "Precios estimados",
    provider: "Proveedor de datos de vuelos",
    connected: "Conectado",
    notConnected: "Sin conectar",
    searching: "Buscando…",
    research: (place: string) => `Investigar ${place || "ese destino"}`,
    more: (n: number) => `Buscar ${n} más`,
    generate: (n: number) => `Generar ${n} propuestas`,
  },
  en: {
    newSearch: "New search",
    intro: "Nothing reaches the group's site until you approve it.",
    from: "Flying from",
    destination: "Destination",
    any: "Anywhere",
    europe: "Europe only",
    place: "A specific destination…",
    where: "Where to?",
    placeHint: "Porto, the Azores, Iceland…",
    onTrip: (n: number): string => `${n === 1 ? "person" : "people"} on this trip`,
    changeWho: "Change who's going",
    filters: "Filters",
    direct: "Direct",
    oneStop: "1 stop",
    anyStops: "Any",
    stays: "Estimate accommodation",
    things: "Things to do and see",
    nearby: "Nearby airports too",
    nearbyHint: "Fly from another airport about 2 hours away if it's cheaper or has better flights",
    source: "Data source",
    flightApi: "Flight API",
    realPrices: "Real prices",
    notYet: "Not connected yet",
    toVerify: "With sources to check",
    estimated: "Estimated prices",
    provider: "Flight data provider",
    connected: "Connected",
    notConnected: "Not connected",
    searching: "Searching…",
    research: (place: string) => `Research ${place || "that destination"}`,
    more: (n: number) => `Search ${n} more`,
    generate: (n: number) => `Generate ${n} proposals`,
  },
});

export type Scope = "any" | "europe" | "place";
export type Stops = "direct" | "one" | "any";
export type Source = "api" | "claude";
export type Provider = "duffel" | "amadeus" | "kiwi";

export interface SearchValues {
  origin: string;
  scope: Scope;
  place: string;
  start: string | null;
  // null while the organiser is between the two clicks.
  end: string | null;
  flexDays: FlexDays;
  // Who goes is chosen in Personas; shown here, not edited.
  people: number;
  // Euros per person; null means no limit.
  maxPrice: number | null;
  // Also look at airports within reach of the origin.
  nearbyAirports: boolean;
  stops: Stops;
  estimateStays: boolean;
  suggestThings: boolean;
  source: Source;
  provider: Provider;
}

// The form starts from the plan; dates, people and budget are saved back to it.
// Without a flight API, searches go through Claude.
export function searchFromPlan(plan: Plan, flightsConnected = false): SearchValues {
  return {
    origin: `${airportCity(plan.origin)} · ${plan.origin}`,
    scope: "any",
    place: "",
    start: plan.dateFrom,
    end: plan.dateTo,
    flexDays: plan.flexDays,
    people: plan.partySize,
    maxPrice: plan.maxPriceCents === null ? null : Math.round(plan.maxPriceCents / 100),
    nearbyAirports: false,
    stops: "direct",
    estimateStays: true,
    suggestThings: true,
    source: flightsConnected ? "api" : "claude",
    provider: "duffel",
  };
}

// "Madrid · MAD" or "mad" → "MAD"
export function originCode(text: string, fallback: string): string {
  return /([A-Za-z]{3})\s*$/.exec(text.trim())?.[1]?.toUpperCase() ?? fallback;
}

export function rangeSummary(v: SearchValues): string {
  return datesSummary(v);
}

export interface SearchFormProps {
  initial: SearchValues;
  onSubmit: (v: SearchValues) => void;
  count?: number;
  // Proposals already on the trip: a new search adds to them.
  existing?: number;
  running?: boolean;
  flightsConnected: boolean;
  // First day that can be picked.
  min: string;
  // The AI that researches (ROADMAP 3.3), and whether it searches the web.
  ai?: { name: string; search: boolean };
}

export function SearchForm({ initial, onSubmit, count = 12, existing = 0, running, flightsConnected, min, ai = { name: "Claude", search: true } }: SearchFormProps) {
  const t = useCopy(COPY);
  const [v, setV] = useState(initial);
  const set = <K extends keyof SearchValues>(k: K, value: SearchValues[K]) => setV((s) => ({ ...s, [k]: value }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit(v);
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-[13px]" aria-label={t.newSearch}>
      <div className="flex flex-col gap-1.5">
        <Heading as="h1" size="headline">
          {t.newSearch}
        </Heading>
        <Text tone="muted">{t.intro}</Text>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Field label={t.from} className="flex-1">
          {({ inputId }) => <TextInput id={inputId} placeholder="Madrid · MAD" value={v.origin} onChange={(e) => set("origin", e.target.value)} />}
        </Field>
        <Field label={t.destination} className="flex-1">
          {({ inputId, labelId }) => (
            <Select
              id={inputId}
              labelledBy={labelId}
              value={v.scope}
              onChange={(s) => set("scope", s)}
              options={[
                { value: "any", label: t.any },
                { value: "europe", label: t.europe },
                { value: "place", label: t.place },
              ]}
            />
          )}
        </Field>
      </div>
      {v.scope === "place" && (
        <Field label={t.where}>
          {({ inputId }) => <TextInput id={inputId} maxLength={80} placeholder={t.placeHint} value={v.place} onChange={(e) => set("place", e.target.value)} />}
        </Field>
      )}

      <TripDates
        value={v}
        onChange={(r) => setV((s) => ({ ...s, ...r }))}
        flexDays={v.flexDays}
        onFlexChange={(f) => set("flexDays", f)}
        min={v.start && v.start < min ? v.start : min}
      />

      <p className="m-0 flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span>
          <strong className="font-bold">{v.people}</strong> {t.onTrip(v.people)}
        </span>
        <Link to="/personas" className="text-[13px] font-semibold">
          {t.changeWho}
        </Link>
      </p>

      <BudgetField value={v.maxPrice} onChange={(m) => set("maxPrice", m)} max={1500} />

      <Fieldset legend={t.filters}>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["direct", t.direct],
              ["one", t.oneStop],
              ["any", t.anyStops],
            ] as const
          ).map(([value, label]) => (
            <ChoiceChip key={value} type="radio" name="escalas" label={label} checked={v.stops === value} onChange={() => set("stops", value)} />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <ChoiceChip type="checkbox" label={t.stays} checked={v.estimateStays} onChange={(e) => set("estimateStays", e.target.checked)} />
          <ChoiceChip type="checkbox" label={t.things} checked={v.suggestThings} onChange={(e) => set("suggestThings", e.target.checked)} />
          <ChoiceChip
            type="checkbox"
            label={t.nearby}
            title={t.nearbyHint}
            checked={v.nearbyAirports}
            onChange={(e) => set("nearbyAirports", e.target.checked)}
          />
        </div>
      </Fieldset>

      <Fieldset legend={t.source} variant="muted">
        <div className="flex flex-col gap-2 sm:flex-row">
          <RadioCard
            name="fuente"
            title={t.flightApi}
            description={flightsConnected ? t.realPrices : t.notYet}
            checked={v.source === "api"}
            disabled={!flightsConnected}
            className={flightsConnected ? undefined : "cursor-not-allowed opacity-50"}
            onChange={() => set("source", "api")}
          />
          <RadioCard name="fuente" title={ai.name} description={ai.search ? t.toVerify : t.estimated} checked={v.source === "claude"} onChange={() => set("source", "claude")} />
        </div>
        <div className="flex items-center gap-2">
          <Select
            className="flex-1"
            size="sm"
            placement="above"
            label={t.provider}
            value={v.provider}
            onChange={(p) => set("provider", p)}
            options={[
              { value: "duffel", label: "Duffel" },
              { value: "amadeus", label: "Amadeus · Self-Service" },
              { value: "kiwi", label: "Kiwi · Tequila" },
            ]}
          />
          <span className="shrink-0 rounded-full bg-surface px-3 py-2 text-xs font-semibold text-muted">{flightsConnected ? t.connected : t.notConnected}</span>
        </div>
      </Fieldset>

      <Button type="submit" variant="primary" size="lg" block icon={<SearchIcon size={18} />} disabled={running || !v.end || (v.scope === "place" && !v.place.trim())}>
        {running ? t.searching : v.scope === "place" ? t.research(v.place.trim()) : existing ? t.more(count) : t.generate(count)}
      </Button>
    </form>
  );
}
