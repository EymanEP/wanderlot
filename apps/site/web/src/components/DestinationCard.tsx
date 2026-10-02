import { Link } from "react-router";
import { checkedLabel, copy, euros, researchLabel, standardImageUrl, type Destination, type Plan } from "@wanderlot/core";
import { Badge, BookmarkIcon, IconButton, Photo, ProvenanceBadge, useCopy, type Trust } from "@wanderlot/ui";
import { placeLine, rankLabel, stayLine } from "../lib/view.ts";

const COPY = copy({
  es: {
    photoOf: (city: string) => `Foto de ${city}`,
    chosen: "Destino elegido",
    checked: "Comprobado",
    unsave: (city: string) => `Quitar ${city} de guardados`,
    save: (city: string) => `Guardar ${city}`,
    points: (n: number) => `${n} puntos`,
    noPoints: "Sin tus puntos",
    ideaOf: (name: string) => `Idea de ${name}`,
    perPerson: "por persona",
  },
  en: {
    photoOf: (city: string) => `Photo of ${city}`,
    chosen: "Chosen destination",
    checked: "Checked",
    unsave: (city: string) => `Remove ${city} from saved`,
    save: (city: string) => `Save ${city}`,
    points: (n: number) => `${n} ${n === 1 ? "point" : "points"}`,
    noPoints: "None of your points",
    ideaOf: (name: string) => `${name}'s idea`,
    perPerson: "per person",
  },
});

export interface DestinationCardProps {
  destination: Destination;
  plan: Plan;
  href: string;
  trust: Trust;
  // Where this viewer ranked it (0-based), or -1. Never the group's tally.
  myPosition: number;
  // Once the vote closes: the destination's points.
  points?: number;
  winner?: boolean;
  saved: boolean;
  onToggleSave: () => void;
}

export function DestinationCard({ destination: d, plan, href, trust, myPosition, points, winner, saved, onToggleSave }: DestinationCardProps) {
  const t = useCopy(COPY);
  return (
    <article className="group relative flex flex-col gap-3.5">
      <Photo
        label={d.photos[0] ? undefined : t.photoOf(d.place.city)}
        src={d.photos[0] ? standardImageUrl(d.photos[0].url) : undefined}
        alt={d.photos[0]?.alt}
        className="h-[240px] rounded-2xl sm:h-[310px]"
        top={
          <>
            {winner ? <Badge tone="dark" size="md">{t.chosen}</Badge> : <ProvenanceBadge trust={trust} size="md" label={trust === "verified" && d.provenance.kind === "organiser" ? (d.provenance.seenOn?.length ? checkedLabel(d.provenance)! : t.checked) : (researchLabel(d.provenance) ?? "short")} />}
            <IconButton
              label={saved ? t.unsave(d.place.city) : t.save(d.place.city)}
              aria-pressed={saved}
              tone="floating"
              size="md"
              onClick={onToggleSave}
              className="relative z-10"
            >
              <BookmarkIcon size={17} fill={saved ? "currentColor" : "none"} />
            </IconButton>
          </>
        }
      />
      <div className="flex flex-col gap-[5px]">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="m-0 text-[17px] font-bold">
            {/* The whole card is the link's hit area. */}
            <Link to={href} className="text-ink no-underline after:absolute after:inset-0 hover:text-ink">
              {d.place.city}
            </Link>
          </h2>
          {points !== undefined ? (
            <Badge tone={winner ? "accent-solid" : "neutral"} size="md">
              {t.points(points)}
            </Badge>
          ) : myPosition >= 0 ? (
            <Badge tone="accent" size="md">
              {rankLabel(myPosition)}
            </Badge>
          ) : (
            <Badge tone="muted" size="md">
              {t.noPoints}
            </Badge>
          )}
        </div>
        <span className="text-sm text-muted">{placeLine(d)}</span>
        <span className="text-sm text-muted">{stayLine(d, plan)}</span>
        {d.suggestedBy && <span className="text-[13px] font-semibold text-accent-strong">{t.ideaOf(d.suggestedBy)}</span>}
        <span className="pt-[3px] text-[15px]">
          <strong className="font-bold tabular-nums">{euros(d.totalPerPersonCents)}</strong> {t.perPerson}
        </span>
      </div>
    </article>
  );
}
