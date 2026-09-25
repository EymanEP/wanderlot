import { Link, useParams } from "react-router";
import { rangeLabel } from "@wanderlot/core";
import { placeName } from "@wanderlot/mocks";
import { Badge, EmptyState, Main, PageHeader, buttonClasses } from "@wanderlot/ui";
import { useSite } from "../data/store.tsx";

// Plans other than the current one: the mocks only carry their headline.
export function OtherPlanPage() {
  const { planId } = useParams();
  const { otherPlans, plan: current } = useSite();
  const plan = otherPlans.find((p) => p.id === planId);
  const back = (
    <Link to={`/p/${current.id}`} className={buttonClasses({ variant: "primary" })}>
      Volver a {current.name}
    </Link>
  );
  if (!plan) {
    return (
      <Main>
        <EmptyState title="No encontramos este plan" action={back} />
      </Main>
    );
  }
  return (
    <Main>
      <PageHeader
        size="display"
        title={plan.name}
        subtitle={`${rangeLabel(plan.dateFrom, plan.dateTo)} · ${plan.partySize} personas · salida desde Madrid`}
        actions={<Badge tone={plan.status === "closed" ? "dark" : "neutral"} size="md">{plan.status === "closed" ? "Cerrado" : "Borrador"}</Badge>}
      />
      <EmptyState
        title={plan.status === "closed" ? `Fuimos a ${placeName(plan.winnerDestinationId ?? "")}` : "Todavía no hay destinos"}
        action={back}
      >
        {plan.status === "closed" ? "Este plan ya se votó y se cerró." : "Eyman está preparando las propuestas. Os avisará cuando se abra la votación."}
      </EmptyState>
    </Main>
  );
}
