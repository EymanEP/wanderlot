import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router";
import { ArrowUpIcon, Button, Checkbox, Chip, Dialog, EmptyState, PageHeader, ScrollRow, Select, TrashIcon, useToast } from "@wanderlot/ui";
import { PanelShell } from "../components/PanelShell.tsx";
import { PhotoPicker } from "../components/PhotoPicker.tsx";
import { PriceDialog } from "../components/PriceDialog.tsx";
import { ReviewCard } from "../components/ReviewCard.tsx";
import type { PublishStatus } from "../data/backend.ts";
import { useApproved, useCounts, usePanel, usePlan, type Review } from "../data/store.tsx";
import { flightMinutes, total, trustOf } from "../lib/view.ts";

type Filter = "all" | Review;
type Sort = "price" | "duration" | "total";

export function RevisarPage() {
  const { state, now, setReview, verify, publish, publishStatus, setEditorial, searchPhotos, setPrices, clearUnapproved } = usePanel();
  const counts = useCounts();
  const approved = useApproved();
  const toast = useToast();
  const location = useLocation();
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("price");
  const [hideUnverified, setHideUnverified] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [picking, setPicking] = useState<string | null>(null);
  const [pricing, setPricing] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const unapproved = counts.pending + counts.discarded;
  const doClear = async () => {
    setClearing(false);
    try {
      const n = await clearUnapproved();
      setFilter("all");
      toast(`${n} ${n === 1 ? "propuesta borrada" : "propuestas borradas"}. Quedan las aprobadas.`);
    } catch (e) {
      toast(`No se pudo borrar: ${(e as Error).message}`);
    }
  };
  const plan = usePlan();
  const pickingProposal = state.proposals.find((p) => p.id === picking);

  // Arriving from Generar's "Revisar" link: scroll to that card.
  useEffect(() => {
    const id = location.hash.slice(1);
    if (id) document.getElementById(id)?.scrollIntoView({ block: "start" });
  }, [location.hash]);

  const list = useMemo(() => {
    const flight = (id: string) => {
      const p = state.proposals.find((x) => x.id === id)!;
      return p.outbound.priceCents + p.inbound.priceCents;
    };
    return state.proposals
      .filter((p) => filter === "all" || p.review === filter)
      .filter((p) => !hideUnverified || trustOf(p, now) !== "unverified")
      .sort((a, b) =>
        sort === "price" ? flight(a.id) - flight(b.id) : sort === "duration" ? flightMinutes(a) - flightMinutes(b) : total(a, plan) - total(b, plan),
      );
  }, [state.proposals, filter, hideUnverified, sort, now, plan]);

  const risky = approved.filter((p) => trustOf(p, now) !== "verified");

  // Whether the site is behind: checked again shortly after any change, once
  // the server has it.
  const [status, setStatus] = useState<PublishStatus | null>(null);
  const [statusTick, setStatusTick] = useState(0);
  useEffect(() => {
    let live = true;
    const t = setTimeout(() => {
      publishStatus().then(
        (s) => live && setStatus(s),
        () => live && setStatus(null),
      );
    }, 300);
    return () => {
      live = false;
      clearTimeout(t);
    };
    // Not on `publishStatus` itself: it's a new function on every panel change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, state.proposals, state.editorial, statusTick]);

  const [publishing, setPublishing] = useState(false);
  const [emptying, setEmptying] = useState(false);
  const doPublish = async () => {
    setConfirming(false);
    setEmptying(false);
    setPublishing(true);
    try {
      const n = await publish();
      toast(n ? `${n} ${n === 1 ? "destino publicado" : "destinos publicados"} en el sitio` : `${plan.name} ya no tiene destinos en el sitio`);
    } catch (e) {
      toast(`No se pudo publicar: ${(e as Error).message}`);
    } finally {
      setPublishing(false);
      setStatusTick((n) => n + 1);
    }
  };

  // With nothing approved, publishing empties a trip already on the site.
  const empties = approved.length === 0;
  const publishButton = (
    <div className="flex items-center gap-3">
      {status && (status.changed || status.publishedAt) && (
        <span className={`hidden text-[13px] sm:inline ${status.changed ? "font-semibold text-claude" : "text-muted"}`} aria-live="polite">
          {status.changed ? "Cambios sin publicar" : "El sitio está al día"}
        </span>
      )}
      <Button
        variant="primary"
        icon={<ArrowUpIcon size={17} strokeWidth={1.9} />}
        disabled={publishing || (empties ? !(status?.publishedAt && status.changed) : false)}
        onClick={() => (empties ? setEmptying(true) : risky.length ? setConfirming(true) : doPublish())}
      >
        {empties ? "Vaciar el sitio" : `Publicar ${approved.length} ${approved.length === 1 ? "aprobada" : "aprobadas"}`}
      </Button>
    </div>
  );

  return (
    <PanelShell showPlan={false} end={publishButton}>
      <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-[26px] px-4 py-8 sm:px-8 xl:px-14">
        <PageHeader
          title={plan.name}
          subtitle={`${counts.all} propuestas generadas · ${counts.approved} aprobadas · ${counts.discarded} descartadas · ${counts.pending} por revisar`}
          actions={
            <div className="flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row sm:items-center">
              <Button icon={<TrashIcon size={16} />} disabled={unapproved === 0} onClick={() => setClearing(true)}>
                Borrar las no aprobadas{unapproved ? ` · ${unapproved}` : ""}
              </Button>
              <Select
                className="w-full sm:w-[290px]"
                label="Ordenar propuestas"
                value={sort}
                onChange={setSort}
                options={[
                  { value: "price", label: "Ordenar por precio" },
                  { value: "duration", label: "Por duración de vuelo" },
                  { value: "total", label: "Por coste total" },
                ]}
              />
            </div>
          }
        />

        <section className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <ScrollRow role="group" aria-label="Filtrar por estado">
            {(
              [
                ["all", "Todas", counts.all],
                ["pending", "Por revisar", counts.pending],
                ["approved", "Aprobadas", counts.approved],
                ["discarded", "Descartadas", counts.discarded],
              ] as const
            ).map(([id, label, n]) => (
              <Chip key={id} variant="solid" size="lg" on={filter === id} onClick={() => setFilter(id)}>
                {label} · {n}
              </Chip>
            ))}
          </ScrollRow>
          <Checkbox label="Ocultar las que no estén verificadas" checked={hideUnverified} onChange={(e) => setHideUnverified(e.target.checked)} />
        </section>

        {list.length === 0 ? (
          <EmptyState title="Nada que enseñar con estos filtros">Cambia el filtro de arriba para ver el resto de propuestas.</EmptyState>
        ) : (
          <section className="grid gap-6 md:grid-cols-2">
            {list.map((p) => (
              <ReviewCard
                key={p.id}
                proposal={p}
                plan={plan}
                now={now}
                verifying={state.verifying.includes(p.id)}
                canVerify={state.status?.flights !== "none"}
                onReview={(r) => setReview(p.id, r)}
                photos={state.editorial[p.id]?.photos ?? []}
                onPickPhotos={() => setPicking(p.id)}
                onEditPrices={() => setPricing(p.id)}
                onVerify={() =>
                  verify(p.id).then((r) => toast(r.verified ? `${p.place.city}: verificado con la API` : `${p.place.city}: ${r.reason ?? "no se pudo verificar"}`))
                }
              />
            ))}
          </section>
        )}
      </main>

      <PriceDialog
        proposal={state.proposals.find((p) => p.id === pricing)}
        plan={plan}
        onClose={() => setPricing(null)}
        onSave={async (prices) => {
          const city = state.proposals.find((p) => p.id === pricing)?.place.city;
          await setPrices(pricing!, prices);
          toast(`${city}: precios comprobados a mano`);
        }}
      />

      <PhotoPicker
        open={pickingProposal !== undefined}
        city={pickingProposal?.place.city ?? ""}
        suggestions={(picking && state.editorial[picking]?.photoQueries) || []}
        chosen={(picking && state.editorial[picking]?.photos) || []}
        search={searchPhotos}
        onClose={() => setPicking(null)}
        onSave={(photos) => {
          if (picking) setEditorial(picking, { photos });
          setPicking(null);
          toast(photos.length ? `${pickingProposal?.place.city}: ${photos.length} ${photos.length === 1 ? "foto guardada" : "fotos guardadas"}` : "Fotos quitadas");
        }}
      />

      <Dialog
        open={emptying}
        title={`¿Quitar los destinos de ${plan.name} del sitio?`}
        confirmLabel="Vaciar el sitio"
        tone="warning"
        onConfirm={() => void doPublish()}
        onClose={() => setEmptying(false)}
      >
        No queda ninguna propuesta aprobada, así que la cuadrilla verá {plan.name} sin destinos hasta que publiques otros. Si alguien ya ha votado, el sitio no dejará quitarlos.
      </Dialog>

      <Dialog
        open={clearing}
        title={`¿Borrar ${unapproved} ${unapproved === 1 ? "propuesta" : "propuestas"}?`}
        confirmLabel="Borrar"
        tone="warning"
        onConfirm={() => void doClear()}
        onClose={() => setClearing(false)}
      >
        Se borran las {counts.pending} por revisar y las {counts.discarded} descartadas de {plan.name}, con sus fotos. Las {counts.approved} aprobadas se quedan. No se puede deshacer.
      </Dialog>

      <Dialog
        open={confirming}
        title="Hay precios sin verificar"
        confirmLabel="Publicar igualmente"
        tone="warning"
        onConfirm={doPublish}
        onClose={() => setConfirming(false)}
      >
        {risky.map((p) => p.place.city).join(", ")} {risky.length === 1 ? "llegará" : "llegarán"} al sitio con su etiqueta. Mejor {risky.length === 1 ? "verificarla" : "verificarlas"} antes de que la cuadrilla vote.
      </Dialog>
    </PanelShell>
  );
}
