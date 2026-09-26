import { Link } from "react-router";
import { ChoiceChip, Fieldset } from "@wanderlot/ui";
import type { Person } from "../data/store.tsx";

export interface WhoGoesProps {
  people: Person[];
  value: string[];
  onChange: (ids: string[]) => void;
  legend?: string;
}

// Who is on a trip: only they see it on the site, vote and comment (SPEC §5).
export function WhoGoes({ people, value, onChange, legend = "¿Quién va?" }: WhoGoesProps) {
  const toggle = (id: string, on: boolean) => onChange(on ? [...value, id] : value.filter((x) => x !== id));
  return (
    <Fieldset
      legend={
        <span className="flex items-center justify-between gap-3">
          {legend}
          <span className="font-semibold text-accent-strong tabular-nums">
            {value.length} {value.length === 1 ? "persona" : "personas"}
          </span>
        </span>
      }
    >
      {people.length === 0 ? (
        <p className="m-0 text-sm text-muted">
          Todavía no hay nadie en el grupo. <Link to="/personas">Añade a la gente en Personas</Link>.
        </p>
      ) : (
        <div role="group" aria-label={legend} className="flex flex-wrap gap-2">
          {people.map((p) => (
            <ChoiceChip key={p.id} type="checkbox" label={p.name} checked={value.includes(p.id)} onChange={(e) => toggle(p.id, e.target.checked)} />
          ))}
        </div>
      )}
      <p className="m-0 text-[13px] text-muted">Solo quien va ve el viaje en el sitio, vota y comenta. Puedes cambiarlo luego en Personas.</p>
    </Fieldset>
  );
}
