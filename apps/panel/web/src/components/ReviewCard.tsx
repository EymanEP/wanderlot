import { useState } from "react";
import type { Photo as PhotoData, Plan, Proposal } from "@wanderlot/core";
import { checkedLabel, copy, euros, googleFlightsUrl, researchLabel, standardImageUrl } from "@wanderlot/core";
import { Badge, Button, Card, CheckIcon, Heading, Notice, Photo, ProvenanceBadge, buttonClasses, cn, useCopy } from "@wanderlot/ui";
import type { Review } from "../data/store.tsx";
import { CATEGORY_LABEL, flightLine, sourceLine, stayLine, thingsLine, total, trustOf, trustText } from "../lib/view.ts";

const COPY = copy({
  es: {
    photoOf: (city: string) => `Foto de ${city}`,
    photos: (n: number) => `Fotos · ${n}`,
    pickPhotos: "Elegir fotos",
    approved: "Aprobada",
    ideaOf: (name: string) => `Idea de ${name}`,
    discarded: "Descartada",
    perPerson: "/ persona",
    estimates: (by: string | undefined) => `Precio y horarios son estimaciones de ${by ?? "la IA"}, sin buscar en la web. Contrástalos antes de publicar.`,
    webSearch: "Precio y horarios salen de búsquedas web, no de la API. Contrástalos antes de publicar.",
    otherDates: "Este precio se comprobó para otras fechas: el viaje ha cambiado de días. Vuelve a comprobarlo.",
    stale: (ago: string) => `El precio se consultó ${ago}. Vuelve a comprobarlo antes de abrir la votación.`,
    apiAnswer: (out: string, back: string, outPrice: string, backPrice: string) => `${out} y ${back} · ${outPrice} + ${backPrice} por persona · respuesta simulada`,
    seeAnswer: "ver respuesta",
    seeLinks: "ver enlaces",
    checkFlights: "comprobar vuelos",
    changePrices: "cambiar precios",
    byHand: "ponerlos a mano",
    realPrices: "poner precios reales",
    searchGoogle: "buscar en Google Flights",
    restore: "Recuperar",
    discard: "Descartar",
    verifying: "Verificando…",
    verify: "Verificar con la API",
    approveUnverified: "Aprobar sin verificar",
    approve: "Aprobar",
  },
  en: {
    photoOf: (city: string) => `Photo of ${city}`,
    photos: (n: number) => `Photos · ${n}`,
    pickPhotos: "Choose photos",
    approved: "Approved",
    ideaOf: (name: string) => `${name}'s idea`,
    discarded: "Discarded",
    perPerson: "/ person",
    estimates: (by: string | undefined) => `Price and times are estimates by ${by ?? "the AI"}, without searching the web. Double-check them before publishing.`,
    webSearch: "Price and times come from web searches, not the API. Double-check them before publishing.",
    otherDates: "This price was checked for other dates: the trip's days have changed. Check it again.",
    stale: (ago: string) => `The price was looked up ${ago}. Check it again before opening the vote.`,
    apiAnswer: (out: string, back: string, outPrice: string, backPrice: string) => `${out} and ${back} · ${outPrice} + ${backPrice} per person · simulated response`,
    seeAnswer: "see response",
    seeLinks: "see links",
    checkFlights: "check flights",
    changePrices: "change prices",
    byHand: "enter them by hand",
    realPrices: "enter real prices",
    searchGoogle: "search Google Flights",
    restore: "Restore",
    discard: "Discard",
    verifying: "Verifying…",
    verify: "Verify with the API",
    approveUnverified: "Approve unverified",
    approve: "Approve",
  },
});

export interface ReviewCardProps {
  proposal: Proposal;
  plan: Plan;
  now: Date;
  verifying: boolean;
  onReview: (review: Review) => void;
  onVerify: () => void;
  // Whether a flight API is configured to verify against.
  canVerify: boolean;
  // Its flights can be read off Google Flights (a finalist, and the
  // browser works here): the prices link says so.
  canBrowse?: boolean;
  // "Comprobar vuelos" in the browser, and what it's doing while it runs.
  onCheckPrices?: () => void;
  checking?: string | null;
  photos: PhotoData[];
  onPickPhotos: () => void;
  // Type in prices checked by hand.
  onEditPrices: () => void;
}

// A proposal as the organiser judges it: photo, provenance, facts, decision.
export function ReviewCard({ proposal: p, plan, now, verifying, onReview, onVerify, canVerify, canBrowse, onCheckPrices, checking, photos, onPickPhotos, onEditPrices }: ReviewCardProps) {
  const t = useCopy(COPY);
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
        label={t.photoOf(p.place.city)}
        src={photos[0] ? standardImageUrl(photos[0].url) : undefined}
        alt={photos[0]?.alt}
        className="h-[180px] sm:h-[214px]"
        bottom={
          <button type="button" onClick={onPickPhotos} className={cn(buttonClasses({ variant: "secondary" }), "h-9 bg-surface px-3.5 text-[13px]")}>
            {photos.length ? t.photos(photos.length) : t.pickPhotos}
          </button>
        }
        top={
          <>
            <Badge tone="white" size="md">
              {CATEGORY_LABEL[p.category]}
            </Badge>
            <ProvenanceBadge trust={trust} label={trust === "stale" ? trustText(p, now) : p.provenance.kind === "organiser" ? checkedLabel(p.provenance)! : (researchLabel(p.provenance) ?? "long")} size="md" withIcon />
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
            {approved && <Badge tone="accent-solid">{t.approved}</Badge>}
            {p.suggestedBy && <Badge tone="neutral">{t.ideaOf(p.suggestedBy)}</Badge>}
            {discarded && <Badge tone="muted">{t.discarded}</Badge>}
          </div>
          <span className="shrink-0 text-[15px]">
            <strong className="text-xl font-bold tabular-nums">{euros(total(p, plan))}</strong> <span className="text-muted">{t.perPerson}</span>
          </span>
        </div>

        <div className="flex flex-col gap-[5px] text-sm text-ink-2">
          <span>{flightLine(p)}</span>
          {stayLine(p, plan) && <span>{stayLine(p, plan)}</span>}
          {p.todo.length + p.see.length > 0 && <span>{thingsLine(p)}</span>}
        </div>

        {trust === "unverified" && (
          <Notice>
            {p.provenance.kind === "claude" && p.provenance.estimate
              ? t.estimates(p.provenance.by)
              : t.webSearch}
          </Notice>
        )}
        {trust === "stale" &&
          (p.provenance.kind !== "claude" && p.provenance.forOtherDates ? (
            <Notice tone="neutral">{t.otherDates}</Notice>
          ) : (
            <Notice tone="neutral">{t.stale(trustText(p, now).replace(/^(Verificado|Comprobado|Verified|Checked) /, ""))}</Notice>
          ))}

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
                {t.apiAnswer(p.outbound.flightNumber, p.inbound.flightNumber, euros(p.outbound.priceCents), euros(p.inbound.priceCents))}
              </li>
            )}
          </ul>
        )}

        <div className="mt-auto flex flex-wrap items-center justify-between gap-3.5 border-t border-line-faint pt-3.5">
          <span className="text-xs text-muted">
            {sourceLine(p)} ·{" "}
            {/* Nothing to show for one added by hand or estimated. */}
            {(p.provenance.kind === "api" || p.provenance.sources.length > 0) && (
              <>
                <button
                  type="button"
                  aria-expanded={showSources}
                  aria-controls={`${p.id}-sources`}
                  onClick={() => setShowSources((x) => !x)}
                  className="cursor-pointer border-0 bg-transparent p-0 font-semibold text-accent hover:text-accent-hover"
                >
                  {p.provenance.kind === "api" ? t.seeAnswer : t.seeLinks}
                </button>{" "}
                ·{" "}
              </>
            )}
            {canBrowse && onCheckPrices && (
              <>
                {checking ? (
                  <span role="status" className="font-semibold text-claude">
                    {checking}
                  </span>
                ) : (
                  <button type="button" onClick={onCheckPrices} className="cursor-pointer border-0 bg-transparent p-0 font-semibold text-accent hover:text-accent-hover">
                    {t.checkFlights}
                  </button>
                )}{" "}
                ·{" "}
              </>
            )}
            <button type="button" onClick={onEditPrices} className="cursor-pointer border-0 bg-transparent p-0 font-semibold text-accent hover:text-accent-hover">
              {p.provenance.kind === "organiser" ? t.changePrices : canBrowse ? t.byHand : t.realPrices}
            </button>{" "}
            ·{" "}
            <a
              href={googleFlightsUrl(p.outbound.from, p.outbound.to, plan.dateFrom, plan.dateTo)}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-accent hover:text-accent-hover"
            >
              {t.searchGoogle}
            </a>
          </span>
          <div className="flex shrink-0 gap-2">
            {discarded ? (
              <Button onClick={() => onReview("pending")}>{t.restore}</Button>
            ) : (
              <>
                <Button onClick={() => onReview("discarded")}>{t.discard}</Button>
                {trust === "unverified" && !approved && canVerify && (
                  <Button variant="warning" onClick={onVerify} disabled={verifying}>
                    {verifying ? t.verifying : t.verify}
                  </Button>
                )}
                {approved ? (
                  <Button variant="primary" icon={<CheckIcon size={16} />} aria-pressed onClick={() => onReview("pending")}>
                    {t.approved}
                  </Button>
                ) : (
                  // Unverified ones can go out too, labelled (SPEC §3); publishing asks first.
                  <Button variant={trust === "unverified" && canVerify ? "secondary" : "soft"} onClick={() => onReview("approved")}>
                    {trust === "unverified" ? t.approveUnverified : t.approve}
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
