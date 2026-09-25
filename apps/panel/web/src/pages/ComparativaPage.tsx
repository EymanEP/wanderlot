import { duration, euros } from "@wanderlot/core";
import { Button, Card, EmptyState, PageHeader, buttonClasses, useToast } from "@wanderlot/ui";
import { Link } from "react-router";
import { CompareCard } from "../components/CompareCard.tsx";
import { PanelShell } from "../components/PanelShell.tsx";
import { useApproved, usePanel } from "../data/store.tsx";
import { flightMinutes, total, weatherTemp } from "../lib/view.ts";

export function ComparativaPage() {
  const { state, setEditorial, sendToVote } = usePanel();
  const approved = useApproved();
  const toast = useToast();
  const { plan, editorial } = state;
  const month = new Intl.DateTimeFormat("es-ES", { month: "long", timeZone: "UTC" }).format(new Date(`${plan.dateFrom}T12:00:00Z`));
  const monthLabel = month[0]!.toUpperCase() + month.slice(1);
  const inVote = approved.filter((p) => editorial[p.id]?.inVote ?? true);
  const n = approved.length;

  const cheapest = [...approved].sort((a, b) => total(a, plan) - total(b, plan))[0];
  const shortest = [...approved].sort((a, b) => flightMinutes(a) - flightMinutes(b))[0];
  const warmest = [...approved].sort((a, b) => (weatherTemp(editorial[b.id]?.weather ?? "") ?? -99) - (weatherTemp(editorial[a.id]?.weather ?? "") ?? -99))[0];

  return (
    <PanelShell tone="canvas">
      <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-[26px] px-4 py-8 sm:px-8 xl:px-14">
        <PageHeader
          title="Comparativa"
          subtitle={`Las ${n} aprobadas de ${plan.name} · los pros y contras los escribió Claude, puedes reescribirlos antes de publicar`}
          actions={
            <>
              <Button size="md" className="h-[46px]" disabled={n === 0} onClick={() => toast("Pros y contras regenerados (simulado)")}>
                Regenerar pros y contras
              </Button>
              <Button
                variant="primary"
                className="h-[46px]"
                disabled={inVote.length < 2}
                title={inVote.length < 2 ? "La votación necesita al menos 2 destinos" : undefined}
                onClick={() => {
                  sendToVote();
                  toast(`${inVote.length} destinos enviados a votación (simulado)`);
                }}
              >
                Enviar {inVote.length === 1 ? "1" : `las ${inVote.length}`} a votación
              </Button>
            </>
          }
        />

        {n === 0 ? (
          <EmptyState
            title="Todavía no has aprobado ninguna propuesta"
            action={
              <Link to="/revisar" className={buttonClasses({ variant: "primary" })}>
                Ir a Revisar
              </Link>
            }
          >
            Aprueba en Revisar las que quieras comparar.
          </EmptyState>
        ) : (
          <section className="grid gap-[18px] sm:grid-cols-2 xl:grid-cols-4">
            {approved.map((p) => (
              <CompareCard
                key={p.id}
                proposal={p}
                plan={plan}
                monthLabel={monthLabel}
                editorial={editorial[p.id] ?? { pros: [], cons: [], weather: "—", inVote: true }}
                onChange={(patch) => setEditorial(p.id, patch)}
              />
            ))}
          </section>
        )}

        {n > 0 && (
          <Card variant="flat" className="mt-auto flex flex-col gap-4 px-[22px] py-[18px] lg:flex-row lg:items-center lg:justify-between">
            <dl className="m-0 flex flex-wrap gap-x-9 gap-y-3">
              {[
                ["Más barato", cheapest && `${cheapest.place.city} · ${euros(total(cheapest, plan))}`],
                ["Vuelo más corto", shortest && `${shortest.place.city} · ${duration(flightMinutes(shortest))}`],
                ["Mejor tiempo", warmest && `${warmest.place.city} · ${weatherTemp(editorial[warmest.id]?.weather ?? "") ?? "—"} °C`],
              ].map(([label, value]) => (
                <div key={label} className="flex flex-col gap-[3px]">
                  <dt className="text-xs text-muted">{label}</dt>
                  <dd className="m-0 text-[15px] font-bold">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="m-0 text-[13px] text-muted lg:text-right">
              Total = vuelo ida y vuelta + {plan.nights} noches de alojamiento, por persona.
              <br />
              Actividades y comidas van aparte.
            </p>
          </Card>
        )}
      </main>
    </PanelShell>
  );
}
