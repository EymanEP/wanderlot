import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router";
import { copy } from "@wanderlot/core";
import { ArrowUpIcon, Button, PlusIcon, Checkbox, Chip, Dialog, EmptyState, PageHeader, ScrollRow, Select, TrashIcon, useCopy, useToast } from "@wanderlot/ui";
import { PanelShell } from "../components/PanelShell.tsx";
import { PhotoPicker } from "../components/PhotoPicker.tsx";
import { ManualDialog } from "../components/ManualDialog.tsx";
import { PriceDialog } from "../components/PriceDialog.tsx";
import { ReviewCard } from "../components/ReviewCard.tsx";
import type { PublishStatus, ScreenshotImage } from "../data/backend.ts";
import { useApproved, useCounts, usePanel, usePlan, type Review } from "../data/store.tsx";
import { flightMinutes, total, trustOf } from "../lib/view.ts";

const COPY = copy({
  es: {
    cleared: (n: number) => `${n} ${n === 1 ? "propuesta borrada" : "propuestas borradas"}. Quedan las aprobadas.`,
    clearFailed: (msg: string) => `No se pudo borrar: ${msg}`,
    lookingGoogle: "mirando Google Flights…",
    waitingBrowser: "esperando al navegador…",
    published: (n: number, trip: string) => (n ? `${n} ${n === 1 ? "destino publicado" : "destinos publicados"} en el sitio` : `${trip} ya no tiene destinos en el sitio`),
    publishFailed: (msg: string) => `No se pudo publicar: ${msg}`,
    unpublished: "Cambios sin publicar",
    upToDate: "El sitio está al día",
    emptySite: "Vaciar el sitio",
    publish: (n: number) => `Publicar ${n} ${n === 1 ? "aprobada" : "aprobadas"}`,
    subtitle: (all: number, approved: number, discarded: number, pending: number) => `${all} propuestas generadas · ${approved} aprobadas · ${discarded} descartadas · ${pending} por revisar`,
    willCheck: (ai: string, n: number, browser: string | undefined) => `${ai} mirará ${n === 1 ? "sus vuelos" : `los vuelos de ${n}, uno detrás de otro,`} en ${browser ?? "el navegador"}`,
    checkApproved: (n: number) => `Comprobar vuelos de las aprobadas · ${n}`,
    addByHand: "Añadir a mano",
    clearUnapproved: (n: number) => `Borrar las no aprobadas${n ? ` · ${n}` : ""}`,
    sortLabel: "Ordenar propuestas",
    byPrice: "Ordenar por precio",
    byDuration: "Por duración de vuelo",
    byTotal: "Por coste total",
    filterLabel: "Filtrar por estado",
    all: "Todas",
    pending: "Por revisar",
    approved: "Aprobadas",
    discarded: "Descartadas",
    hideUnverified: "Ocultar las que no estén verificadas",
    noneTitle: "Todavía no hay propuestas",
    noneText: "Búscalas en Generar, o añade a mano un destino que hayas mirado tú.",
    filteredTitle: "Nada que enseñar con estos filtros",
    filteredText: "Cambia el filtro de arriba para ver el resto de propuestas.",
    verified: (city: string) => `${city}: verificado con la API`,
    notVerified: (city: string, reason: string | undefined) => `${city}: ${reason ?? "no se pudo verificar"}`,
    added: (city: string) => `${city} añadido y aprobado`,
    pricesChecked: (city: string | undefined) => `${city}: precios comprobados a mano`,
    photosSaved: (city: string | undefined, n: number) => `${city}: ${n} ${n === 1 ? "foto guardada" : "fotos guardadas"}`,
    photosRemoved: "Fotos quitadas",
    emptyTitle: (trip: string) => `¿Quitar los destinos de ${trip} del sitio?`,
    emptyText: (trip: string) => `No queda ninguna propuesta aprobada, así que la cuadrilla verá ${trip} sin destinos hasta que publiques otros. Si alguien ya ha votado, el sitio no dejará quitarlos.`,
    clearTitle: (n: number) => `¿Borrar ${n} ${n === 1 ? "propuesta" : "propuestas"}?`,
    clear: "Borrar",
    clearText: (pending: number, discarded: number, trip: string, approved: number) => `Se borran las ${pending} por revisar y las ${discarded} descartadas de ${trip}, con sus fotos. Las ${approved} aprobadas se quedan. No se puede deshacer.`,
    riskyTitle: "Hay precios sin verificar",
    publishAnyway: "Publicar igualmente",
    riskyText: (cities: string, n: number) => `${cities} ${n === 1 ? "llegará" : "llegarán"} al sitio con su etiqueta. Mejor ${n === 1 ? "verificarla" : "verificarlas"} antes de que la cuadrilla vote.`,
  },
  en: {
    cleared: (n: number) => `${n} ${n === 1 ? "proposal deleted" : "proposals deleted"}. The approved ones stay.`,
    clearFailed: (msg: string) => `Couldn't delete: ${msg}`,
    lookingGoogle: "looking at Google Flights…",
    waitingBrowser: "waiting for the browser…",
    published: (n: number, trip: string) => (n ? `${n} ${n === 1 ? "destination published" : "destinations published"} on the site` : `${trip} no longer has destinations on the site`),
    publishFailed: (msg: string) => `Couldn't publish: ${msg}`,
    unpublished: "Unpublished changes",
    upToDate: "The site is up to date",
    emptySite: "Empty the site",
    publish: (n: number) => `Publish ${n} approved`,
    subtitle: (all: number, approved: number, discarded: number, pending: number) => `${all} proposals generated · ${approved} approved · ${discarded} discarded · ${pending} to review`,
    willCheck: (ai: string, n: number, browser: string | undefined) => `${ai} will check ${n === 1 ? "its flights" : `the flights for ${n}, one after another,`} in ${browser ?? "the browser"}`,
    checkApproved: (n: number) => `Check flights for the approved · ${n}`,
    addByHand: "Add by hand",
    clearUnapproved: (n: number) => `Delete the unapproved${n ? ` · ${n}` : ""}`,
    sortLabel: "Sort proposals",
    byPrice: "Sort by price",
    byDuration: "By flight time",
    byTotal: "By total cost",
    filterLabel: "Filter by status",
    all: "All",
    pending: "To review",
    approved: "Approved",
    discarded: "Discarded",
    hideUnverified: "Hide the unverified ones",
    noneTitle: "No proposals yet",
    noneText: "Look for them in Generate, or add a destination you've looked into yourself.",
    filteredTitle: "Nothing to show with these filters",
    filteredText: "Change the filter above to see the rest of the proposals.",
    verified: (city: string) => `${city}: verified with the API`,
    notVerified: (city: string, reason: string | undefined) => `${city}: ${reason ?? "couldn't verify"}`,
    added: (city: string) => `${city} added and approved`,
    pricesChecked: (city: string | undefined) => `${city}: prices checked by hand`,
    photosSaved: (city: string | undefined, n: number) => `${city}: ${n} ${n === 1 ? "photo saved" : "photos saved"}`,
    photosRemoved: "Photos removed",
    emptyTitle: (trip: string) => `Remove ${trip}'s destinations from the site?`,
    emptyText: (trip: string) => `There are no approved proposals left, so the group will see ${trip} with no destinations until you publish others. If anyone has already voted, the site won't let you remove them.`,
    clearTitle: (n: number) => `Delete ${n} ${n === 1 ? "proposal" : "proposals"}?`,
    clear: "Delete",
    clearText: (pending: number, discarded: number, trip: string, approved: number) => `The ${pending} to review and the ${discarded} discarded from ${trip} are deleted, with their photos. The ${approved} approved stay. This can't be undone.`,
    riskyTitle: "Some prices aren't verified",
    publishAnyway: "Publish anyway",
    riskyText: (cities: string, n: number) => `${cities} will reach the site with ${n === 1 ? "its" : "their"} label. Better to verify ${n === 1 ? "it" : "them"} before the group votes.`,
  },
});

type Filter = "all" | Review;
type Sort = "price" | "duration" | "total";

export function RevisarPage() {
  const t = useCopy(COPY);
  const { state, now, setReview, verify, publish, publishStatus, setEditorial, searchPhotos, setPrices, clearUnapproved, extract, addProposal, browse, takeTask } = usePanel();
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
  const [adding, setAdding] = useState(false);
  const unapproved = counts.pending + counts.discarded;
  const doClear = async () => {
    setClearing(false);
    try {
      const n = await clearUnapproved();
      setFilter("all");
      toast(t.cleared(n));
    } catch (e) {
      toast(t.clearFailed((e as Error).message));
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

  // "Comprobar vuelos": one at a time in the browser, the rest wait.
  const checkingLine = (id: string) => {
    const task = state.tasks.find((x) => x.kind === "browse" && x.status === "running" && x.planId === plan.id && x.proposalId === id);
    return task ? (task.steps.length ? t.lookingGoogle : t.waitingBrowser) : null;
  };
  const unchecked = state.status?.browse ? approved.filter((p) => trustOf(p, now) !== "verified" && !checkingLine(p.id)) : [];
  // A check that came back incomplete opens its prices to finish by hand.
  const waiting = state.tasks.filter((t) => t.kind === "browse" && t.status === "done" && t.planId === plan.id);
  useEffect(() => {
    if (!pricing && waiting[0]?.proposalId) setPricing(waiting[0].proposalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waiting.map((t) => t.id).join()]);

  // Whether the site is behind: checked again shortly after any change, once
  // the server has it.
  const [status, setStatus] = useState<PublishStatus | null>(null);
  const [statusTick, setStatusTick] = useState(0);
  useEffect(() => {
    let live = true;
    const timer = setTimeout(() => {
      publishStatus().then(
        (s) => live && setStatus(s),
        () => live && setStatus(null),
      );
    }, 300);
    return () => {
      live = false;
      clearTimeout(timer);
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
      toast(t.published(n, plan.name));
    } catch (e) {
      toast(t.publishFailed((e as Error).message));
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
          {status.changed ? t.unpublished : t.upToDate}
        </span>
      )}
      <Button
        variant="primary"
        icon={<ArrowUpIcon size={17} strokeWidth={1.9} />}
        disabled={publishing || (empties ? !(status?.publishedAt && status.changed) : false)}
        onClick={() => (empties ? setEmptying(true) : risky.length ? setConfirming(true) : doPublish())}
      >
        {empties ? t.emptySite : t.publish(approved.length)}
      </Button>
    </div>
  );

  return (
    <PanelShell end={publishButton}>
      <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-[26px] px-4 py-8 sm:px-8 xl:px-14">
        <PageHeader
          title={plan.name}
          subtitle={t.subtitle(counts.all, counts.approved, counts.discarded, counts.pending)}
          actions={
            <div className="flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row sm:items-center">
              {unchecked.length > 0 && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    for (const p of unchecked) browse(p.id);
                    toast(t.willCheck(state.status?.ai?.name ?? "Claude", unchecked.length, state.status?.browser));
                  }}
                >
                  {t.checkApproved(unchecked.length)}
                </Button>
              )}
              <Button icon={<PlusIcon size={16} />} onClick={() => setAdding(true)}>
                {t.addByHand}
              </Button>
              <Button icon={<TrashIcon size={16} />} disabled={unapproved === 0} onClick={() => setClearing(true)}>
                {t.clearUnapproved(unapproved)}
              </Button>
              <Select
                className="w-full sm:w-[290px]"
                label={t.sortLabel}
                value={sort}
                onChange={setSort}
                options={[
                  { value: "price", label: t.byPrice },
                  { value: "duration", label: t.byDuration },
                  { value: "total", label: t.byTotal },
                ]}
              />
            </div>
          }
        />

        <section className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <ScrollRow role="group" aria-label={t.filterLabel}>
            {(
              [
                ["all", t.all, counts.all],
                ["pending", t.pending, counts.pending],
                ["approved", t.approved, counts.approved],
                ["discarded", t.discarded, counts.discarded],
              ] as const
            ).map(([id, label, n]) => (
              <Chip key={id} variant="solid" size="lg" on={filter === id} onClick={() => setFilter(id)}>
                {label} · {n}
              </Chip>
            ))}
          </ScrollRow>
          <Checkbox label={t.hideUnverified} checked={hideUnverified} onChange={(e) => setHideUnverified(e.target.checked)} />
        </section>

        {list.length === 0 ? (
          counts.all === 0 ? (
            <EmptyState title={t.noneTitle}>{t.noneText}</EmptyState>
          ) : (
            <EmptyState title={t.filteredTitle}>{t.filteredText}</EmptyState>
          )
        ) : (
          <section data-stagger className="grid gap-6 md:grid-cols-2">
            {list.map((p) => (
              <ReviewCard
                key={p.id}
                proposal={p}
                plan={plan}
                now={now}
                verifying={state.verifying.includes(p.id)}
                canVerify={state.status?.flights !== "none"}
                canBrowse={!!state.status?.browse && p.review === "approved"}
                onCheckPrices={() => browse(p.id)}
                checking={checkingLine(p.id)}
                onReview={(r) => setReview(p.id, r)}
                photos={state.editorial[p.id]?.photos ?? []}
                onPickPhotos={() => setPicking(p.id)}
                onEditPrices={() => setPricing(p.id)}
                onVerify={() =>
                  verify(p.id).then((r) => toast(r.verified ? t.verified(p.place.city) : t.notVerified(p.place.city, r.reason)))
                }
              />
            ))}
          </section>
        )}
      </main>

      <ManualDialog
        open={adding}
        plan={plan}
        onClose={() => setAdding(false)}
        onSave={async (p) => {
          const added = await addProposal(p);
          setAdding(false);
          setFilter("all");
          toast(t.added(added.place.city));
        }}
      />

      <PriceDialog
        proposal={state.proposals.find((p) => p.id === pricing)}
        plan={plan}
        aiName={state.status?.ai?.name ?? "Claude"}
        // Only for the finalists: the proposals the group will vote on.
        {...(state.status?.browse && state.proposals.find((p) => p.id === pricing)?.review === "approved"
          ? {
              browse: {
                tasks: state.tasks.filter((t) => t.kind === "browse" && t.planId === plan.id && t.proposalId === pricing),
                start: () => browse(pricing!),
                take: takeTask,
              },
            }
          : {})}
        {...(state.status?.research !== "none" ? { onExtract: (kind: "flight" | "stay", images: ScreenshotImage[]) => extract(pricing!, kind, images) } : {})}
        onClose={() => setPricing(null)}
        onSave={async (prices) => {
          const city = state.proposals.find((p) => p.id === pricing)?.place.city;
          await setPrices(pricing!, prices);
          toast(t.pricesChecked(city));
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
          toast(photos.length ? t.photosSaved(pickingProposal?.place.city, photos.length) : t.photosRemoved);
        }}
      />

      <Dialog
        open={emptying}
        title={t.emptyTitle(plan.name)}
        confirmLabel={t.emptySite}
        tone="warning"
        onConfirm={() => void doPublish()}
        onClose={() => setEmptying(false)}
      >
        {t.emptyText(plan.name)}
      </Dialog>

      <Dialog
        open={clearing}
        title={t.clearTitle(unapproved)}
        confirmLabel={t.clear}
        tone="warning"
        onConfirm={() => void doClear()}
        onClose={() => setClearing(false)}
      >
        {t.clearText(counts.pending, counts.discarded, plan.name, counts.approved)}
      </Dialog>

      <Dialog
        open={confirming}
        title={t.riskyTitle}
        confirmLabel={t.publishAnyway}
        tone="warning"
        onConfirm={doPublish}
        onClose={() => setConfirming(false)}
      >
        {t.riskyText(risky.map((p) => p.place.city).join(", "), risky.length)}
      </Dialog>
    </PanelShell>
  );
}
