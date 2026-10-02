import { useEffect, useState } from "react";
import { copy } from "@wanderlot/core";
import { Button, Card, GlobeIcon, Heading, SearchIcon, cn, useCopy } from "@wanderlot/ui";
import type { SearchStep } from "../data/backend.ts";
import type { GenerationState } from "../data/store.tsx";

const COPY = copy({
  es: {
    searching: (q: string) => `Buscando «${q}»`,
    reading: (host: string) => `Leyendo ${host}`,
    researching: (idea: string) => `Investigando ${idea}`,
    aiSearching: (ai: string) => `${ai} está buscando destinos`,
    api: "Consultando la API de vuelos",
    inProgress: "Búsqueda en curso",
    slow: "Suele tardar entre 2 y 10 minutos. Las propuestas llegan al final; puedes dejar esta página abierta.",
    fast: "Unos segundos.",
    elapsed: "Tiempo buscando",
    stop: "Detener",
    starting: "Empezando…",
    counts: (searches: number, pages: number, received: number): string =>
      `${searches} ${searches === 1 ? "búsqueda" : "búsquedas"} · ${pages} ${pages === 1 ? "página leída" : "páginas leídas"} · ${received} ${received === 1 ? "propuesta" : "propuestas"}`,
    earlier: "Pasos anteriores",
  },
  en: {
    searching: (q: string) => `Searching "${q}"`,
    reading: (host: string) => `Reading ${host}`,
    researching: (idea: string) => `Researching ${idea}`,
    aiSearching: (ai: string) => `${ai} is looking for destinations`,
    api: "Checking the flight API",
    inProgress: "Search in progress",
    slow: "It usually takes 2 to 10 minutes. The proposals arrive at the end; you can leave this page open.",
    fast: "A few seconds.",
    elapsed: "Time searching",
    stop: "Stop",
    starting: "Starting…",
    counts: (searches: number, pages: number, received: number): string =>
      `${searches} ${searches === 1 ? "search" : "searches"} · ${pages} ${pages === 1 ? "page read" : "pages read"} · ${received} ${received === 1 ? "proposal" : "proposals"}`,
    earlier: "Earlier steps",
  },
});

// "0:07", "4:32"
function clock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function stepText(t: (typeof COPY)["es"], step: SearchStep): string {
  if (step.kind === "search") return t.searching(step.query);
  if (step.kind === "read") return t.reading(step.host);
  return step.text;
}

export interface GenerationProgressProps {
  generation: GenerationState;
  onStop: () => void;
  // Which AI is researching: "Claude", "OpenAI".
  aiName?: string;
}

// While a search runs: how long it's been, what research is doing right now,
// and what it has looked at. A Claude search takes minutes and its proposals
// arrive at the end, so this is what the organiser watches meanwhile.
export function GenerationProgress({ generation: g, onStop, aiName = "Claude" }: GenerationProgressProps) {
  const t = useCopy(COPY);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const searches = g.steps.filter((s) => s.kind === "search").length;
  const pages = g.steps.filter((s) => s.kind === "read").length;
  const current = g.steps.at(-1);
  const recent = g.steps.slice(-7, -1).reverse();
  // Claude researching takes minutes, with steps; a flight API, seconds.
  const source = g.source;
  const title = g.idea ? t.researching(g.idea) : source === "claude" ? t.aiSearching(aiName) : t.api;

  return (
    <Card as="section" variant="raised" aria-label={t.inProgress} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="relative flex size-3">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-60" />
            <span className="relative inline-flex size-3 rounded-full bg-accent" />
          </span>
          <div className="flex flex-col">
            <Heading as="h2" size="subheading">
              {title}
            </Heading>
            <span className="text-sm text-muted">
              {source === "claude" ? t.slow : t.fast}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold tabular-nums" aria-label={t.elapsed}>
            {clock(now - g.startedAt)}
          </span>
          <Button onClick={onStop}>{t.stop}</Button>
        </div>
      </div>

      <p className="m-0 rounded-xl bg-accent-soft px-4 py-3 text-[15px] text-accent-strong" aria-live="polite">
        {current ? stepText(t, current) : t.starting}
      </p>

      {(searches > 0 || pages > 0 || g.received > 0) && (
        <p className="m-0 text-sm text-muted tabular-nums">
          {t.counts(searches, pages, g.received)}
        </p>
      )}

      {recent.length > 0 && (
        <ul aria-label={t.earlier} className="m-0 flex list-none flex-col gap-1.5 p-0 text-[13px] text-muted">
          {recent.map((s, i) => (
            <li key={`${g.steps.length}-${i}`} className={cn("flex min-w-0 items-center gap-2", i > 2 && "opacity-70")}>
              {s.kind === "read" ? <GlobeIcon size={14} /> : s.kind === "search" ? <SearchIcon size={14} /> : <span className="w-3.5" />}
              <span className="truncate">{stepText(t, s)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
