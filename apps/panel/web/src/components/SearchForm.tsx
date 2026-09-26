import { useState, type FormEvent } from "react";
import { airportCity, type Plan } from "@wanderlot/core";
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
} from "@wanderlot/ui";

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
}

export function SearchForm({ initial, onSubmit, count = 12, existing = 0, running, flightsConnected, min }: SearchFormProps) {
  const [v, setV] = useState(initial);
  const set = <K extends keyof SearchValues>(k: K, value: SearchValues[K]) => setV((s) => ({ ...s, [k]: value }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit(v);
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-[13px]" aria-label="Nueva búsqueda">
      <div className="flex flex-col gap-1.5">
        <Heading as="h1" size="headline">
          Nueva búsqueda
        </Heading>
        <Text tone="muted">Nada llega al sitio de la cuadrilla hasta que tú lo apruebes.</Text>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Field label="Salimos desde" className="flex-1">
          {({ inputId }) => <TextInput id={inputId} placeholder="Madrid · MAD" value={v.origin} onChange={(e) => set("origin", e.target.value)} />}
        </Field>
        <Field label="Destino" className="flex-1">
          {({ inputId, labelId }) => (
            <Select
              id={inputId}
              labelledBy={labelId}
              value={v.scope}
              onChange={(s) => set("scope", s)}
              options={[
                { value: "any", label: "Cualquiera" },
                { value: "europe", label: "Solo Europa" },
                { value: "place", label: "Destino concreto…" },
              ]}
            />
          )}
        </Field>
      </div>
      {v.scope === "place" && (
        <Field label="¿Adónde?">
          {({ inputId }) => <TextInput id={inputId} maxLength={80} placeholder="Oporto, las Azores, Islandia…" value={v.place} onChange={(e) => set("place", e.target.value)} />}
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
          <strong className="font-bold">{v.people}</strong> {v.people === 1 ? "persona" : "personas"} en este viaje
        </span>
        <Link to="/personas" className="text-[13px] font-semibold">
          Cambiar quién va
        </Link>
      </p>

      <BudgetField value={v.maxPrice} onChange={(m) => set("maxPrice", m)} max={1500} />

      <Fieldset legend="Filtros">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["direct", "Directo"],
              ["one", "1 escala"],
              ["any", "Indiferente"],
            ] as const
          ).map(([value, label]) => (
            <ChoiceChip key={value} type="radio" name="escalas" label={label} checked={v.stops === value} onChange={() => set("stops", value)} />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <ChoiceChip type="checkbox" label="Estimar alojamiento" checked={v.estimateStays} onChange={(e) => set("estimateStays", e.target.checked)} />
          <ChoiceChip type="checkbox" label="Qué hacer y ver" checked={v.suggestThings} onChange={(e) => set("suggestThings", e.target.checked)} />
          <ChoiceChip
            type="checkbox"
            label="También aeropuertos cercanos"
            title="Salir de otro aeropuerto a unas 2 horas si sale más barato o hay mejores vuelos"
            checked={v.nearbyAirports}
            onChange={(e) => set("nearbyAirports", e.target.checked)}
          />
        </div>
      </Fieldset>

      <Fieldset legend="Fuente de datos" variant="muted">
        <div className="flex flex-col gap-2 sm:flex-row">
          <RadioCard
            name="fuente"
            title="API de vuelos"
            description={flightsConnected ? "Precios reales" : "Sin conectar todavía"}
            checked={v.source === "api"}
            disabled={!flightsConnected}
            className={flightsConnected ? undefined : "cursor-not-allowed opacity-50"}
            onChange={() => set("source", "api")}
          />
          <RadioCard name="fuente" title="Claude" description="Con fuentes a verificar" checked={v.source === "claude"} onChange={() => set("source", "claude")} />
        </div>
        <div className="flex items-center gap-2">
          <Select
            className="flex-1"
            size="sm"
            placement="above"
            label="Proveedor de datos de vuelos"
            value={v.provider}
            onChange={(p) => set("provider", p)}
            options={[
              { value: "duffel", label: "Duffel" },
              { value: "amadeus", label: "Amadeus · Self-Service" },
              { value: "kiwi", label: "Kiwi · Tequila" },
            ]}
          />
          <span className="shrink-0 rounded-full bg-surface px-3 py-2 text-xs font-semibold text-muted">{flightsConnected ? "Conectado" : "Sin conectar"}</span>
        </div>
      </Fieldset>

      <Button type="submit" variant="primary" size="lg" block icon={<SearchIcon size={18} />} disabled={running || !v.end || (v.scope === "place" && !v.place.trim())}>
        {running ? "Buscando…" : v.scope === "place" ? `Investigar ${v.place.trim() || "ese destino"}` : existing ? `Buscar ${count} más` : `Generar ${count} propuestas`}
      </Button>
    </form>
  );
}
