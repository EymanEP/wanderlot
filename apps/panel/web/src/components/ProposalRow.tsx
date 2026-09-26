import { Link } from "react-router";
import type { Plan, Proposal } from "@wanderlot/core";
import { euros } from "@wanderlot/core";
import { Button, Card, Heading, IataTile, ProvenanceBadge, Skeleton, buttonClasses } from "@wanderlot/ui";
import { generatedLine, total, trustOf } from "../lib/view.ts";

export interface ProposalRowProps {
  proposal: Proposal;
  plan: Plan;
  now: Date;
  verifying: boolean;
  onVerify: () => void;
  canVerify: boolean;
}

// One result in Generar's list, as it arrives.
export function ProposalRow({ proposal: p, plan, now, verifying, onVerify, canVerify }: ProposalRowProps) {
  const trust = trustOf(p, now);
  return (
    <Card as="article" variant="flat" padding="none" className="flex flex-wrap items-center gap-x-[18px] gap-y-3 px-[18px] py-4 sm:flex-nowrap">
      <IataTile code={p.place.iata} size="lg" />
      {/* On phones the details take the first row; price and action wrap below. */}
      <div className="flex min-w-[calc(100%-84px)] flex-1 flex-col gap-1.5 sm:min-w-0">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <Heading as="h3" size="subheading">
            {p.place.city}
          </Heading>
          <span className="text-sm text-muted">{p.place.country}</span>
          <ProvenanceBadge trust={trust} label={trust === "stale" ? "Caducado" : "short"} />
        </div>
        <span className="text-sm text-ink-2">{generatedLine(p, plan)}</span>
      </div>
      <span className="ml-auto shrink-0 text-right text-[13px] text-muted">
        <strong className="block text-xl font-bold text-ink tabular-nums">{euros(total(p, plan))}</strong>
        por persona
      </span>
      {trust === "unverified" && canVerify ? (
        <Button variant="warning" size="md" onClick={onVerify} disabled={verifying}>
          {verifying ? "Verificando…" : "Verificar"}
        </Button>
      ) : (
        <Link to={`/revisar#${p.id}`} className={buttonClasses({ variant: "secondary", size: "md" })}>
          Revisar
        </Link>
      )}
    </Card>
  );
}

export function ProposalRowLoading() {
  return (
    <Card as="article" variant="dashed" padding="none" aria-busy="true" className="flex items-center gap-[18px] px-[18px] py-4">
      <div className="size-[66px] shrink-0 rounded-xl bg-surface-4" />
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <Skeleton className="h-[13px] w-[190px] max-w-full" />
        <Skeleton className="h-[11px] w-[360px] max-w-full" />
      </div>
      <span className="shrink-0 text-sm text-muted">Consultando vuelos…</span>
    </Card>
  );
}
