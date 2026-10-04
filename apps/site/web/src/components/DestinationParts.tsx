// The building blocks of a destination page.
import { useState } from "react";
import { Link } from "react-router";
import { copy, duration, euros, eurosGrouped, localTime, shortDate, standardImageUrl, stopsLabel, stayTotalCents, type Access, type FlightLeg, type Photo as PhotoData, type Stay } from "@wanderlot/core";
import { Button, Card, Dialog, Heading, LockIcon, Photo, Text, buttonClasses, cn, useCopy } from "@wanderlot/ui";

const COPY = copy({
  es: {
    photo: "Foto:",
    photos: "Fotos",
    photoOf: (city: string) => `Foto de ${city}`,
    photosOf: (city: string) => `Fotos de ${city}`,
    seePhotos: (n: number) => (n === 1 ? "Ver la foto" : `Ver las ${n} fotos`),
    close: "Cerrar",
    roundTrip: "Ida y vuelta",
    perPerson: "por persona",
    recommended: " (recomendado)",
    nights: (n: number) => `${n} ${n === 1 ? "noche" : "noches"}`,
    closed: "Votación cerrada",
    open: "Votación en curso",
    got: (points: number, max: number) => `Se llevó ${points} puntos de ${max}.`,
    hidden: (deadline: string, cast: number, of: number) => `Los puntos de cada destino se ven cuando cierre, el ${deadline}. Van ${cast} de ${of} votos.`,
    notOpen: "La votación aún no está abierta.",
    gave: (n: number) => `Le diste ${n} ${n === 1 ? "punto" : "puntos"}`,
    noPoints: "Tú no le has dado puntos",
    count: "Ver el recuento",
    change: "Cambiar",
    give: "Dárselos",
    sources: "De dónde salen los números",
    toAirport: (airport: string) => `Hasta ${airport}`,
    fromHome: (home: string) => `Desde ${home}, ida y vuelta`,
    estimate: "aproximado",
    also: "También",
  },
  en: {
    photo: "Photo:",
    photos: "Photos",
    photoOf: (city: string) => `Photo of ${city}`,
    photosOf: (city: string) => `Photos of ${city}`,
    seePhotos: (n: number) => (n === 1 ? "See the photo" : `See all ${n} photos`),
    close: "Close",
    roundTrip: "Return",
    perPerson: "per person",
    recommended: " (recommended)",
    nights: (n: number) => `${n} ${n === 1 ? "night" : "nights"}`,
    closed: "Voting closed",
    open: "Voting open",
    got: (points: number, max: number) => `It got ${points} of ${max} points.`,
    hidden: (deadline: string, cast: number, of: number) => `Each destination's points show when voting closes, on ${deadline}. ${cast} of ${of} votes so far.`,
    notOpen: "Voting isn't open yet.",
    gave: (n: number) => `You gave it ${n} ${n === 1 ? "point" : "points"}`,
    noPoints: "You haven't given it points",
    count: "See the count",
    change: "Change",
    give: "Give them",
    sources: "Where the numbers come from",
    toAirport: (airport: string) => `To ${airport}`,
    fromHome: (home: string) => `From ${home}, there and back`,
    estimate: "rough",
    also: "Also",
  },
});

export interface MosaicProps {
  city: string;
  photos: PhotoData[];
  // Placeholder names for the tiles until photos are chosen: the landmarks.
  landmarks: string[];
}

const SOURCE_NAME = { unsplash: "Unsplash", pexels: "Pexels", wikimedia: "Wikimedia Commons" } as const;

// "Foto: Ana Pérez · Unsplash": every photo carries its credit (SPEC §6).
function Credit({ photo }: { photo: PhotoData }) {
  const t = useCopy(COPY);
  return (
    <span className="rounded-md bg-ink/60 px-2 py-1 text-[11px] text-white">
      {t.photo}{" "}
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

// Wide screen: the hero and up to four more beside it, laid out for however
// many there are, so no tile is ever left without a photo. Phone: the hero
// and up to two below it.
const WIDE: Record<number, string[]> = {
  1: ["md:col-span-2 md:row-span-2"],
  2: ["md:col-span-2", "md:col-span-2"],
  3: ["md:col-span-2", "", ""],
  4: ["", "", "", ""],
};

export function PhotoMosaic({ city, photos, landmarks }: MosaicProps) {
  const t = useCopy(COPY);
  const [open, setOpen] = useState(false);
  const [hero, ...rest] = photos;

  // No photos yet: the landmarks hold their places (the organiser's preview).
  if (!hero) {
    const placeholder = (i: number, className: string) => <Photo key={i} label={landmarks[i] ?? city} labelPosition="center" className={cn("rounded-xl p-3", className)} />;
    return (
      <section aria-label={t.photos} className="grid h-[240px] grid-cols-2 grid-rows-2 gap-2 sm:h-[312px] md:grid-cols-4">
        <Photo label={t.photoOf(city)} className="col-span-2 row-span-2 rounded-2xl p-4 max-md:row-span-1" />
        {placeholder(0, "")}
        {placeholder(1, "")}
        {placeholder(2, "max-md:hidden")}
        {placeholder(3, "max-md:hidden")}
      </section>
    );
  }

  const shown = rest.slice(0, 4);
  return (
    <>
      <section aria-label={t.photos} className="relative grid h-[240px] grid-cols-2 grid-rows-2 gap-2 sm:h-[312px] md:grid-cols-4">
        <Photo
          src={standardImageUrl(hero.url)}
          alt={hero.alt}
          className={cn("col-span-2 rounded-2xl p-4", shown.length ? "row-span-2 max-md:row-span-1" : "row-span-2 md:col-span-4")}
          bottom={<Credit photo={hero} />}
        />
        {shown.map((photo, i) => (
          <Photo
            key={photo.url}
            src={standardImageUrl(photo.url)}
            alt={photo.alt}
            className={cn("rounded-xl p-3", shown.length === 1 && "col-span-2", i >= 2 && "max-md:hidden", WIDE[shown.length]![i])}
            bottom={<Credit photo={photo} />}
          />
        ))}
        <Button size="sm" className="absolute top-3 right-3 shadow-chip" onClick={() => setOpen(true)}>
          {t.seePhotos(photos.length)}
        </Button>
      </section>
      <Dialog open={open} title={t.photosOf(city)} wide onClose={() => setOpen(false)} actions={<Button onClick={() => setOpen(false)}>{t.close}</Button>}>
        <ul aria-label={t.photosOf(city)} className="m-0 grid max-h-[65vh] list-none grid-cols-1 gap-4 overflow-y-auto p-0 sm:grid-cols-2">
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
// Without its own price when the organiser checked the round trip as a whole.
export function FlightLegRow({ label, leg, price = true }: { label: string; leg: FlightLeg; price?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-x-[18px] gap-y-1 rounded-tile border border-line-soft px-[18px] py-3.5">
      <span className="w-14 shrink-0 text-[13px] font-bold text-muted">{label}</span>
      <span className="shrink-0 text-[15px] font-bold tabular-nums">
        {localTime(leg.departAt)} {leg.from} → {localTime(leg.arriveAt)} {leg.to}
      </span>
      <span className="min-w-0 flex-1 text-sm text-ink-2 max-sm:order-last max-sm:basis-full max-sm:pl-[74px]">
        {shortDate(leg.departAt)} · {leg.carrier} {leg.flightNumber} · {stopsLabel(leg.stops).toLowerCase()}
      </span>
      {price && <span className="ml-auto shrink-0 text-base font-bold tabular-nums">{euros(leg.priceCents)}</span>}
    </div>
  );
}

// "Ida y vuelta  MAD ⇄ NAP  104 € por persona": the price the organiser
// checked, when that's what there is to show.
export function FlightTotalRow({ from, to, cents }: { from: string; to: string; cents: number }) {
  const t = useCopy(COPY);
  return (
    <div className="flex flex-wrap items-center gap-x-[18px] gap-y-1 rounded-tile border border-line-soft px-[18px] py-3.5">
      <span className="shrink-0 text-[13px] font-bold text-muted">{t.roundTrip}</span>
      <span className="shrink-0 text-[15px] font-bold">
        {from} ⇄ {to}
      </span>
      <span className="ml-auto flex shrink-0 items-baseline gap-1.5">
        <span className="text-base font-bold tabular-nums">{euros(cents)}</span>
        <span className="text-xs text-muted">{t.perPerson}</span>
      </span>
    </div>
  );
}

// "Hasta BIO  Coche hasta Bilbao, 2 coches · 1 h 50 m  ≈ 24 € por persona":
// getting to the departure airport and back, counted in the total
// (ROADMAP 2.3).
export function AccessRow({ access, airport }: { access: Access; airport: string }) {
  const t = useCopy(COPY);
  return (
    <div className="flex flex-wrap items-center gap-x-[18px] gap-y-1 rounded-tile border border-line-soft px-[18px] py-3.5">
      <span className="w-14 shrink-0 text-[13px] font-bold text-muted">{t.toAirport(airport)}</span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[15px] font-bold">
          {access.title}
          {access.minutes ? ` · ${duration(access.minutes)}` : ""}
        </span>
        <span className="text-[13px] text-ink-2">{t.fromHome(access.home)}</span>
        {access.alternatives?.length ? (
          <span className="text-[13px] text-muted">
            {t.also}:{" "}
            {access.alternatives.map((o) => `${o.title}${o.minutes ? ` · ${duration(o.minutes)}` : ""} · ${o.checked ? "" : "≈ "}${euros(o.cents)}`).join("; ")}
          </span>
        ) : null}
      </span>
      <span className="ml-auto flex shrink-0 flex-col items-end">
        <span className="text-base font-bold tabular-nums">
          {access.checked ? "" : "≈ "}
          {euros(access.cents)}
        </span>
        <span className="text-xs text-muted">
          {t.perPerson}
          {access.checked ? "" : ` · ${t.estimate}`}
        </span>
      </span>
    </div>
  );
}

export function StayOption({ stay, nights, partySize }: { stay: Stay; nights: number; partySize: number }) {
  const t = useCopy(COPY);
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-[18px] gap-y-2 rounded-tile px-[18px] py-3.5",
        stay.recommended ? "ring-2 ring-accent" : "border border-line-soft",
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <span className="text-[15px] font-bold">
          {stay.url ? (
            <a href={stay.url} target="_blank" rel="noreferrer" className="text-ink underline decoration-line underline-offset-2 hover:text-accent">
              {stay.name}
            </a>
          ) : (
            stay.name
          )}
          {stay.recommended && <span className="sr-only">{t.recommended}</span>}
        </span>
        {stay.description && <span className="text-[13px] text-ink-2">{stay.description}</span>}
      </div>
      <div className="flex shrink-0 flex-col items-end">
        <span className="text-base font-bold tabular-nums">{eurosGrouped(stayTotalCents(stay, nights))}</span>
        <span className="text-xs text-muted">
          {t.nights(nights)} · {euros(Math.ceil(stayTotalCents(stay, nights) / partySize))} {t.perPerson}
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
  const t = useCopy(COPY);
  return (
    <Card variant="raised" className="flex flex-col gap-[13px]">
      <div className="flex items-center gap-2.5">
        <LockIcon size={18} />
        <Heading as="h3" size="card">
          {closed ? t.closed : t.open}
        </Heading>
      </div>
      <Text size="sm">
        {closed
          ? t.got(points ?? 0, of * 6)
          : deadline
            ? t.hidden(deadline, cast, of)
            : t.notOpen}
      </Text>
      <div className="flex items-center justify-between gap-3 border-t border-line-faint pt-[13px]">
        <span className="text-[13px] text-ink-2">{myPoints ? t.gave(myPoints) : t.noPoints}</span>
        <Link to={votingHref} className={buttonClasses({ variant: "soft", size: "sm" })}>
          {closed ? t.count : myPoints ? t.change : t.give}
        </Link>
      </div>
    </Card>
  );
}

export function SourcesCard({ lines }: { lines: string[] }) {
  const t = useCopy(COPY);
  return (
    <Card variant="muted" className="flex flex-col gap-[9px]">
      <Heading as="h3" size="card">
        {t.sources}
      </Heading>
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-[13px] text-ink-2">
        {lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </Card>
  );
}
