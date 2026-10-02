import { Link } from "react-router";
import { copy } from "@wanderlot/core";
import { ChoiceChip, Fieldset, useCopy } from "@wanderlot/ui";
import type { Person } from "../data/store.tsx";

const COPY = copy({
  es: {
    whoGoes: "¿Quién va?",
    people: (n: number) => `${n} ${n === 1 ? "persona" : "personas"}`,
    nobody: "Todavía no hay nadie en el grupo.",
    addPeople: "Añade a la gente en Personas",
    onlyThem: "Solo quien va ve el viaje en el sitio, vota y comenta. Puedes cambiarlo luego en Personas.",
  },
  en: {
    whoGoes: "Who's going?",
    people: (n: number) => `${n} ${n === 1 ? "person" : "people"}`,
    nobody: "There's nobody in the group yet.",
    addPeople: "Add people in People",
    onlyThem: "Only those going see the trip on the site, vote and comment. You can change it later in People.",
  },
});

export interface WhoGoesProps {
  people: Person[];
  value: string[];
  onChange: (ids: string[]) => void;
  legend?: string;
}

// Who is on a trip: only they see it on the site, vote and comment (SPEC §5).
export function WhoGoes({ people, value, onChange, legend: given }: WhoGoesProps) {
  const t = useCopy(COPY);
  const legend = given ?? t.whoGoes;
  const toggle = (id: string, on: boolean) => onChange(on ? [...value, id] : value.filter((x) => x !== id));
  return (
    <Fieldset
      legend={
        <span className="flex items-center justify-between gap-3">
          {legend}
          <span className="font-semibold text-accent-strong tabular-nums">
            {t.people(value.length)}
          </span>
        </span>
      }
    >
      {people.length === 0 ? (
        <p className="m-0 text-sm text-muted">
          {t.nobody} <Link to="/personas">{t.addPeople}</Link>.
        </p>
      ) : (
        <div role="group" aria-label={legend} className="flex flex-wrap gap-2">
          {people.map((p) => (
            <ChoiceChip key={p.id} type="checkbox" label={p.name} checked={value.includes(p.id)} onChange={(e) => toggle(p.id, e.target.checked)} />
          ))}
        </div>
      )}
      <p className="m-0 text-[13px] text-muted">{t.onlyThem}</p>
    </Fieldset>
  );
}
