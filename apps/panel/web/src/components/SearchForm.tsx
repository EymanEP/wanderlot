import { useState, type FormEvent } from "react";
import { rangeLabel } from "@wanderlot/core";
import {
  Button,
  Calendar,
  Card,
  ChoiceChip,
  Chip,
  Field,
  Fieldset,
  Heading,
  RadioCard,
  Range,
  SearchIcon,
  Select,
  Stepper,
  Text,
  TextInput,
  addDays,
} from "@wanderlot/ui";

export type Scope = "any" | "europe" | "place";
export type Stops = "direct" | "one" | "any";
export type Source = "api" | "claude";
export type Provider = "duffel" | "amadeus" | "kiwi";

export interface SearchValues {
  origin: string;
  scope: Scope;
  place: string;
  start: string;
  nights: 3 | 5 | 7 | 10;
  flexDays: 0 | 1 | 2;
  people: number;
  maxPrice: number;
  stops: Stops;
  estimateStays: boolean;
  suggestThings: boolean;
  source: Source;
  provider: Provider;
}

export const DEFAULT_SEARCH: SearchValues = {
  origin: "Madrid · MAD",
  scope: "any",
  place: "",
  start: "2026-11-07",
  nights: 7,
  flexDays: 0,
  people: 6,
  maxPrice: 420,
  stops: "direct",
  estimateStays: true,
  suggestThings: true,
  source: "api",
  provider: "duffel",
};

const NIGHTS = [3, 5, 7, 10] as const;
const FLEX = [
  { value: 0, label: "Fechas exactas" },
  { value: 1, label: "± 1 día" },
  { value: 2, label: "± 2 días" },
] as const;

export function rangeSummary(v: SearchValues): string {
  return `${rangeLabel(v.start, addDays(v.start, v.nights))} · ${v.nights} noches`;
}

export function SearchForm({ onSubmit, count = 12 }: { onSubmit: (v: SearchValues) => void; count?: number }) {
  const [v, setV] = useState(DEFAULT_SEARCH);
  const [month, setMonth] = useState({ year: 2026, month0: 10 });
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
        <Field label="Origen" className="flex-1">
          {({ inputId }) => <TextInput id={inputId} value={v.origin} onChange={(e) => set("origin", e.target.value)} />}
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
          {({ inputId }) => <TextInput id={inputId} placeholder="Ciudad o aeropuerto" value={v.place} onChange={(e) => set("place", e.target.value)} />}
        </Field>
      )}

      <Fieldset legend={<span className="flex items-center justify-between">Fechas y duración<span className="font-semibold text-accent-strong tabular-nums">{rangeSummary(v)}</span></span>}>
        <Card variant="outline" radius="tile" padding="sm" className="flex flex-col gap-2.5">
          <Calendar {...month} onMonthChange={setMonth} start={v.start} end={addDays(v.start, v.nights)} onPick={(d) => set("start", d)} />
          <div className="flex flex-col gap-2 border-t border-line-faint pt-3">
            <div role="group" aria-label="Noches" className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {NIGHTS.map((n) => (
                <Chip key={n} on={v.nights === n} onClick={() => set("nights", n)} className="px-2">
                  {n} noches
                </Chip>
              ))}
            </div>
            <div role="group" aria-label="Flexibilidad" className="flex gap-1.5">
              {FLEX.map((f) => (
                <Chip key={f.value} variant="subtle" size="sm" on={v.flexDays === f.value} onClick={() => set("flexDays", f.value)} className="flex-1">
                  {f.label}
                </Chip>
              ))}
            </div>
          </div>
        </Card>
      </Fieldset>

      <Field label="Personas">
        {() => <Stepper value={v.people} onChange={(n) => set("people", n)} min={1} max={12} unit="viajamos" decrementLabel="Quitar una persona" incrementLabel="Añadir una persona" />}
      </Field>

      <Field label="Tope por persona" aside={`${v.maxPrice} €`}>
        {({ inputId }) => <Range id={inputId} min={80} max={900} step={10} value={v.maxPrice} onChange={(e) => set("maxPrice", Number(e.target.value))} />}
      </Field>

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
        </div>
      </Fieldset>

      <Fieldset legend="Fuente de datos" variant="muted">
        <div className="flex flex-col gap-2 sm:flex-row">
          <RadioCard name="fuente" title="API de vuelos" description="Precios reales" checked={v.source === "api"} onChange={() => set("source", "api")} />
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
          <span className="shrink-0 rounded-full bg-surface px-3 py-2 text-xs font-semibold text-muted">Sin conectar</span>
        </div>
      </Fieldset>

      <Button type="submit" variant="primary" size="lg" block icon={<SearchIcon size={18} />}>
        Generar {count} propuestas
      </Button>
    </form>
  );
}
