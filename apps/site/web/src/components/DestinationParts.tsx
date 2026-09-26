// The building blocks of a destination page.
import { useState } from "react";
import { Link } from "react-router";
import { euros, eurosGrouped, localTime, shortDate, standardImageUrl, stopsLabel, stayTotalCents, type FlightLeg, type Photo as PhotoData, type Stay } from "@wanderlot/core";
import { Button, Card, Dialog, Heading, LockIcon, Photo, Text, buttonClasses, cn } from "@wanderlot/ui";

export interface MosaicProps {
  city: string;
  photos: PhotoData[];
  // Placeholder names for the tiles until photos are chosen: the landmarks.
  landmarks: string[];
}

const SOURCE_NAME = { unsplash: "Unsplash", pexels: "Pexels", wikimedia: "Wikimedia Commons" } as const;

// "Foto: Ana Pérez · Unsplash": every photo carries its credit (SPEC §6).
function Credit({ photo }: { photo: PhotoData }) {
  return (
    <span className="rounded-md bg-ink/60 px-2 py-1 text-[11px] text-white">
      Foto:{" "}
      <a href={photo.authorUrl ?? photo.sourceUrl} target="_blank" rel="noreferrer" className="text-white underline hover:text-white">
        {photo.author}
      </a>{" "}
      ·{" "}
      <a href={photo.sourceUrl} target="_blank" rel="noreferrer" className="text-white underline hover:text-white">
        {SOURCE_NAME[photo.source]}
      </a>
      {photo.source === "wikimedia" ? ` · ${photo.license}` : ""}
    </span>
  );
}

// The hero and up to four more on a wide screen (two rows of two beside it),
// the hero and two below it on a phone. The last tile opens every photo.
export function PhotoMosaic({ city, photos, landmarks }: MosaicProps) {
  const [open, setOpen] = useState(false);
  const [hero, ...rest] = photos;
  const all = photos.length > 0 && (
    <Button size="sm" className="shadow-chip" onClick={() => setOpen(true)}>
      {photos.length === 1 ? "Ver la foto" : `Ver las ${photos.length} fotos`}
    </Button>
  );
  const tile = (i: number, className: string, withButton: boolean) => {
    const photo = rest[i];
    return (
      <Photo
        key={i}
        label={photo ? undefined : (landmarks[i] ?? city)}
        src={photo ? standardImageUrl(photo.url) : undefined}
        alt={photo?.alt}
        labelPosition="center"
        className={cn("rounded-xl p-3", className)}
        bottom={withButton ? all || undefined : photo ? <Credit photo={photo} /> : undefined}
      />
    );
  };
  return (
    <>
      <section aria-label="Fotos" className="grid h-[240px] grid-cols-2 grid-rows-2 gap-2 sm:h-[312px] md:grid-cols-4">
        <Photo
          label={hero ? undefined : `Foto de ${city}`}
          src={hero ? standardImageUrl(hero.url) : undefined}
          alt={hero?.alt}
          className="col-span-2 row-span-2 rounded-2xl p-4 max-md:row-span-1"
          bottom={hero ? <Credit photo={hero} /> : undefined}
        />
        {tile(0, "", false)}
        {/* Second tile: holds the button on a phone, a photo on a wide screen. */}
        {tile(1, "md:hidden", true)}
        {tile(1, "max-md:hidden", false)}
        {tile(2, "max-md:hidden", false)}
        {tile(3, "max-md:hidden", true)}
      </section>
      <Dialog open={open} title={`Fotos de ${city}`} wide onClose={() => setOpen(false)} actions={<Button onClick={() => setOpen(false)}>Cerrar</Button>}>
        <ul aria-label={`Fotos de ${city}`} className="m-0 grid max-h-[65vh] list-none grid-cols-1 gap-4 overflow-y-auto p-0 sm:grid-cols-2">
          {photos.map((p) => (
            <li key={p.url} className="flex flex-col gap-1.5">
              <Photo src={standardImageUrl(p.url)} alt={p.alt} label={p.alt} labelPosition="center" className="aspect-[4/3] rounded-xl" bottom={<Credit photo={p} />} />
              {p.alt && <span className="text-[13px] text-muted">{p.alt}</span>}
            </li>
          ))}
        </ul>
      </Dialog>
    </>
  );
}

// "Ida  07:20 MAD → 09:55 NAP  sáb 7 nov · Ryanair FR 8564 · directo  52 €"
export function FlightLegRow({ label, leg }: { label: string; leg: FlightLeg }) {
  return (
    <div className="flex flex-wrap items-center gap-x-[18px] gap-y-1 rounded-tile border border-line-soft px-[18px] py-3.5">
      <span className="w-14 shrink-0 text-[13px] font-bold text-muted">{label}</span>
      <span className="shrink-0 text-[15px] font-bold tabular-nums">
        {localTime(leg.departAt)} {leg.from} → {localTime(leg.arriveAt)} {leg.to}
      </span>
      <span className="min-w-0 flex-1 text-sm text-ink-2 max-sm:order-last max-sm:basis-full max-sm:pl-[74px]">
        {shortDate(leg.departAt)} · {leg.carrier} {leg.flightNumber} · {stopsLabel(leg.stops).toLowerCase()}
      </span>
      <span className="ml-auto shrink-0 text-base font-bold tabular-nums">{euros(leg.priceCents)}</span>
    </div>
  );
}

export function StayOption({ stay, nights, partySize }: { stay: Stay; nights: number; partySize: number }) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-[18px] gap-y-2 rounded-tile px-[18px] py-3.5",
        stay.recommended ? "ring-2 ring-accent" : "border border-line-soft",
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <span className="text-[15px] font-bold">
          {stay.name}
          {stay.recommended && <span className="sr-only"> (recomendado)</span>}
        </span>
        {stay.description && <span className="text-[13px] text-ink-2">{stay.description}</span>}
      </div>
      <div className="flex shrink-0 flex-col items-end">
        <span className="text-base font-bold tabular-nums">{eurosGrouped(stayTotalCents(stay, nights))}</span>
        <span className="text-xs text-muted">
          {nights} {nights === 1 ? "noche" : "noches"} · {euros(Math.ceil(stayTotalCents(stay, nights) / partySize))} por persona
        </span>
      </div>
    </div>
  );
}

export interface VoteStatusCardProps {
  closed: boolean;
  deadline: string | null; // "10 de octubre"; null before the vote opens
  cast: number;
  of: number;
  myPoints: number; // 0 if not in my ranking
  points?: number; // the destination's total, once closed
  votingHref: string;
}

export function VoteStatusCard({ closed, deadline, cast, of, myPoints, points, votingHref }: VoteStatusCardProps) {
  return (
    <Card variant="raised" className="flex flex-col gap-[13px]">
      <div className="flex items-center gap-2.5">
        <LockIcon size={18} />
        <Heading as="h3" size="card">
          {closed ? "Votación cerrada" : "Votación en curso"}
        </Heading>
      </div>
      <Text size="sm">
        {closed
          ? `Se llevó ${points ?? 0} puntos de ${of * 6}.`
          : deadline
            ? `Los puntos de cada destino se ven cuando cierre, el ${deadline}. Van ${cast} de ${of} votos.`
            : "La votación aún no está abierta."}
      </Text>
      <div className="flex items-center justify-between gap-3 border-t border-line-faint pt-[13px]">
        <span className="text-[13px] text-ink-2">{myPoints ? `Le diste ${myPoints} ${myPoints === 1 ? "punto" : "puntos"}` : "Tú no le has dado puntos"}</span>
        <Link to={votingHref} className={buttonClasses({ variant: "soft", size: "sm" })}>
          {closed ? "Ver el recuento" : myPoints ? "Cambiar" : "Dárselos"}
        </Link>
      </div>
    </Card>
  );
}

export function SourcesCard({ lines }: { lines: string[] }) {
  return (
    <Card variant="muted" className="flex flex-col gap-[9px]">
      <Heading as="h3" size="card">
        De dónde salen los números
      </Heading>
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-[13px] text-ink-2">
        {lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </Card>
  );
}
