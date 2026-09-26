import { useState } from "react";
import type { Photo as PhotoData, Plan, Proposal } from "@wanderlot/core";
import { euros } from "@wanderlot/core";
import { Badge, Button, Card, CheckIcon, Heading, Notice, Photo, ProvenanceBadge, buttonClasses, cn } from "@wanderlot/ui";
import type { Review } from "../data/store.tsx";
import { CATEGORY_LABEL, flightLine, sourceLine, stayLine, thingsLine, total, trustOf, trustText } from "../lib/view.ts";

export interface ReviewCardProps {
  proposal: Proposal;
  plan: Plan;
  now: Date;
  verifying: boolean;
  onReview: (review: Review) => void;
  onVerify: () => void;
  // Whether a flight API is configured to verify against.
  canVerify: boolean;
  photos: PhotoData[];
  onPickPhotos: () => void;
  // Type in prices checked by hand.
  onEditPrices: () => void;
}

// A proposal as the organiser judges it: photo, provenance, facts, decision.
export function ReviewCard({ proposal: p, plan, now, verifying, onReview, onVerify, canVerify, photos, onPickPhotos, onEditPrices }: ReviewCardProps) {
  const [showSources, setShowSources] = useState(false);
  const trust = trustOf(p, now);
  const approved = p.review === "approved";
  const discarded = p.review === "discarded";

  return (
    <Card
      as="article"
      id={p.id}
      variant="raised"
      padding="none"
      radius="card"
      selected={approved}
      aria-label={p.place.city}
      className={`flex scroll-mt-28 flex-col overflow-hidden ${discarded ? "opacity-60" : ""}`}
    >
      <Photo
        label={`Foto de ${p.place.city}`}
        src={photos[0]?.url}
        alt={photos[0]?.alt}
        className="h-[180px] sm:h-[214px]"
        bottom={
          <button type="button" onClick={onPickPhotos} className={cn(buttonClasses({ variant: "secondary" }), "h-9 bg-surface px-3.5 text-[13px]")}>
            {photos.length ? `Fotos · ${photos.length}` : "Elegir fotos"}
          </button>
        }
        top={
          <>
            <Badge tone="white" size="md">
              {CATEGORY_LABEL[p.category]}
            </Badge>
            <ProvenanceBadge trust={trust} label={trust === "stale" ? trustText(p, now) : p.provenance.kind === "organiser" ? "Comprobado a mano" : "long"} size="md" withIcon />
          </>
        }
      />
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3.5 gap-y-1">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-[9px] gap-y-1">
            <Heading as="h2" size="subheading" className="text-[21px]">
              {p.place.city}
            </Heading>
            <span className="text-sm text-muted">{p.place.country}</span>
            {approved && <Badge tone="accent-solid">Aprobada</Badge>}
            {p.suggestedBy && <Badge tone="neutral">Idea de {p.suggestedBy}</Badge>}
            {discarded && <Badge tone="muted">Descartada</Badge>}
          </div>
          <span className="shrink-0 text-[15px]">
            <strong className="text-xl font-bold tabular-nums">{euros(total(p, plan))}</strong> <span className="text-muted">/ persona</span>
          </span>
        </div>

        <div className="flex flex-col gap-[5px] text-sm text-ink-2">
          <span>{flightLine(p)}</span>
          {stayLine(p, plan) && <span>{stayLine(p, plan)}</span>}
          <span>{thingsLine(p)}</span>
        </div>

        {trust === "unverified" && <Notice>Precio y horarios salen de búsquedas web, no de la API. Contrástalos antes de publicar.</Notice>}
        {trust === "stale" && (
          <Notice tone="neutral">El precio se consultó {trustText(p, now).replace(/^(Verificado|Comprobado) /, "")}. Vuelve a comprobarlo antes de abrir la votación.</Notice>
        )}

        {showSources && (
          <ul id={`${p.id}-sources`} className="m-0 flex list-none flex-col gap-1.5 rounded-xl bg-surface-2 p-3 text-[13px]">
            {p.provenance.kind !== "api" ? (
              p.provenance.sources.map((s) => (
                <li key={s.url}>
                  <a href={s.url} target="_blank" rel="noreferrer" className="font-semibold">
                    {s.label}
                  </a>
                </li>
              ))
            ) : (
              <li className="text-ink-2">
                {p.outbound.flightNumber} y {p.inbound.flightNumber} · {euros(p.outbound.priceCents)} + {euros(p.inbound.priceCents)} por persona · respuesta simulada
              </li>
            )}
          </ul>
        )}

        <div className="mt-auto flex flex-wrap items-center justify-between gap-3.5 border-t border-line-faint pt-3.5">
          <span className="text-xs text-muted">
            {sourceLine(p)} ·{" "}
            <button
              type="button"
              aria-expanded={showSources}
              aria-controls={`${p.id}-sources`}
              onClick={() => setShowSources((x) => !x)}
              className="cursor-pointer border-0 bg-transparent p-0 font-semibold text-accent hover:text-accent-hover"
            >
              {p.provenance.kind === "api" ? "ver respuesta" : "ver enlaces"}
            </button>{" "}
            ·{" "}
            <button type="button" onClick={onEditPrices} className="cursor-pointer border-0 bg-transparent p-0 font-semibold text-accent hover:text-accent-hover">
              {p.provenance.kind === "organiser" ? "cambiar precios" : "poner precios reales"}
            </button>
          </span>
          <div className="flex shrink-0 gap-2">
            {discarded ? (
              <Button onClick={() => onReview("pending")}>Recuperar</Button>
            ) : (
              <>
                <Button onClick={() => onReview("discarded")}>Descartar</Button>
                {trust === "unverified" && !approved && canVerify && (
                  <Button variant="warning" onClick={onVerify} disabled={verifying}>
                    {verifying ? "Verificando…" : "Verificar con la API"}
                  </Button>
                )}
                {approved ? (
                  <Button variant="primary" icon={<CheckIcon size={16} />} aria-pressed onClick={() => onReview("pending")}>
                    Aprobada
                  </Button>
                ) : (
                  // Unverified ones can go out too, labelled (SPEC §3); publishing asks first.
                  <Button variant={trust === "unverified" && canVerify ? "secondary" : "soft"} onClick={() => onReview("approved")}>
                    {trust === "unverified" ? "Aprobar sin verificar" : "Aprobar"}
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
