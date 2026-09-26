import { useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { airportCity, longDate, shortDate, type Category } from "@wanderlot/core";
import {
  BeachIcon,
  CityIcon,
  Chip,
  EmptyState,
  FiltersIcon,
  Footer,
  GlobeIcon,
  HouseIcon,
  IconTabs,
  Main,
  MountainIcon,
  PageHeader,
  ScrollRow,
  SectionHeader,
  buttonClasses,
  chipClasses,
  cn,
} from "@wanderlot/ui";
import { CommentCard } from "../components/CommentCard.tsx";
import { DestinationCard } from "../components/DestinationCard.tsx";
import { useAuth } from "../data/auth.tsx";
import { useSite } from "../data/store.tsx";
import { memberOf, numberWord, trustOf } from "../lib/view.ts";

type CategoryFilter = "all" | Category;

const TABS = [
  { id: "all", label: "Todos", icon: <GlobeIcon size={22} /> },
  { id: "ciudad", label: "Ciudad", icon: <CityIcon size={22} /> },
  { id: "escapada", label: "Escapada", icon: <HouseIcon size={22} /> },
  { id: "playa", label: "Playa", icon: <BeachIcon size={22} /> },
  { id: "naturaleza", label: "Naturaleza", icon: <MountainIcon size={22} /> },
] as const;

export function PlanPage() {
  const site = useSite();
  const { planId } = useParams();
  const { group } = useAuth();
  const { plan, destinations, myRanking, voted, comments, members, now, result, closed } = site;
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [onlyDirect, setOnlyDirect] = useState(false);
  const [under400, setUnder400] = useState(false);
  const base = `/p/${planId}`;

  // My picks first, in my order; the rest after. Once closed: by points.
  const ordered = useMemo(() => {
    const pos = (id: string) => (result ? result.rows.findIndex((r) => r.id === id) : myRanking.includes(id) ? myRanking.indexOf(id) : 99);
    return destinations
      .filter((d) => category === "all" || d.category === category)
      .filter((d) => !onlyDirect || d.outbound.stops === 0)
      .filter((d) => !under400 || d.totalPerPersonCents <= 40000)
      .sort((a, b) => pos(a.id) - pos(b.id));
  }, [destinations, category, onlyDirect, under400, myRanking, result]);

  const recent = [...comments].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 3);
  const winnerId = result?.winnerId ?? plan.winnerDestinationId;
  const winner = winnerId ? destinations.find((d) => d.id === winnerId) : undefined;
  const draft = plan.status === "draft";
  const [from, to] = [shortDate(plan.dateFrom), shortDate(plan.dateTo)];
  const weekday = (s: string) => ({ lun: "lunes", mar: "martes", mié: "miércoles", jue: "jueves", vie: "viernes", sáb: "sábado", dom: "domingo" })[s.split(" ")[0]!] ?? "";
  const checkedAt = destinations.map((d) => (d.provenance.kind === "api" ? d.provenance.checkedAt : null)).filter(Boolean).sort()[0];

  return (
    <Main>
      <PageHeader
        size="display"
        title={plan.name}
        subtitle={`Del ${weekday(from)} ${from.split(" ")[1]} al ${weekday(to)} ${to.split(" ")[1]} · salida desde ${airportCity(plan.origin)}${destinations.length ? ` · ${numberWord(destinations.length)} propuestas sobre la mesa` : ""}`}
        actions={
          <>
            <div className="flex flex-col gap-0.5 lg:items-end">
              {closed ? (
                <>
                  <span className="text-[15px] font-bold">Votación cerrada{winner ? ` · ganó ${winner.place.city}` : ""}</span>
                  <span className="text-[13px] text-muted">Votasteis {voted.size} de {plan.partySize}</span>
                </>
              ) : draft ? (
                <>
                  <span className="text-[15px] font-bold">La votación aún no está abierta</span>
                  <span className="text-[13px] text-muted">Mientras tanto, mirad los destinos y comentad</span>
                </>
              ) : (
                <>
                  <span className="text-[15px] font-bold">
                    {voted.size} de {plan.partySize} habéis votado
                  </span>
                  <span className="text-[13px] text-muted">El marcador se abre el {longDate(plan.voteDeadline!)}</span>
                </>
              )}
            </div>
            {!draft && destinations.length > 0 && (
              <Link to={`${base}/votacion`} className={buttonClasses({ variant: "primary", size: "lg" })}>
                {closed ? "Ver el recuento" : myRanking.length ? "Cambiar mi reparto" : "Repartir mis puntos"}
              </Link>
            )}
          </>
        }
      />

      <section className="flex flex-col gap-3 border-b border-line-soft pb-0.5 sm:flex-row sm:items-end sm:justify-between">
        <IconTabs label="Categoría" tabs={TABS} value={category} onChange={setCategory} />
        <button
          type="button"
          aria-expanded={showFilters}
          aria-controls="filtros"
          onClick={() => setShowFilters((x) => !x)}
          className={cn(buttonClasses({ variant: "secondary" }), "mb-2.5 h-[46px] self-start sm:self-auto")}
        >
          <FiltersIcon size={17} />
          Filtros
        </button>
      </section>
      {showFilters && (
        <ScrollRow id="filtros" role="group" aria-label="Filtros">
          <Chip on={onlyDirect} onClick={() => setOnlyDirect((x) => !x)}>
            Solo directos
          </Chip>
          <Chip on={under400} onClick={() => setUnder400((x) => !x)}>
            Hasta 400 € por persona
          </Chip>
        </ScrollRow>
      )}

      {destinations.length === 0 ? (
        <EmptyState title={closed && winnerId ? "Este plan ya se votó" : "Todavía no hay destinos"}>
          {closed ? "La votación está cerrada." : `${group.organiserName} está preparando las propuestas. Os avisará cuando se abra la votación.`}
        </EmptyState>
      ) : ordered.length === 0 ? (
        <EmptyState title="Ningún destino con estos filtros">Prueba con otra categoría o quita algún filtro.</EmptyState>
      ) : (
        <section aria-label="Destinos" className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {ordered.map((d) => (
            <DestinationCard
              key={d.id}
              destination={d}
              plan={plan}
              href={`${base}/destinos/${d.id}`}
              trust={trustOf(d, now)}
              myPosition={myRanking.indexOf(d.id)}
              {...(result ? { points: result.rows.find((r) => r.id === d.id)?.points ?? 0, winner: result.winnerId === d.id } : {})}
              saved={site.saved.includes(d.id)}
              onToggleSave={() => site.toggleSave(d.id)}
            />
          ))}
        </section>
      )}

      {recent.length > 0 && (
      <section className="flex flex-col gap-3.5">
        <SectionHeader
          size="subheading"
          title="Lo último que habéis dicho"
          aside={
            <Link to={`${base}/comentarios`} className="text-sm font-semibold">
              Ver los {comments.length} comentarios
            </Link>
          }
        />
        <div className="grid gap-5 md:grid-cols-3">
          {recent.map((c) => (
            <CommentCard
              key={c.id}
              comment={c}
              author={memberOf(members, c.memberId)}
              place={destinations.find((d) => d.id === c.destinationId)?.place.city ?? ""}
              href={`${base}/destinos/${c.destinationId}#comentarios`}
            />
          ))}
        </div>
      </section>
      )}

      <Footer>
        <div className="flex flex-wrap items-center gap-3.5">
          <span className="text-[13px] font-bold text-muted">Otros planes</span>
          {site.otherPlans.map((p) => (
            <Link key={p.id} to={`/p/${p.id}`} className={chipClasses("nav", p.status === "draft")}>
              {p.name} · {p.status === "draft" ? "borrador" : p.status === "closed" ? (p.winnerCity ?? "cerrado") : "votando"}
            </Link>
          ))}
        </div>
        {checkedAt && (
          <span className="text-[13px] text-muted">
            Precios consultados el {longDate(checkedAt)} de {checkedAt.slice(0, 4)}.
          </span>
        )}
      </Footer>
    </Main>
  );
}
