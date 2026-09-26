import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router";
import { ArrowUpIcon, Button, Checkbox, Chip, Dialog, EmptyState, PageHeader, ScrollRow, Select, useToast } from "@wanderlot/ui";
import { PanelShell } from "../components/PanelShell.tsx";
import { ReviewCard } from "../components/ReviewCard.tsx";
import { useApproved, useCounts, usePanel, usePlan, type Review } from "../data/store.tsx";
import { flightMinutes, total, trustOf } from "../lib/view.ts";

type Filter = "all" | Review;
type Sort = "price" | "duration" | "total";

export function RevisarPage() {
  const { state, now, setReview, verify, publish } = usePanel();
  const counts = useCounts();
  const approved = useApproved();
  const toast = useToast();
  const location = useLocation();
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("price");
  const [hideUnverified, setHideUnverified] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const plan = usePlan();

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

  const [publishing, setPublishing] = useState(false);
  const doPublish = async () => {
    setConfirming(false);
    setPublishing(true);
    try {
      const n = await publish();
      toast(`${n} ${n === 1 ? "destino publicado" : "destinos publicados"} en el sitio`);
    } catch (e) {
      toast(`No se pudo publicar: ${(e as Error).message}`);
    } finally {
      setPublishing(false);
    }
  };

  const publishButton = (
    <Button
      variant="primary"
      icon={<ArrowUpIcon size={17} strokeWidth={1.9} />}
      disabled={approved.length === 0 || publishing}
      onClick={() => (risky.length ? setConfirming(true) : doPublish())}
    >
      Publicar {approved.length} {approved.length === 1 ? "aprobada" : "aprobadas"}
    </Button>
  );

  return (
    <PanelShell showPlan={false} end={publishButton}>
      <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-[26px] px-4 py-8 sm:px-8 xl:px-14">
        <PageHeader
          title={plan.name}
          subtitle={`${counts.all} propuestas generadas · ${counts.approved} aprobadas · ${counts.discarded} descartadas · ${counts.pending} por revisar`}
          actions={
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
                onVerify={() =>
                  verify(p.id).then((r) => toast(r.verified ? `${p.place.city}: verificado con la API` : `${p.place.city}: ${r.reason ?? "no se pudo verificar"}`))
                }
              />
            ))}
          </section>
        )}
      </main>

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
