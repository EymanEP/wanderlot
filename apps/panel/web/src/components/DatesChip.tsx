// A destination's own dates, in a trip that decides them with the place
// (ROADMAP 2.7): "1 – 5 nov".
import { rangeLabel, type Proposal } from "@wanderlot/core";
import { CalendarIcon, cn } from "@wanderlot/ui";

export function DatesChip({ proposal: p, className }: { proposal: Pick<Proposal, "dateFrom" | "dateTo">; className?: string }) {
  if (!p.dateFrom || !p.dateTo) return null;
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-0.5 text-[13px] font-bold text-accent-strong", className)}>
      <CalendarIcon size={13} />
      {rangeLabel(p.dateFrom, p.dateTo)}
    </span>
  );
}
