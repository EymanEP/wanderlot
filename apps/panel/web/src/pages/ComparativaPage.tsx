import { useState } from "react";
import { INTL_LOCALE, copy, currentLocale, deadlineLabel, duration, euros } from "@wanderlot/core";
import { Badge, Button, Card, EmptyState, PageHeader, buttonClasses, useCopy } from "@wanderlot/ui";
import { Link } from "react-router";
import { CompareCard } from "../components/CompareCard.tsx";
import { OpenVoteDialog } from "../components/OpenVoteDialog.tsx";
import { PanelShell } from "../components/PanelShell.tsx";
import { useApproved, usePanel, usePlan } from "../data/store.tsx";
import { flightMinutes, total, weatherTemp } from "../lib/view.ts";

const COPY = copy({
  es: {
    title: "Comparativa",
    subtitle: (n: number, trip: string) => `Las ${n} aprobadas de ${trip} · los pros y contras los escribió Claude, puedes reescribirlos antes de publicar`,
    voteOpenUntil: (deadline: string) => `Votación abierta hasta el ${deadline}`,
    voteClosed: "Votación cerrada",
    needsTwo: "La votación necesita al menos 2 destinos",
    send: (n: number) => `Enviar ${n === 1 ? "1" : `las ${n}`} a votación`,
    noneTitle: "Todavía no has aprobado ninguna propuesta",
    goReview: "Ir a Revisar",
    noneText: "Aprueba en Revisar las que quieras comparar.",
    cheapest: "Más barato",
    shortest: "Vuelo más corto",
    warmest: "Mejor tiempo",
    totalIs: (nights: number) => `Total = vuelo ida y vuelta + ${nights} noches de alojamiento, por persona.`,
    extras: "Actividades y comidas van aparte.",
  },
  en: {
    title: "Compare",
    subtitle: (n: number, trip: string) => `The ${n} approved for ${trip} · Claude wrote the pros and cons, you can rewrite them before publishing`,
    voteOpenUntil: (deadline: string) => `Vote open until ${deadline}`,
    voteClosed: "Vote closed",
    needsTwo: "The vote needs at least 2 destinations",
    send: (n: number) => `Send ${n === 1 ? "1" : `all ${n}`} to the vote`,
    noneTitle: "You haven't approved any proposals yet",
    goReview: "Go to Review",
    noneText: "Approve the ones you want to compare in Review.",
    cheapest: "Cheapest",
    shortest: "Shortest flight",
    warmest: "Best weather",
    totalIs: (nights: number) => `Total = return flight + ${nights} nights' stay, per person.`,
    extras: "Activities and meals are extra.",
  },
});

export function ComparativaPage() {
  const t = useCopy(COPY);
  const { state, now, setEditorial, openVote } = usePanel();
  const plan = usePlan();
  const approved = useApproved();
  const [opening, setOpening] = useState(false);
  const { editorial } = state;
  const voting = plan.status !== "draft";
  const month = new Intl.DateTimeFormat(INTL_LOCALE[currentLocale()], { month: "long", timeZone: "UTC" }).format(new Date(`${plan.dateFrom}T12:00:00Z`));
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
          title={t.title}
          subtitle={t.subtitle(n, plan.name)}
          actions={
            voting ? (
              <Link to="/votacion" className="no-underline">
                <Badge tone={plan.status === "voting" ? "accent" : "dark"} size="md">
                  {plan.status === "voting" && plan.voteDeadline ? t.voteOpenUntil(deadlineLabel(plan.voteDeadline)) : t.voteClosed} →
                </Badge>
              </Link>
            ) : (
              <Button
                variant="primary"
                className="h-[46px]"
                disabled={inVote.length < 2}
                title={inVote.length < 2 ? t.needsTwo : undefined}
                onClick={() => setOpening(true)}
              >
                {t.send(inVote.length)}
              </Button>
            )
          }
        />

        {n === 0 ? (
          <EmptyState
            title={t.noneTitle}
            action={
              <Link to="/revisar" className={buttonClasses({ variant: "primary" })}>
                {t.goReview}
              </Link>
            }
          >
            {t.noneText}
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
                [t.cheapest, cheapest && `${cheapest.place.city} · ${euros(total(cheapest, plan))}`],
                [t.shortest, shortest && `${shortest.place.city} · ${duration(flightMinutes(shortest))}`],
                [t.warmest, warmest && `${warmest.place.city} · ${weatherTemp(editorial[warmest.id]?.weather ?? "") ?? "—"} °C`],
              ].map(([label, value]) => (
                <div key={label} className="flex flex-col gap-[3px]">
                  <dt className="text-xs text-muted">{label}</dt>
                  <dd className="m-0 text-[15px] font-bold">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="m-0 text-[13px] text-muted lg:text-right">
              {t.totalIs(plan.nights)}
              <br />
              {t.extras}
            </p>
          </Card>
        )}
      </main>
      <OpenVoteDialog
        open={opening}
        planName={plan.name}
        count={inVote.length}
        today={now.toISOString().slice(0, 10)}
        onOpen={openVote}
        onClose={() => setOpening(false)}
      />
    </PanelShell>
  );
}
