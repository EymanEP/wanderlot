import { Link } from "react-router";
import { copy, relativeTime, type SuggestionView } from "@wanderlot/core";
import { Badge, Button, Card, Heading, useCopy } from "@wanderlot/ui";

const COPY = copy({
  es: {
    title: "Ideas del grupo",
    waiting: (n: number) => `${n} por investigar`,
    allDone: "Todas investigadas",
    ideaOf: (name: string) => `idea de ${name}`,
    researched: "Investigada",
    seeInReview: "Ver en Revisar",
    dismiss: "Descartar",
    research: "Investigar",
    note: (note: string) => `«${note}»`,
  },
  en: {
    title: "The group's ideas",
    waiting: (n: number) => `${n} to research`,
    allDone: "All researched",
    ideaOf: (name: string) => `${name}'s idea`,
    researched: "Researched",
    seeInReview: "View in Review",
    dismiss: "Discard",
    research: "Research",
    note: (note: string) => `“${note}”`,
  },
});

export interface IdeasCardProps {
  ideas: SuggestionView[];
  now: Date;
  // A search is running: one at a time.
  busy: boolean;
  onResearch: (idea: SuggestionView) => void;
  onDismiss: (idea: SuggestionView) => void;
}

// Destinations friends suggested from the site. "Investigar" researches that
// place and credits them on the proposal; dismissed ones drop off the list.
export function IdeasCard({ ideas, now, busy, onResearch, onDismiss }: IdeasCardProps) {
  const t = useCopy(COPY);
  const shown = ideas.filter((i) => i.status !== "dismissed");
  if (shown.length === 0) return null;
  const waiting = shown.filter((i) => i.status === "new").length;
  return (
    <Card as="section" variant="raised" className="flex flex-col gap-3" aria-labelledby="ideas">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Heading id="ideas" size="subheading">
          {t.title}
        </Heading>
        <span className="text-sm text-muted">{waiting ? t.waiting(waiting) : t.allDone}</span>
      </div>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {shown.map((i) => (
          <li key={i.id} aria-label={i.place} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl bg-surface-2 px-3.5 py-3">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span>
                <strong className="font-bold">{i.place}</strong> <span className="text-sm text-muted">· {t.ideaOf(i.member.name)} · {relativeTime(i.createdAt, now)}</span>
              </span>
              {i.note && <span className="text-[13px] text-ink-2">{t.note(i.note)}</span>}
            </div>
            {i.status === "researched" ? (
              <div className="flex items-center gap-2">
                <Badge tone="accent" size="md">
                  {t.researched}
                </Badge>
                {i.proposalId && (
                  <Link to={`/revisar#${i.proposalId}`} className="text-sm font-semibold">
                    {t.seeInReview}
                  </Link>
                )}
              </div>
            ) : (
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => onDismiss(i)}>
                  {t.dismiss}
                </Button>
                <Button variant="primary" disabled={busy} onClick={() => onResearch(i)}>
                  {t.research}
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
