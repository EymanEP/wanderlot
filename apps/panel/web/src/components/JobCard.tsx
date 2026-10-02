import { useEffect, useState } from "react";
import { Link } from "react-router";
import { copy } from "@wanderlot/core";
import { Button, Card, Heading, Notice, buttonClasses, useCopy } from "@wanderlot/ui";
import type { PanelJob } from "../data/backend.ts";

const COPY = copy({
  es: {
    ideaOf: (by: string) => `la idea de ${by}`,
    destinations: "destinos",
    guide: "la guía del viaje",
    failed: (what: string, ai: string, error: string) => `La búsqueda de ${what} con ${ai} no terminó: ${error}`,
    gotIt: "Entendido",
    added: (n: number): string => `${n} ${n === 1 ? "propuesta nueva" : "propuestas nuevas"}`,
    nothing: "nada nuevo",
    guideReady: "la guía está lista",
    finished: "Búsqueda terminada",
    done: (ai: string, what: string) => `${ai} terminó de buscar ${what}: `,
    review: "Revisar",
    close: "Cerrar",
    background: "Búsqueda en segundo plano",
    searching: (ai: string, what: string) => `${ai} está buscando ${what}`,
    justStarted: "Acaba de empezar",
    elapsed: (n: number) => `Lleva ${n} min`,
    cancel: "Cancelar",
    canClose: "Se hace en segundo plano: puedes cerrar esta página. Lo que encuentre aparecerá aquí y en el panel de tu ordenador.",
    slowClaude: " Con Claude suele tardar unos minutos, y a veces hasta una hora.",
    slow: " Suele tardar unos minutos.",
  },
  en: {
    ideaOf: (by: string) => `${by}'s idea`,
    destinations: "destinations",
    guide: "the trip guide",
    failed: (what: string, ai: string, error: string) => `The search for ${what} with ${ai} didn't finish: ${error}`,
    gotIt: "Got it",
    added: (n: number): string => `${n} ${n === 1 ? "new proposal" : "new proposals"}`,
    nothing: "nothing new",
    guideReady: "the guide is ready",
    finished: "Search finished",
    done: (ai: string, what: string) => `${ai} finished searching for ${what}: `,
    review: "Review",
    close: "Close",
    background: "Background search",
    searching: (ai: string, what: string) => `${ai} is searching for ${what}`,
    justStarted: "Just started",
    elapsed: (n: number) => `Running for ${n} min`,
    cancel: "Cancel",
    canClose: "It runs in the background: you can close this page. Whatever it finds will show up here and in the panel on your computer.",
    slowClaude: " With Claude it usually takes a few minutes, sometimes up to an hour.",
    slow: " It usually takes a few minutes.",
  },
});

export interface JobCardProps {
  job: PanelJob;
  // Cancels it while it runs; clears it once it ended.
  onClear: () => void;
}

const minutes = (ms: number) => Math.max(0, Math.floor(ms / 60_000));

// A search or guide running in the background (ROADMAP 3.3): started from
// the panel at /admin, followed from any device.
export function JobCard({ job, onClear }: JobCardProps) {
  const t = useCopy(COPY);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (job.status !== "running") return;
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, [job.status]);

  const what = job.kind === "research" ? (job.idea ? t.ideaOf(job.idea.by) : t.destinations) : t.guide;

  if (job.status === "failed") {
    return (
      <Notice role="alert">
        <span className="flex flex-wrap items-center justify-between gap-3">
          <span>{t.failed(what, job.aiName, job.error ?? "error")}</span>
          <Button size="sm" onClick={onClear}>
            {t.gotIt}
          </Button>
        </span>
      </Notice>
    );
  }

  if (job.status === "done") {
    const found = job.kind === "research" ? (job.added ? t.added(job.added) : t.nothing) : t.guideReady;
    return (
      <Card as="section" variant="raised" aria-label={t.finished} className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm">
          {t.done(job.aiName, what)}<strong>{found}</strong>.
        </span>
        <span className="flex items-center gap-2">
          {job.kind === "research" && !!job.added && (
            <Link to="/revisar" className={buttonClasses({ variant: "secondary", size: "sm" })}>
              {t.review}
            </Link>
          )}
          <Button size="sm" variant="ghost" onClick={onClear}>
            {t.close}
          </Button>
        </span>
      </Card>
    );
  }

  const elapsed = minutes(now - Date.parse(job.startedAt));
  return (
    <Card as="section" variant="raised" aria-label={t.background} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="relative flex size-3">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-60" />
            <span className="relative inline-flex size-3 rounded-full bg-accent" />
          </span>
          <div className="flex flex-col">
            <Heading as="h2" size="subheading">
              {t.searching(job.aiName, what)}
            </Heading>
            <span className="text-sm text-muted">{elapsed < 1 ? t.justStarted : t.elapsed(elapsed)}</span>
          </div>
        </div>
        <Button size="sm" onClick={onClear}>
          {t.cancel}
        </Button>
      </div>
      <span className="text-sm text-ink-2">
        {t.canClose}
        {job.ai === "anthropic-api" ? t.slowClaude : t.slow}
      </span>
    </Card>
  );
}
