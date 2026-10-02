import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { addDaysIso, copy, type SuggestionView } from "@wanderlot/core";
import { Badge, Button, Heading, Notice, nightsBetween, useCopy, useToast } from "@wanderlot/ui";
import { IdeasCard } from "../components/IdeasCard.tsx";
import { JobCard } from "../components/JobCard.tsx";
import { PanelShell } from "../components/PanelShell.tsx";
import { GenerationProgress } from "../components/GenerationProgress.tsx";
import { ProposalRow } from "../components/ProposalRow.tsx";
import { SearchForm, originCode, rangeSummary, searchFromPlan, type SearchValues } from "../components/SearchForm.tsx";
import { usePanel, usePlan } from "../data/store.tsx";

const COPY = copy({
  es: {
    stops: { direct: "solo directos", one: "máximo 1 escala", any: "con o sin escalas" },
    researching: (place: string, name: string) => `Investigando ${place}, la idea de ${name}`,
    failed: (msg: string) => `No se pudo: ${msg}`,
    pickDates: "Elige en el calendario el día de salida y el de vuelta",
    writePlace: "Escribe adónde quieres ir",
    saveFailed: (msg: string) => `No se pudo guardar el plan: ${msg}`,
    settings: "Ajustes",
    review: "Revisar",
    needsKey: (settings: ReactNode, review: ReactNode) => (
      <>
        Para buscar desde aquí, el sitio necesita una clave de Claude (API de Anthropic) u OpenAI: mira en {settings} cómo añadirla. Mientras, busca desde el panel de tu ordenador, o añade un destino a mano en {review}.
      </>
    ),
    title: "Propuestas generadas",
    people: (n: number) => `${n} personas`,
    newOnes: (n: number): string => `${n} ${n === 1 ? "propuesta nueva" : "propuestas nuevas"}`,
    stopped: "Búsqueda detenida",
    finished: "Búsqueda terminada",
    couldNotSearch: "No se pudo buscar",
    cutAfter: (n: number): string => `La búsqueda se cortó tras ${n} ${n === 1 ? "propuesta" : "propuestas"}`,
    nothingFor: (idea: string) => `No se encontró nada para ${idea}.`,
    nothingNew: "La búsqueda terminó sin propuestas nuevas.",
    tryOther: "Prueba con otras fechas, más presupuesto o escalas.",
    noAi: (settings: ReactNode, review: ReactNode) => (
      <>
        No hay ninguna IA configurada en este ordenador. Mira en {settings} cómo añadir una, o añade destinos a mano en {review}.
      </>
    ),
    noWeb: (name: string) => `${name} no busca en la web: sus precios y horarios salen de lo que sabe y llegan al sitio como «Estimado por ${name}». Compruébalos antes de publicar.`,
    empty: (name: string) => `Todavía no hay propuestas para ${name}.`,
    emptyHosted: "Búscalas desde el panel de tu ordenador.",
    emptyLocal: "Ajusta la búsqueda y pulsa «Generar».",
    verified: (city: string) => `${city}: verificado con la API`,
    notVerified: "no se pudo verificar",
    onlyYou: (publish: ReactNode) => <>Solo tú ves esto: la cuadrilla no ve nada hasta que pulses {publish} en Revisar.</>,
    publish: "Publicar",
  },
  en: {
    stops: { direct: "direct only", one: "1 stop at most", any: "with or without stops" },
    researching: (place: string, name: string) => `Researching ${place}, ${name}'s idea`,
    failed: (msg: string) => `Couldn't do it: ${msg}`,
    pickDates: "Pick the departure and return days on the calendar",
    writePlace: "Write where you want to go",
    saveFailed: (msg: string) => `Couldn't save the plan: ${msg}`,
    settings: "Settings",
    review: "Review",
    needsKey: (settings: ReactNode, review: ReactNode) => (
      <>
        To search from here, the site needs a Claude (Anthropic API) or OpenAI key: see {settings} for how to add one. Meanwhile, search from the panel on your computer, or add a destination by hand in {review}.
      </>
    ),
    title: "Generated proposals",
    people: (n: number) => `${n} people`,
    newOnes: (n: number): string => `${n} ${n === 1 ? "new proposal" : "new proposals"}`,
    stopped: "Search stopped",
    finished: "Search finished",
    couldNotSearch: "Couldn't search",
    cutAfter: (n: number): string => `The search stopped after ${n} ${n === 1 ? "proposal" : "proposals"}`,
    nothingFor: (idea: string) => `Nothing found for ${idea}.`,
    nothingNew: "The search finished with no new proposals.",
    tryOther: "Try other dates, a bigger budget or stops.",
    noAi: (settings: ReactNode, review: ReactNode) => (
      <>
        There's no AI set up on this computer. See {settings} for how to add one, or add destinations by hand in {review}.
      </>
    ),
    noWeb: (name: string) => `${name} doesn't search the web: its prices and times come from what it knows and reach the site as "Estimated by ${name}". Check them before publishing.`,
    empty: (name: string) => `No proposals for ${name} yet.`,
    emptyHosted: "Search for them from the panel on your computer.",
    emptyLocal: "Adjust the search and press \"Generate\".",
    verified: (city: string) => `${city}: verified with the API`,
    notVerified: "couldn't verify",
    onlyYou: (publish: ReactNode) => <>Only you see this: the group sees nothing until you press {publish} in Review.</>,
    publish: "Publish",
  },
});

const COUNT = 12;

export function GenerarPage() {
  const t = useCopy(COPY);
  const { state, now, startGeneration, stopGeneration, verify, savePlan, suggestions, dismissSuggestion, clearJob } = usePanel();
  const plan = usePlan();
  const toast = useToast();
  const { generation, proposals, status } = state;
  const initial = searchFromPlan(plan, status?.flights !== "none");
  // A search running in the background (from the panel at /admin) counts
  // as running too: one at a time per trip.
  const job = state.job?.kind === "research" ? state.job : null;
  const running = (generation?.running ?? false) || job?.status === "running";
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
    toast(t.researching(idea.place, idea.member.name));
  };
  const dismiss = async (idea: SuggestionView) => {
    try {
      setIdeas(await dismissSuggestion(idea.id));
    } catch (e) {
      toast(t.failed((e as Error).message));
    }
  };

  const onSubmit = async (v: SearchValues) => {
    if (!v.start || !v.end) return toast(t.pickDates);
    if (v.scope === "place" && !v.place.trim()) return toast(t.writePlace);
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
      return toast(t.saveFailed((e as Error).message));
    }
    setStops(v.stops);
    // A specific destination is one proposal, researched by name.
    const place = v.scope === "place" ? v.place.trim() : "";
    startGeneration({
      source: v.source,
      scope: place ? { kind: "named", name: place } : v.scope === "europe" ? { kind: "europe" } : { kind: "anywhere" },
      stops: v.stops,
      estimateStays: v.estimateStays,
      suggestThings: v.suggestThings,
      nearbyAirports: v.nearbyAirports,
      count: place ? 1 : COUNT,
      ...(place ? { idea: place } : {}),
    });
  };

  return (
    <PanelShell>
      <div className="flex flex-1 flex-col lg:flex-row">
        <div className="shrink-0 border-line-soft p-4 sm:p-7 lg:w-[500px] lg:border-r">
          {status?.hosted && !status.ai?.background ? (
            <Notice tone="neutral">
              {t.needsKey(<Link to="/ajustes">{t.settings}</Link>, <Link to="/revisar">{t.review}</Link>)}
            </Notice>
          ) : (
            // Keyed so switching plans resets the form to the new plan.
            <SearchForm key={plan.id} initial={initial} onSubmit={onSubmit} count={COUNT} existing={proposals.length} running={running} flightsConnected={status?.flights !== "none"} {...(status?.ai ? { ai: status.ai } : {})} min={addDaysIso(now.toISOString().slice(0, 10), 1)} />
          )}
        </div>

        <section aria-labelledby="resultados" className="flex min-w-0 flex-1 flex-col gap-[18px] bg-canvas p-4 sm:p-7">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-col gap-[5px]">
              <Heading id="resultados" size="headline" className="sm:text-[28px]">
                {t.title}
              </Heading>
              <span className="text-sm text-muted">
                {plan.name} · {rangeSummary(initial)} · {t.people(plan.partySize)} · {t.stops[stops]}
              </span>
            </div>
            {generation && !running && !generation.error && (
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-muted tabular-nums">
                  {t.newOnes(generation.received)}
                </span>
                <Badge tone={generation.stopped ? "neutral" : "accent"} size="md">
                  {generation.stopped ? t.stopped : t.finished}
                </Badge>
              </div>
            )}
          </div>

          {generation && running && <GenerationProgress generation={generation} onStop={stopGeneration} aiName={status?.ai?.name ?? "Claude"} />}

          {job && <JobCard job={job} onClear={() => void clearJob().catch((e: Error) => toast(t.failed(e.message)))} />}

          <IdeasCard ideas={ideas} now={now} busy={running} onResearch={research} onDismiss={(i) => void dismiss(i)} />

          {generation?.error && (
            <Notice role="alert">
              {generation.received === 0 ? t.couldNotSearch : t.cutAfter(generation.received)}: {generation.error}
            </Notice>
          )}
          {generation && !running && !generation.error && !generation.stopped && generation.received === 0 && (
            <Notice tone="neutral">
              {generation.idea ? t.nothingFor(generation.idea) : t.nothingNew} {t.tryOther}
            </Notice>
          )}
          {status?.research === "none" && !status.hosted && (
            <Notice tone="neutral">
              {t.noAi(<Link to="/ajustes">{t.settings}</Link>, <Link to="/revisar">{t.review}</Link>)}
            </Notice>
          )}
          {status?.ai?.search === false && !status.hosted && (
            <Notice tone="neutral">
              {t.noWeb(status.ai.name)}
            </Notice>
          )}

          <div className="flex flex-col gap-2.5" aria-live="polite">
            {proposals.length === 0 && !running && (
              <p className="m-0 rounded-2xl border border-dashed border-line px-6 py-10 text-center text-sm text-muted">
                {t.empty(plan.name)} {status?.hosted ? t.emptyHosted : t.emptyLocal}
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
                  verify(p.id).then((r) => toast(r.verified ? t.verified(p.place.city) : `${p.place.city}: ${r.reason ?? t.notVerified}`))
                }
              />
            ))}
          </div>

          <p className="m-0 text-[13px] text-muted">
            {t.onlyYou(<strong className="font-bold text-ink">{t.publish}</strong>)}
          </p>
        </section>
      </div>
    </PanelShell>
  );
}
