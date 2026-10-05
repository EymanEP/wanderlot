// The trip page's blocks (El viaje): one look for every card, so flights,
// the stay, getting there and the guide read the same on a laptop and a
// phone. Each has a tinted icon, a title line, a short detail (more on
// request) and, on the right, what it costs.
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { copy, duration, euros, eurosGrouped, localTime, shortDate, stopsLabel, type FlightLeg, type GuideItem, type TransportMode, type TransportOption } from "@wanderlot/core";
import {
  Badge,
  BusIcon,
  CameraIcon,
  CarIcon,
  Card,
  ChevronDownIcon,
  ForkIcon,
  Heading,
  HouseIcon,
  InfoIcon,
  PinIcon,
  PlaneIcon,
  StarIcon,
  TrainIcon,
  WalkIcon,
  cn,
  useCopy,
  type IconProps,
} from "@wanderlot/ui";

const COPY = copy({
  es: {
    modes: { car: "Coche", bus: "Autobús", train: "Tren", metro: "Metro", taxi: "Taxi", shuttle: "Lanzadera", walk: "Andando", other: "Otro" } as Record<TransportMode, string>,
    out: "Ida",
    back: "Vuelta",
    perPerson: "por persona",
    returnPerPerson: "ida y vuelta, por persona",
    more: "Ver más",
    less: "Ver menos",
    weTake: "El que cogemos",
    nights: (n: number) => `${n} ${n === 1 ? "noche" : "noches"}`,
    share: (price: string) => `${price} por persona`,
    checkIn: (time: string) => `Entrada ${time}`,
    checkOut: (time: string) => `Salida ${time}`,
    where: "Dónde",
  },
  en: {
    modes: { car: "Car", bus: "Bus", train: "Train", metro: "Metro", taxi: "Taxi", shuttle: "Shuttle", walk: "Walk", other: "Other" },
    out: "Out",
    back: "Back",
    perPerson: "per person",
    returnPerPerson: "return, per person",
    more: "Show more",
    less: "Show less",
    weTake: "The one we take",
    nights: (n: number) => `${n} ${n === 1 ? "night" : "nights"}`,
    share: (price: string) => `${price} per person`,
    checkIn: (time: string) => `Check-in ${time}`,
    checkOut: (time: string) => `Check-out ${time}`,
    where: "Where",
  },
});

// --- the shared pieces ---------------------------------------------------------

export type Tint = "mint" | "sky" | "lilac" | "sand" | "rose" | "claude";

const TINT: Record<Tint, string> = {
  mint: "bg-tint-mint text-accent",
  sky: "bg-tint-sky text-[#2d5f8f]",
  lilac: "bg-tint-lilac text-[#5a4a8c]",
  sand: "bg-tint-sand text-[#7a5a28]",
  rose: "bg-tint-rose text-[#9c3d3d]",
  claude: "bg-claude-soft text-claude",
};

export function IconTile({ icon: Icon, tint, size = "md" }: { icon: (p: IconProps) => ReactNode; tint: Tint; size?: "sm" | "md" }) {
  return (
    <span aria-hidden className={cn("flex shrink-0 items-center justify-center rounded-xl", TINT[tint], size === "md" ? "size-11" : "size-9")}>
      <Icon size={size === "md" ? 20 : 17} />
    </span>
  );
}

// A section's heading with its icon: "✈ Vuelos".
export function SectionTitle({ id, icon, tint, title, aside }: { id: string; icon: (p: IconProps) => ReactNode; tint: Tint; title: string; aside?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
      <span className="flex items-center gap-2.5">
        <IconTile icon={icon} tint={tint} size="sm" />
        <Heading id={id} as="h2" size="subheading">
          {title}
        </Heading>
      </span>
      {aside && <span className="text-[13px] text-muted">{aside}</span>}
    </div>
  );
}

// Details stay to two (or three) lines until asked for, at any width: "Ver
// más" shows only when the text is cut.
function Detail({ text, lines = 2 }: { text: string; lines?: 2 | 3 }) {
  const t = useCopy(COPY);
  const ref = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [long, setLong] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || open) return;
    const measure = () => setLong(el.scrollHeight > el.clientHeight + 1);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text, open]);
  return (
    <span className="flex flex-col items-start gap-0.5">
      <span ref={ref} className={cn("text-[13px] leading-[1.45] text-ink-2", !open && (lines === 2 ? "line-clamp-2" : "line-clamp-3"))}>
        {text}
      </span>
      {(long || open) && (
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="cursor-pointer border-0 bg-transparent p-0 text-xs font-semibold text-accent hover:text-accent-hover">
          {open ? t.less : t.more}
        </button>
      )}
    </span>
  );
}

// --- flights -------------------------------------------------------------------

function Leg({ label, leg }: { label: string; leg: FlightLeg }) {
  const t = useCopy(COPY);
  const minutes = Math.round((Date.parse(leg.arriveAt) - Date.parse(leg.departAt)) / 60_000);
  return (
    <div className="flex flex-col gap-2.5">
      <span className="flex flex-wrap items-center gap-2 text-[13px]">
        <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-bold text-accent-strong">{label}</span>
        <span className="text-muted">
          {shortDate(leg.departAt)} · {leg.carrier} {leg.flightNumber}
        </span>
      </span>
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
        <span className="flex flex-col">
          <span className="text-[22px] leading-none font-extrabold tracking-[-0.02em] tabular-nums">{localTime(leg.departAt)}</span>
          <span className="text-[13px] font-semibold text-muted">{leg.from}</span>
        </span>
        <span className="flex flex-col items-center gap-1 text-center">
          <span className="flex w-full items-center gap-1.5 text-accent">
            <span className="h-px flex-1 bg-line" />
            <PlaneIcon size={15} />
            <span className="h-px flex-1 bg-line" />
          </span>
          <span className="text-xs text-muted">
            {minutes > 0 ? `${duration(minutes)} · ` : ""}
            {stopsLabel(leg.stops).toLowerCase()}
          </span>
        </span>
        <span className="flex flex-col items-end">
          <span className="text-[22px] leading-none font-extrabold tracking-[-0.02em] tabular-nums">{localTime(leg.arriveAt)}</span>
          <span className="text-[13px] font-semibold text-muted">{leg.to}</span>
        </span>
      </div>
      <span className="sr-only">{t.perPerson}</span>
    </div>
  );
}

// Both flights as one card, like boarding passes; or, when only the price
// was checked, the route and what it costs.
export function FlightsCard({ outbound, inbound, details, cents }: { outbound: FlightLeg; inbound: FlightLeg; details: boolean; cents: number }) {
  const t = useCopy(COPY);
  return (
    <Card variant="raised" padding="none" className="flex flex-col">
      {details ? (
        <div className="flex flex-col gap-4 p-4 sm:p-5">
          <Leg label={t.out} leg={outbound} />
          <div className="border-t border-dashed border-line" />
          <Leg label={t.back} leg={inbound} />
        </div>
      ) : (
        <div className="flex items-center gap-3 p-4 sm:p-5">
          <IconTile icon={PlaneIcon} tint="mint" />
          <span className="text-lg font-extrabold">
            {outbound.from} ⇄ {outbound.to}
          </span>
        </div>
      )}
      <div className="flex items-baseline justify-between gap-3 rounded-b-card bg-accent-soft px-4 py-3 sm:px-5">
        <span className="text-[13px] font-semibold text-accent-strong">{t.returnPerPerson}</span>
        <span className="text-lg font-extrabold text-accent-strong tabular-nums">{euros(cents)}</span>
      </div>
    </Card>
  );
}

// --- the stay ------------------------------------------------------------------

export function StayCard({
  name,
  description,
  url,
  totalCents,
  shareCents,
  nights,
  address,
  checkIn,
  checkOut,
}: {
  name: string;
  description?: string | undefined;
  url?: string | undefined;
  totalCents: number;
  shareCents: number;
  nights: number;
  address: string;
  checkIn: string;
  checkOut: string;
}) {
  const t = useCopy(COPY);
  const chip = "inline-flex items-center gap-1.5 rounded-full bg-surface-3 px-3 py-1 text-[13px] font-medium";
  return (
    <Card variant="raised" className="flex flex-col gap-3.5">
      <div className="grid grid-cols-[auto_1fr_auto] items-start gap-x-3.5 gap-y-1">
        <IconTile icon={HouseIcon} tint="sand" />
        <span className="flex min-w-0 flex-col gap-1">
          <span className="text-[15px] font-bold">
            {url ? (
              <a href={url} target="_blank" rel="noreferrer" className="text-ink underline decoration-line underline-offset-2 hover:text-accent">
                {name}
              </a>
            ) : (
              name
            )}
          </span>
          {description && <Detail text={description} />}
        </span>
        <span className="flex flex-col items-end">
          <span className="text-lg font-extrabold tabular-nums">{eurosGrouped(totalCents)}</span>
          <span className="text-xs whitespace-nowrap text-muted">{t.nights(nights)}</span>
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-line-faint pt-3">
        <span className={cn(chip, "bg-accent-soft font-semibold text-accent-strong")}>{t.share(euros(shareCents))}</span>
        {address && (
          <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`} target="_blank" rel="noreferrer" className={cn(chip, "text-ink no-underline hover:text-accent")}>
            <PinIcon size={14} />
            {address}
          </a>
        )}
        {checkIn && <span className={chip}>{t.checkIn(checkIn)}</span>}
        {checkOut && <span className={chip}>{t.checkOut(checkOut)}</span>}
      </div>
    </Card>
  );
}

// --- getting there ---------------------------------------------------------------

const MODE: Record<TransportMode, { icon: (p: IconProps) => ReactNode; tint: Tint }> = {
  car: { icon: CarIcon, tint: "mint" },
  taxi: { icon: CarIcon, tint: "sand" },
  bus: { icon: BusIcon, tint: "sky" },
  shuttle: { icon: BusIcon, tint: "sky" },
  train: { icon: TrainIcon, tint: "lilac" },
  metro: { icon: TrainIcon, tint: "lilac" },
  walk: { icon: WalkIcon, tint: "mint" },
  other: { icon: PinIcon, tint: "rose" },
};

// Ways to cover a stretch, each card the same shape. chosen: the one the
// group takes, when the organiser said.
export function TransportList({ title, options, chosen = null }: { title: string; options: TransportOption[]; chosen?: number | null }) {
  const t = useCopy(COPY);
  return (
    <div className="flex flex-col gap-2.5">
      <Heading as="h3" size="card">
        {title}
      </Heading>
      <ul aria-label={title} className="m-0 flex list-none flex-col gap-2.5 p-0">
        {options.map((o, i) => {
          const { icon, tint } = MODE[o.mode];
          return (
            <li
              key={`${i}:${o.title}`}
              className={cn(
                "grid grid-cols-[auto_1fr_auto] items-start gap-x-3.5 gap-y-1 rounded-tile bg-surface p-4 shadow-card",
                i === chosen && "ring-2 ring-accent",
              )}
            >
              <IconTile icon={icon} tint={tint} />
              <span className="flex min-w-0 flex-col gap-1">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-[15px] font-bold">{o.title}</span>
                  {i === chosen && <Badge tone="accent-solid">{t.weTake}</Badge>}
                </span>
                <span className="text-xs font-semibold text-muted">
                  {t.modes[o.mode]}
                  {o.minutes !== null ? ` · ${duration(o.minutes)}` : ""}
                </span>
                {o.detail && <Detail text={o.detail} />}
              </span>
              <span className="flex flex-col items-end">
                {o.priceCents !== null && <span className="text-lg font-extrabold tabular-nums">≈ {euros(o.priceCents)}</span>}
                {o.priceCents !== null && <span className="text-xs text-muted">{t.perPerson}</span>}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// --- the guide ---------------------------------------------------------------------

const GUIDE = {
  todo: { icon: StarIcon, tint: "mint" },
  food: { icon: ForkIcon, tint: "rose" },
  sights: { icon: CameraIcon, tint: "sky" },
} as const;

// Things to do, eat or see: a grid of cards of the same height.
export function GuideGrid({ kind, title, id, items, price }: { kind: keyof typeof GUIDE; title: string; id: string; items: GuideItem[]; price?: boolean }) {
  const t = useCopy(COPY);
  if (!items.length) return null;
  const { icon, tint } = GUIDE[kind];
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <SectionTitle id={id} icon={icon} tint={tint} title={title} />
      <ul className="m-0 grid list-none auto-rows-fr gap-3 p-0 sm:grid-cols-2">
        {items.map((it) => (
          <li key={it.title} className="flex flex-col gap-2 rounded-tile bg-surface p-4 shadow-card">
            <span className="flex items-start justify-between gap-3">
              <span className="text-[15px] font-bold">{it.title}</span>
              {price && typeof it.priceCents === "number" && (
                <span className="shrink-0 rounded-full bg-accent-soft px-2.5 py-0.5 text-[13px] font-bold text-accent-strong tabular-nums">≈ {euros(it.priceCents)}</span>
              )}
            </span>
            {it.detail && <Detail text={it.detail} lines={3} />}
            {it.where && (
              <span className="mt-auto flex items-center gap-1.5 pt-1 text-xs font-semibold text-muted">
                <PinIcon size={13} aria-label={t.where} />
                {it.where}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

// "Antes de ir": the titles at a glance, each opened when needed.
export function BeforeYouGo({ title, items }: { title: string; items: GuideItem[] }) {
  return (
    <Card variant="raised" className="flex flex-col gap-3" aria-labelledby="antes">
      <span className="flex items-center gap-2.5">
        <IconTile icon={InfoIcon} tint="claude" size="sm" />
        <Heading id="antes" as="h2" size="card">
          {title}
        </Heading>
      </span>
      <div className="flex flex-col divide-y divide-line-faint">
        {items.map((b, i) => (
          <details key={b.title} open={i === 0} className="group py-2.5 first:pt-0 last:pb-0">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-bold [&::-webkit-details-marker]:hidden">
              {b.title}
              <ChevronDownIcon size={15} className="shrink-0 text-muted transition-transform group-open:rotate-180" />
            </summary>
            <p className="m-0 pt-1.5 text-[13px] leading-[1.5] text-ink-2">{b.detail}</p>
          </details>
        ))}
      </div>
    </Card>
  );
}
