import { useState } from "react";
import type { Plan, Proposal } from "@wanderlot/core";
import { copy, euros, flightPriceCents, tripLabel } from "@wanderlot/core";
import type { Editorial } from "@wanderlot/mocks";
import { Button, Card, Checkbox, DataList, DataRow, Field, Heading, IataTile, ProsCons, TextArea, useCopy } from "@wanderlot/ui";
import { CATEGORY_LABEL, accessLabel, total } from "../lib/view.ts";
import { DatesChip } from "./DatesChip.tsx";

const COPY = copy({
  es: {
    flight: "Vuelo i/v",
    nights: (n: number) => `${n} noches`,
    total: "Total / persona",
    trip: "Trayecto",
    pros: "A favor · una por línea",
    cons: "En contra · una por línea",
    cancel: "Cancelar",
    save: "Guardar",
    rewrite: "Reescribir pros y contras",
    inVote: "Entra en la votación",
  },
  en: {
    flight: "Return flight",
    nights: (n: number) => `${n} nights`,
    total: "Total / person",
    trip: "Journey",
    pros: "For · one per line",
    cons: "Against · one per line",
    cancel: "Cancel",
    save: "Save",
    rewrite: "Rewrite pros and cons",
    inVote: "Goes into the vote",
  },
});

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
  const t = useCopy(COPY);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ pros: "", cons: "" });
  const sum = total(p, plan);
  const access = p.access?.cents ?? 0;
  const stay = sum - flightPriceCents(p) - access;

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
          <DatesChip proposal={p} className="mt-1 w-fit" />
        </div>
      </div>

      <DataList>
        <DataRow label={t.flight} value={euros(flightPriceCents(p))} />
        <DataRow label={t.nights(plan.nights)} value={euros(stay)} />
        {p.access && <DataRow label={`${accessLabel()} · ${p.outbound.from}`} value={`${p.access.checked ? "" : "≈ "}${euros(access)}`} />}
        <DataRow variant={e.inVote ? "highlight" : "highlight-muted"} label={t.total} value={euros(sum)} />
        <DataRow label={t.trip} value={tripLabel(p.outbound)} />
        <DataRow label={monthLabel} value={e.weather} />
      </DataList>

      {editing ? (
        <div className="flex flex-col gap-3">
          <Field label={t.pros}>
            {({ inputId }) => <TextArea id={inputId} rows={4} value={draft.pros} onChange={(ev) => setDraft({ ...draft, pros: ev.target.value })} />}
          </Field>
          <Field label={t.cons}>
            {({ inputId }) => <TextArea id={inputId} rows={3} value={draft.cons} onChange={(ev) => setDraft({ ...draft, cons: ev.target.value })} />}
          </Field>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setEditing(false)}>
              {t.cancel}
            </Button>
            <Button size="sm" variant="primary" onClick={save}>
              {t.save}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <ProsCons pros={e.pros} cons={e.cons} />
          <button type="button" onClick={startEditing} className="w-fit cursor-pointer border-0 bg-transparent p-0 text-[13px] font-semibold text-accent hover:text-accent-hover">
            {t.rewrite}
          </button>
        </>
      )}

      <Checkbox variant="box" className="mt-auto" label={t.inVote} checked={e.inVote} onChange={(ev) => onChange({ inVote: ev.target.checked })} />
    </Card>
  );
}
