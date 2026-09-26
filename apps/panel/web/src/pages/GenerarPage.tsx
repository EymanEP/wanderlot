import { useEffect, useState } from "react";
import { addDaysIso, type SuggestionView } from "@wanderlot/core";
import { Badge, Button, Heading, Notice, nightsBetween, useToast } from "@wanderlot/ui";
import { IdeasCard } from "../components/IdeasCard.tsx";
import { PanelShell } from "../components/PanelShell.tsx";
import { GenerationProgress } from "../components/GenerationProgress.tsx";
import { ProposalRow } from "../components/ProposalRow.tsx";
import { SearchForm, originCode, rangeSummary, searchFromPlan, type SearchValues } from "../components/SearchForm.tsx";
import { usePanel, usePlan } from "../data/store.tsx";

const STOPS_LABEL = { direct: "solo directos", one: "máximo 1 escala", any: "con o sin escalas" };
const COUNT = 12;

export function GenerarPage() {
  const { state, now, startGeneration, stopGeneration, verify, savePlan, suggestions, dismissSuggestion } = usePanel();
  const plan = usePlan();
  const toast = useToast();
  const { generation, proposals, status } = state;
  const initial = searchFromPlan(plan, status?.flights !== "none");
  const running = generation?.running ?? false;
  const [stops, setStops] = useState<SearchValues["stops"]>(initial.stops);

  // Friends' ideas from the site: reloaded when a search ends, since
  // researching one marks it done.
  const [ideas, setIdeas] = useState<SuggestionView[]>([]);
  useEffect(() => {
    if (running) return;
    let live = true;
    suggestions().then(
      (list) => live && setIdeas(list),
      () => live && setIdeas([]),
    );
    return () => {
      live = false;
    };
    // Not on `suggestions` itself: it's a new function on every panel change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan.id, running]);

  const research = (idea: SuggestionView) => {
    startGeneration({
      source: "claude",
      scope: { kind: "anywhere" },
      stops: "any",
      estimateStays: true,
      suggestThings: true,
      nearbyAirports: false,
      count: 1,
      suggestionId: idea.id,
      idea: idea.place,
    });
    toast(`Investigando ${idea.place}, la idea de ${idea.member.name}`);
  };
  const dismiss = async (idea: SuggestionView) => {
    try {
      setIdeas(await dismissSuggestion(idea.id));
    } catch (e) {
      toast(`No se pudo: ${(e as Error).message}`);
    }
  };

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
        maxPriceCents: v.maxPrice === null ? null : v.maxPrice * 100,
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
      nearbyAirports: v.nearbyAirports,
      count: COUNT,
    });
  };

  return (
    <PanelShell>
      <div className="flex flex-1 flex-col lg:flex-row">
        <div className="shrink-0 border-line-soft p-4 sm:p-7 lg:w-[500px] lg:border-r">
          {/* Keyed so switching plans resets the form to the new plan. */}
          <SearchForm key={plan.id} initial={initial} onSubmit={onSubmit} count={COUNT} existing={proposals.length} running={running} flightsConnected={status?.flights !== "none"} min={addDaysIso(now.toISOString().slice(0, 10), 1)} />
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
            {generation && !running && !generation.error && (
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-muted tabular-nums">
                  {generation.received} {generation.received === 1 ? "propuesta nueva" : "propuestas nuevas"}
                </span>
                <Badge tone={generation.stopped ? "neutral" : "accent"} size="md">
                  {generation.stopped ? "Búsqueda detenida" : "Búsqueda terminada"}
                </Badge>
              </div>
            )}
          </div>

          {generation && running && <GenerationProgress generation={generation} onStop={stopGeneration} />}

          <IdeasCard ideas={ideas} now={now} busy={running} onResearch={research} onDismiss={(i) => void dismiss(i)} />

          {generation?.error && (
            <Notice role="alert">
              {generation.received === 0 ? "No se pudo buscar" : `La búsqueda se cortó tras ${generation.received} ${generation.received === 1 ? "propuesta" : "propuestas"}`}: {generation.error}
            </Notice>
          )}
          {generation && !running && !generation.error && !generation.stopped && generation.received === 0 && (
            <Notice tone="neutral">
              {generation.idea ? `No se encontró nada para ${generation.idea}.` : "La búsqueda terminó sin propuestas nuevas."} Prueba con otras fechas, más presupuesto o escalas.
            </Notice>
          )}
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
          </div>

          <p className="m-0 text-[13px] text-muted">
            Todo esto vive solo en tu máquina. El sitio no ve nada hasta que pulses <strong className="font-bold text-ink">Publicar</strong> en Revisar.
          </p>
        </section>
      </div>
    </PanelShell>
  );
}
