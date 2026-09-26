import { Link } from "react-router";
import { euros, type Destination, type Plan } from "@wanderlot/core";
import { Badge, BookmarkIcon, IconButton, Photo, ProvenanceBadge, type Trust } from "@wanderlot/ui";
import { placeLine, rankLabel, stayLine } from "../lib/view.ts";

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
  return (
    <article className="group relative flex flex-col gap-3.5">
      <Photo
        label={`Foto de ${d.place.city}`}
        className="h-[240px] rounded-2xl sm:h-[310px]"
        top={
          <>
            {winner ? <Badge tone="dark" size="md">Destino elegido</Badge> : <ProvenanceBadge trust={trust} size="md" label={trust === "verified" && d.provenance.kind === "organiser" ? "Comprobado" : "short"} />}
            <IconButton
              label={saved ? `Quitar ${d.place.city} de guardados` : `Guardar ${d.place.city}`}
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
              {points} puntos
            </Badge>
          ) : myPosition >= 0 ? (
            <Badge tone="accent" size="md">
              {rankLabel(myPosition)}
            </Badge>
          ) : (
            <Badge tone="muted" size="md">
              Sin tus puntos
            </Badge>
          )}
        </div>
        <span className="text-sm text-muted">{placeLine(d)}</span>
        <span className="text-sm text-muted">{stayLine(d, plan)}</span>
        <span className="pt-[3px] text-[15px]">
          <strong className="font-bold tabular-nums">{euros(d.totalPerPersonCents)}</strong> por persona
        </span>
      </div>
    </article>
  );
}
