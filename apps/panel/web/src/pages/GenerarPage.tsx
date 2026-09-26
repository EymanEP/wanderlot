import { useState } from "react";
import { addDaysIso } from "@wanderlot/core";
import { Badge, Button, Heading, Notice, nightsBetween, useToast } from "@wanderlot/ui";
import { PanelShell } from "../components/PanelShell.tsx";
import { ProposalRow, ProposalRowLoading } from "../components/ProposalRow.tsx";
import { SearchForm, originCode, rangeSummary, searchFromPlan, type SearchValues } from "../components/SearchForm.tsx";
import { usePanel, usePlan } from "../data/store.tsx";

const STOPS_LABEL = { direct: "solo directos", one: "máximo 1 escala", any: "con o sin escalas" };
const COUNT = 12;

export function GenerarPage() {
  const { state, now, startGeneration, stopGeneration, verify, savePlan } = usePanel();
  const plan = usePlan();
  const toast = useToast();
  const { generation, proposals, status } = state;
  const initial = searchFromPlan(plan);
  const running = generation?.running ?? false;
  const [stops, setStops] = useState<SearchValues["stops"]>(initial.stops);

  const onSubmit = async (v: SearchValues) => {
    if (!v.start || !v.end) return toast("Elige en el calendario el día de salida y el de vuelta");
    // Dates, people, budget and origin belong to the plan: save them first.
    try {
      await savePlan({
        ...plan,
        origin: originCode(v.origin, plan.origin),
        dateFrom: v.start,
        dateTo: v.end,
        nights: nightsBetween(v.start, v.end),
        flexDays: v.flexDays,
        partySize: v.people,
        maxPriceCents: v.maxPrice * 100,
      });
    } catch (e) {
      return toast(`No se pudo guardar el plan: ${(e as Error).message}`);
    }
    setStops(v.stops);
    startGeneration({
      source: v.source,
      scope: v.scope === "place" ? { kind: "place", iata: originCode(v.place, "XXX") } : v.scope === "europe" ? { kind: "europe" } : { kind: "anywhere" },
      stops: v.stops,
      estimateStays: v.estimateStays,
      suggestThings: v.suggestThings,
      count: COUNT,
    });
  };

  return (
    <PanelShell>
      <div className="flex flex-1 flex-col lg:flex-row">
        <div className="shrink-0 border-line-soft p-4 sm:p-7 lg:w-[500px] lg:border-r">
          {/* Keyed so switching plans resets the form to the new plan. */}
          <SearchForm key={plan.id} initial={initial} onSubmit={onSubmit} count={COUNT} running={running} flightsConnected={status?.flights !== "none"} min={addDaysIso(now.toISOString().slice(0, 10), 1)} />
        </div>

        <section aria-labelledby="resultados" className="flex min-w-0 flex-1 flex-col gap-[18px] bg-canvas p-4 sm:p-7">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-col gap-[5px]">
              <Heading id="resultados" size="headline" className="sm:text-[28px]">
                Propuestas generadas
              </Heading>
              <span className="text-sm text-muted">
                {plan.name} · {rangeSummary(initial)} · {plan.partySize} personas · {STOPS_LABEL[stops]}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {generation && (
                <span className="text-sm font-bold text-muted tabular-nums" aria-live="polite">
                  {generation.running || generation.stopped ? `${generation.received} / ${generation.requested}` : `${generation.received} propuestas`}
                </span>
              )}
              {running ? (
                <Button onClick={stopGeneration}>Detener</Button>
              ) : generation && !generation.error ? (
                <Badge tone={generation.stopped ? "neutral" : "accent"} size="md">
                  {generation.stopped ? "Búsqueda detenida" : "Búsqueda terminada"}
                </Badge>
              ) : null}
            </div>
          </div>

          {generation?.error && <Notice>La búsqueda se cortó: {generation.error}</Notice>}
          {status?.research === "none" && (
            <Notice tone="neutral">
              No encuentro el comando <code>claude</code> ni una clave de Anthropic en este ordenador. Ejecuta <code>npm run setup</code> para configurarlo.
            </Notice>
          )}

          <div className="flex flex-col gap-2.5" aria-live="polite">
            {proposals.length === 0 && !running && (
              <p className="m-0 rounded-2xl border border-dashed border-line px-6 py-10 text-center text-sm text-muted">
                Todavía no hay propuestas para {plan.name}. Ajusta la búsqueda y pulsa «Generar».
              </p>
            )}
            {proposals.map((p) => (
              <ProposalRow
                key={p.id}
                proposal={p}
                plan={plan}
                now={now}
                verifying={state.verifying.includes(p.id)}
                canVerify={status?.flights !== "none"}
                onVerify={() =>
                  verify(p.id).then((r) => toast(r.verified ? `${p.place.city}: verificado con la API` : `${p.place.city}: ${r.reason ?? "no se pudo verificar"}`))
                }
              />
            ))}
            {running && <ProposalRowLoading />}
          </div>

          <p className="m-0 text-[13px] text-muted">
            Todo esto vive solo en tu máquina. El sitio no ve nada hasta que pulses <strong className="font-bold text-ink">Publicar</strong> en Revisar.
          </p>
        </section>
      </div>
    </PanelShell>
  );
}
