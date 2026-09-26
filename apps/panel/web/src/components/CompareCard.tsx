import { useState } from "react";
import type { Plan, Proposal } from "@wanderlot/core";
import { euros, flightPriceCents, tripLabel } from "@wanderlot/core";
import type { Editorial } from "@wanderlot/mocks";
import { Button, Card, Checkbox, DataList, DataRow, Field, Heading, IataTile, ProsCons, TextArea } from "@wanderlot/ui";
import { CATEGORY_LABEL, total } from "../lib/view.ts";

export interface CompareCardProps {
  proposal: Proposal;
  plan: Plan;
  editorial: Editorial;
  monthLabel: string; // "Noviembre"
  onChange: (patch: Partial<Editorial>) => void;
}

const lines = (text: string) => text.split("\n").map((l) => l.trim()).filter(Boolean);

// One approved destination in Comparativa. Pros and cons are Claude's drafts;
// "Editar" lets the organiser rewrite them before anything is published.
export function CompareCard({ proposal: p, plan, editorial: e, monthLabel, onChange }: CompareCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ pros: "", cons: "" });
  const t = total(p, plan);
  const stay = t - flightPriceCents(p);

  const startEditing = () => {
    setDraft({ pros: e.pros.join("\n"), cons: e.cons.join("\n") });
    setEditing(true);
  };
  const save = () => {
    onChange({ pros: lines(draft.pros), cons: lines(draft.cons) });
    setEditing(false);
  };

  return (
    <Card as="article" variant="raised" radius="card" aria-label={p.place.city} className="flex flex-col gap-3.5">
      <div className="flex items-center gap-3">
        <IataTile code={p.place.iata} size="sm" />
        <div className="flex min-w-0 flex-col gap-0.5">
          <Heading as="h2" size="subheading" className="text-xl">
            {p.place.city}
          </Heading>
          <span className="text-xs text-muted">
            {p.place.country} · {CATEGORY_LABEL[p.category]}
          </span>
        </div>
      </div>

      <DataList>
        <DataRow label="Vuelo i/v" value={euros(flightPriceCents(p))} />
        <DataRow label={`${plan.nights} noches`} value={euros(stay)} />
        <DataRow variant={e.inVote ? "highlight" : "highlight-muted"} label="Total / persona" value={euros(t)} />
        <DataRow label="Trayecto" value={tripLabel(p.outbound)} />
        <DataRow label={monthLabel} value={e.weather} />
      </DataList>

      {editing ? (
        <div className="flex flex-col gap-3">
          <Field label="A favor · una por línea">
            {({ inputId }) => <TextArea id={inputId} rows={4} value={draft.pros} onChange={(ev) => setDraft({ ...draft, pros: ev.target.value })} />}
          </Field>
          <Field label="En contra · una por línea">
            {({ inputId }) => <TextArea id={inputId} rows={3} value={draft.cons} onChange={(ev) => setDraft({ ...draft, cons: ev.target.value })} />}
          </Field>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setEditing(false)}>
              Cancelar
            </Button>
            <Button size="sm" variant="primary" onClick={save}>
              Guardar
            </Button>
          </div>
        </div>
      ) : (
        <>
          <ProsCons pros={e.pros} cons={e.cons} />
          <button type="button" onClick={startEditing} className="w-fit cursor-pointer border-0 bg-transparent p-0 text-[13px] font-semibold text-accent hover:text-accent-hover">
            Reescribir pros y contras
          </button>
        </>
      )}

      <Checkbox variant="box" className="mt-auto" label="Entra en la votación" checked={e.inVote} onChange={(ev) => onChange({ inVote: ev.target.checked })} />
    </Card>
  );
}
