import { useEffect, useState } from "react";
import { Button, Card, GlobeIcon, Heading, SearchIcon, cn } from "@wanderlot/ui";
import type { SearchStep } from "../data/backend.ts";
import type { GenerationState } from "../data/store.tsx";

// "0:07", "4:32"
function clock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function stepText(step: SearchStep): string {
  if (step.kind === "search") return `Buscando «${step.query}»`;
  if (step.kind === "read") return `Leyendo ${step.host}`;
  return step.text;
}

export interface GenerationProgressProps {
  generation: GenerationState;
  onStop: () => void;
}

// While a search runs: how long it's been, what research is doing right now,
// and what it has looked at. A Claude search takes minutes and its proposals
// arrive at the end, so this is what the organiser watches meanwhile.
export function GenerationProgress({ generation: g, onStop }: GenerationProgressProps) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const searches = g.steps.filter((s) => s.kind === "search").length;
  const pages = g.steps.filter((s) => s.kind === "read").length;
  const current = g.steps.at(-1);
  const recent = g.steps.slice(-7, -1).reverse();
  // Claude researching takes minutes, with steps; a flight API, seconds.
  const source = g.source;
  const title = g.idea ? `Investigando ${g.idea}` : source === "claude" ? "Claude está buscando destinos" : "Consultando la API de vuelos";

  return (
    <Card as="section" variant="raised" aria-label="Búsqueda en curso" className="flex flex-col gap-4">
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
              {source === "claude"
                ? "Suele tardar entre 2 y 10 minutos. Las propuestas llegan al final; puedes dejar esta página abierta."
                : "Unos segundos."}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold tabular-nums" aria-label="Tiempo buscando">
            {clock(now - g.startedAt)}
          </span>
          <Button onClick={onStop}>Detener</Button>
        </div>
      </div>

      <p className="m-0 rounded-xl bg-accent-soft px-4 py-3 text-[15px] text-accent-strong" aria-live="polite">
        {current ? stepText(current) : "Empezando…"}
      </p>

      {(searches > 0 || pages > 0 || g.received > 0) && (
        <p className="m-0 text-sm text-muted tabular-nums">
          {searches} {searches === 1 ? "búsqueda" : "búsquedas"} · {pages} {pages === 1 ? "página leída" : "páginas leídas"} · {g.received}{" "}
          {g.received === 1 ? "propuesta" : "propuestas"}
        </p>
      )}

      {recent.length > 0 && (
        <ul aria-label="Pasos anteriores" className="m-0 flex list-none flex-col gap-1.5 p-0 text-[13px] text-muted">
          {recent.map((s, i) => (
            <li key={`${g.steps.length}-${i}`} className={cn("flex min-w-0 items-center gap-2", i > 2 && "opacity-70")}>
              {s.kind === "read" ? <GlobeIcon size={14} /> : s.kind === "search" ? <SearchIcon size={14} /> : <span className="w-3.5" />}
              <span className="truncate">{stepText(s)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
