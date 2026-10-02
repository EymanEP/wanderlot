import { Link } from "react-router";
import type { Plan, Proposal } from "@wanderlot/core";
import { checkedLabel, copy, euros, researchLabel } from "@wanderlot/core";
import { Badge, Button, Card, Heading, IataTile, ProvenanceBadge, buttonClasses, useCopy } from "@wanderlot/ui";
import { generatedLine, total, trustOf } from "../lib/view.ts";

const COPY = copy({
  es: {
    stale: "Caducado",
    checked: "Comprobado",
    ideaOf: (name: string) => `Idea de ${name}`,
    perPerson: "por persona",
    verifying: "Verificando…",
    verify: "Verificar",
    review: "Revisar",
  },
  en: {
    stale: "Out of date",
    checked: "Checked",
    ideaOf: (name: string) => `${name}'s idea`,
    perPerson: "per person",
    verifying: "Verifying…",
    verify: "Verify",
    review: "Review",
  },
});

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
  const t = useCopy(COPY);
  const trust = trustOf(p, now);
  return (
    <Card as="article" aria-label={p.place.city} variant="flat" padding="none" className="flex flex-wrap items-center gap-x-[18px] gap-y-3 px-[18px] py-4 sm:flex-nowrap">
      <IataTile code={p.place.iata} size="lg" />
      {/* On phones the details take the first row; price and action wrap below. */}
      <div className="flex min-w-[calc(100%-84px)] flex-1 flex-col gap-1.5 sm:min-w-0">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <Heading as="h3" size="subheading">
            {p.place.city}
          </Heading>
          <span className="text-sm text-muted">{p.place.country}</span>
          <ProvenanceBadge trust={trust} label={trust === "stale" ? t.stale : p.provenance.kind === "organiser" ? (p.provenance.seenOn?.length ? checkedLabel(p.provenance)! : t.checked) : (researchLabel(p.provenance) ?? "short")} />
          {p.suggestedBy && <Badge tone="neutral">{t.ideaOf(p.suggestedBy)}</Badge>}
        </div>
        <span className="text-sm text-ink-2">{generatedLine(p, plan)}</span>
      </div>
      <span className="ml-auto shrink-0 text-right text-[13px] text-muted">
        <strong className="block text-xl font-bold text-ink tabular-nums">{euros(total(p, plan))}</strong>
        {t.perPerson}
      </span>
      {trust === "unverified" && canVerify ? (
        <Button variant="warning" size="md" onClick={onVerify} disabled={verifying}>
          {verifying ? t.verifying : t.verify}
        </Button>
      ) : (
        <Link to={`/revisar#${p.id}`} className={buttonClasses({ variant: "secondary", size: "md" })}>
          {t.review}
        </Link>
      )}
    </Card>
  );
}
