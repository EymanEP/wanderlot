import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Button, Card, Heading, Notice, buttonClasses } from "@wanderlot/ui";
import type { PanelJob } from "../data/backend.ts";

export interface JobCardProps {
  job: PanelJob;
  // Cancels it while it runs; clears it once it ended.
  onClear: () => void;
}

const minutes = (ms: number) => Math.max(0, Math.floor(ms / 60_000));

// A search or guide running in the background (ROADMAP 3.3): started from
// the panel at /admin, followed from any device.
export function JobCard({ job, onClear }: JobCardProps) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (job.status !== "running") return;
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, [job.status]);

  const what = job.kind === "research" ? (job.idea ? `la idea de ${job.idea.by}` : "destinos") : "la guía del viaje";

  if (job.status === "failed") {
    return (
      <Notice role="alert">
        <span className="flex flex-wrap items-center justify-between gap-3">
          <span>
            La búsqueda de {what} con {job.aiName} no terminó: {job.error ?? "error"}
          </span>
          <Button size="sm" onClick={onClear}>
            Entendido
          </Button>
        </span>
      </Notice>
    );
  }

  if (job.status === "done") {
    const found = job.kind === "research" ? (job.added ? `${job.added} ${job.added === 1 ? "propuesta nueva" : "propuestas nuevas"}` : "nada nuevo") : "la guía está lista";
    return (
      <Card as="section" variant="raised" aria-label="Búsqueda terminada" className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm">
          {job.aiName} terminó de buscar {what}: <strong>{found}</strong>.
        </span>
        <span className="flex items-center gap-2">
          {job.kind === "research" && !!job.added && (
            <Link to="/revisar" className={buttonClasses({ variant: "secondary", size: "sm" })}>
              Revisar
            </Link>
          )}
          <Button size="sm" variant="ghost" onClick={onClear}>
            Cerrar
          </Button>
        </span>
      </Card>
    );
  }

  const elapsed = minutes(now - Date.parse(job.startedAt));
  return (
    <Card as="section" variant="raised" aria-label="Búsqueda en segundo plano" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="relative flex size-3">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-60" />
            <span className="relative inline-flex size-3 rounded-full bg-accent" />
          </span>
          <div className="flex flex-col">
            <Heading as="h2" size="subheading">
              {job.aiName} está buscando {what}
            </Heading>
            <span className="text-sm text-muted">{elapsed < 1 ? "Acaba de empezar" : `Lleva ${elapsed} min`}</span>
          </div>
        </div>
        <Button size="sm" onClick={onClear}>
          Cancelar
        </Button>
      </div>
      <span className="text-sm text-ink-2">
        Se hace en segundo plano: puedes cerrar esta página. Lo que encuentre aparecerá aquí y en el panel de tu ordenador.
        {job.ai === "anthropic-api" ? " Con Claude suele tardar unos minutos, y a veces hasta una hora." : " Suele tardar unos minutos."}
      </span>
    </Card>
  );
}
