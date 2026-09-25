import { useState } from "react";
import { Badge, Button, Heading, useToast } from "@wanderlot/ui";
import { PanelShell } from "../components/PanelShell.tsx";
import { ProposalRow, ProposalRowLoading } from "../components/ProposalRow.tsx";
import { DEFAULT_SEARCH, SearchForm, rangeSummary, type SearchValues } from "../components/SearchForm.tsx";
import { usePanel } from "../data/store.tsx";

const STOPS_LABEL = { direct: "solo directos", one: "máximo 1 escala", any: "con o sin escalas" };

export function GenerarPage() {
  const { state, now, startGeneration, stopGeneration, verify } = usePanel();
  const toast = useToast();
  const [search, setSearch] = useState<SearchValues>(DEFAULT_SEARCH);
  const { generation, proposals, plan } = state;
  const shown = proposals.slice(0, generation.shown);

  const onSubmit = (v: SearchValues) => {
    setSearch(v);
    startGeneration();
  };

  return (
    <PanelShell>
      <div className="flex flex-1 flex-col lg:flex-row">
        <div className="shrink-0 border-line-soft p-4 sm:p-7 lg:w-[500px] lg:border-r">
          <SearchForm onSubmit={onSubmit} count={generation.total} />
        </div>

        <section aria-labelledby="resultados" className="flex min-w-0 flex-1 flex-col gap-[18px] bg-canvas p-4 sm:p-7">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-col gap-[5px]">
              <Heading id="resultados" size="headline" className="sm:text-[28px]">
                Propuestas generadas
              </Heading>
              <span className="text-sm text-muted">
                {search.origin.split(" · ")[0]} · {rangeSummary(search)} · {search.people} personas · {STOPS_LABEL[search.stops]}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-muted tabular-nums" aria-live="polite">
                {generation.shown} / {generation.total}
              </span>
              {generation.running ? (
                <Button onClick={stopGeneration}>Detener</Button>
              ) : (
                <Badge tone={generation.shown === generation.total ? "accent" : "neutral"} size="md">
                  {generation.shown === generation.total ? "Búsqueda terminada" : "Búsqueda detenida"}
                </Badge>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2.5" aria-live="polite">
            {shown.map((p) => (
              <ProposalRow
                key={p.id}
                proposal={p}
                plan={plan}
                now={now}
                verifying={state.verifying.includes(p.id)}
                onVerify={() => verify(p.id).then(() => toast(`${p.place.city}: verificado con la API`))}
              />
            ))}
            {generation.running && <ProposalRowLoading />}
          </div>

          <p className="m-0 text-[13px] text-muted">
            Todo esto vive solo en tu máquina. El sitio no ve nada hasta que pulses <strong className="font-bold text-ink">Publicar</strong> en Revisar.
          </p>
        </section>
      </div>
    </PanelShell>
  );
}
