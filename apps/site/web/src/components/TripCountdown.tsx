// The countdown at the top of El viaje: the days left in big rolling digits,
// a clock that ticks to take-off, and a plane flying the last eight weeks to
// the destination. Once the trip starts it counts its days instead, and after
// it ends it's gone. All the movement is GSAP, and none of it runs for
// whoever asks their system for less motion: they see the same card, still.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { copy, localTime, shortDate, tripCountdown, type Countdown } from "@wanderlot/core";
import { cn, motionOk, useCopy } from "@wanderlot/ui";

const COPY = copy({
  es: {
    eyebrow: "Cuenta atrás",
    days: (n: number): string => (n === 1 ? "día" : "días"),
    hoursBig: (n: number): string => (n === 1 ? "hora" : "horas"),
    to: (city: string) => `para ${city}`,
    hours: "horas",
    minutes: "min",
    seconds: "seg",
    takeOff: (date: string, time: string, from: string) => `Despegamos el ${date} a las ${time} desde ${from}`,
    leave: (date: string) => `Nos vamos el ${date}`,
    today: "¡Hoy nos vamos!",
    tomorrow: "¡Mañana nos vamos!",
    thisWeek: "Esta semana nos vamos: toca hacer la maleta",
    weeks: (n: number) => `Quedan ${n} semanas: id mirando qué llevar`,
    far: "Aún queda, pero ya está decidido",
    left: (d: number, h: number, m: number, city: string) =>
      `Quedan ${d} ${d === 1 ? "día" : "días"}, ${h} ${h === 1 ? "hora" : "horas"} y ${m} ${m === 1 ? "minuto" : "minutos"} para ${city}`,
    day: "Día",
    of: (n: number) => `de ${n}`,
    in: (city: string) => `en ${city}`,
    enjoy: (city: string) => `¡Disfrutad de ${city}!`,
    lastDay: "Último día: aprovechadlo",
    during: (d: number, n: number, city: string) => `Día ${d} de ${n} en ${city}`,
    first: "Día 1",
    last: (n: number) => `Día ${n}`,
  },
  en: {
    eyebrow: "Countdown",
    days: (n: number) => (n === 1 ? "day" : "days"),
    hoursBig: (n: number) => (n === 1 ? "hour" : "hours"),
    to: (city: string) => `to ${city}`,
    hours: "hours",
    minutes: "min",
    seconds: "sec",
    takeOff: (date: string, time: string, from: string) => `We take off on ${date} at ${time} from ${from}`,
    leave: (date: string) => `We leave on ${date}`,
    today: "We leave today!",
    tomorrow: "We leave tomorrow!",
    thisWeek: "We leave this week: time to pack",
    weeks: (n: number) => `${n} weeks to go: start thinking about what to bring`,
    far: "Still a while, but it's decided",
    left: (d: number, h: number, m: number, city: string) =>
      `${d} ${d === 1 ? "day" : "days"}, ${h} ${h === 1 ? "hour" : "hours"} and ${m} ${m === 1 ? "minute" : "minutes"} to ${city}`,
    day: "Day",
    of: (n: number) => `of ${n}`,
    in: (city: string) => `in ${city}`,
    enjoy: (city: string) => `Enjoy ${city}!`,
    lastDay: "Last day: make the most of it",
    during: (d: number, n: number, city: string) => `Day ${d} of ${n} in ${city}`,
    first: "Day 1",
    last: (n: number) => `Day ${n}`,
  },
});

// The flight path: a curve from origin to destination, drawn in a box of
// this shape and stretched to the card's width at a fixed height.
const P0 = { x: 30, y: 92 };
const P1 = { x: 300, y: -4 };
const P2 = { x: 570, y: 92 };
const PATH = `M${P0.x} ${P0.y} Q${P1.x} ${P1.y} ${P2.x} ${P2.y}`;
const VIEW = { w: 600, h: 112 };
const pct = (p: { x: number; y: number }) => ({ left: `${(p.x / VIEW.w) * 100}%`, top: `${(p.y / VIEW.h) * 100}%` });

// A point on the curve, and the curve up to it (for the stretch already flown).
function along(t: number): { x: number; y: number; dx: number; dy: number; flown: string } {
  const u = 1 - t;
  const x = u * u * P0.x + 2 * u * t * P1.x + t * t * P2.x;
  const y = u * u * P0.y + 2 * u * t * P1.y + t * t * P2.y;
  const dx = 2 * u * (P1.x - P0.x) + 2 * t * (P2.x - P1.x);
  const dy = 2 * u * (P1.y - P0.y) + 2 * t * (P2.y - P1.y);
  const c = { x: P0.x + (P1.x - P0.x) * t, y: P0.y + (P1.y - P0.y) * t };
  return { x, y, dx, dy, flown: `M${P0.x} ${P0.y} Q${c.x} ${c.y} ${x} ${y}` };
}

// The plane at t, nose along the curve as it looks once stretched.
function placePlane(el: HTMLElement | null, flown: SVGPathElement | null, t: number) {
  const p = along(t);
  if (el) {
    const box = el.parentElement?.getBoundingClientRect();
    const sx = box?.width ? box.width / VIEW.w : 1;
    const sy = box?.height ? box.height / VIEW.h : 1;
    const angle = (Math.atan2(p.dy * sy, p.dx * sx) * 180) / Math.PI;
    Object.assign(el.style, pct(p));
    el.style.transform = `translate(-50%, -50%) rotate(${angle}deg)`;
  }
  flown?.setAttribute("d", p.flown);
}

const pad = (n: number) => String(n).padStart(2, "0");

export function TripCountdown({
  dateFrom,
  dateTo,
  departAt,
  from,
  to,
  city,
  now,
}: {
  dateFrom: string;
  dateTo: string;
  // The outbound flight's departure, when its time is known.
  departAt: string | null;
  from: string;
  to: string;
  city: string;
  now: Date;
}) {
  const t = useCopy(COPY);
  // The page's "now" moves on with the real clock, one second at a time.
  const [clock, setClock] = useState(now);
  useEffect(() => {
    const started = Date.now();
    setClock(now);
    const id = window.setInterval(() => setClock(new Date(now.getTime() + Date.now() - started)), 1000);
    return () => window.clearInterval(id);
  }, [now]);
  const c = tripCountdown({ dateFrom, dateTo, departAt }, clock);
  if (c.phase === "after") return null;
  return <Card c={c} t={t} from={from} to={to} city={city} dateFrom={dateFrom} departAt={departAt} />;
}

type T = (typeof COPY)["es"];

function message(c: Extract<Countdown, { phase: "before" }>, t: T): string {
  if (c.calendarDays === 0) return t.today;
  if (c.calendarDays === 1) return t.tomorrow;
  if (c.calendarDays <= 7) return t.thisWeek;
  if (c.calendarDays <= 56) return t.weeks(Math.round(c.calendarDays / 7));
  return t.far;
}

function Card({ c, t, from, to, city, dateFrom, departAt }: { c: Exclude<Countdown, { phase: "after" }>; t: T; from: string; to: string; city: string; dateFrom: string; departAt: string | null }) {
  const root = useRef<HTMLElement>(null);
  const plane = useRef<HTMLDivElement>(null);
  const flown = useRef<SVGPathElement>(null);
  const before = c.phase === "before";
  // Under a day to go, the hours take over the big number.
  const inHours = before && c.days === 0;
  const big = before ? (inHours ? c.hours : c.days) : c.day;
  // Rounded so the plane only moves when it's visible, not every second.
  const progress = Math.round(c.progress * 1000) / 1000;
  const party = before ? c.calendarDays <= 1 : c.day === 1;

  // Where everything rests: the plane at its spot on the curve.
  useLayoutEffect(() => placePlane(plane.current, flown.current, progress), [progress]);

  // The entrance: the digits spin into place, the route draws itself and the
  // plane flies to where we are; then the card keeps breathing.
  useLayoutEffect(() => {
    const el = root.current;
    if (!el || !motionOk()) return;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.from("[data-cd=glow]", { scale: 0.6, opacity: 0, duration: 1.4, stagger: 0.15, ease: "power2.out" }, 0);
      tl.from("[data-cd=eyebrow] > *", { y: 12, opacity: 0, duration: 0.5, stagger: 0.08 }, 0.1);
      spin(el, tl, 0.15);
      tl.from("[data-cd=unit]", { x: -16, opacity: 0, duration: 0.6, stagger: 0.08 }, 0.7);
      tl.from("[data-cd=tile]", { y: 24, scale: 0.7, opacity: 0, duration: 0.7, stagger: 0.09, ease: "back.out(2.2)" }, 0.8);
      tl.from("[data-cd=route]", { opacity: 0, duration: 0.8 }, 0.5);
      tl.from("[data-cd=end]", { scale: 0, duration: 0.5, stagger: 0.25, ease: "back.out(3)" }, 0.6);
      const ride = { t: 0 };
      tl.to(ride, { t: progress, duration: 2.2, ease: "power2.inOut", onUpdate: () => placePlane(plane.current, flown.current, ride.t) }, 0.9);
      tl.from(plane.current, { opacity: 0, duration: 0.3 }, 0.9);
      tl.from("[data-cd=line]", { y: 10, opacity: 0, duration: 0.6, stagger: 0.1 }, 1.4);
      if (party) tl.add(() => confetti(el), 1.6);

      // Always on, quietly: the plane rides the air, the clouds drift, the
      // destination pings and the sky twinkles.
      gsap.to("[data-cd=bob]", { y: -4, duration: 1.6, ease: "sine.inOut", yoyo: true, repeat: -1 });
      gsap.utils.toArray<HTMLElement>("[data-cd=cloud]").forEach((cloud, i) => {
        gsap.to(cloud, { x: i % 2 ? -60 : 60, duration: 14 + i * 5, ease: "sine.inOut", yoyo: true, repeat: -1 });
      });
      gsap.to("[data-cd=route]", { strokeDashoffset: -10.5, duration: 0.9, ease: "none", repeat: -1 });
      gsap.fromTo("[data-cd=ping]", { scale: 1, opacity: 0.8 }, { scale: 3.4, opacity: 0, duration: 1.8, ease: "power2.out", repeat: -1 });
      gsap.utils.toArray<HTMLElement>("[data-cd=star]").forEach((star) => {
        gsap.to(star, { opacity: gsap.utils.random(0.1, 0.4), scale: gsap.utils.random(0.6, 1.4), duration: gsap.utils.random(1.2, 2.6), ease: "sine.inOut", yoyo: true, repeat: -1, delay: gsap.utils.random(0, 2) });
      });
    }, el);
    return () => ctx.revert();
    // The entrance runs once per trip page; the clock ticking doesn't replay it.
  }, []);

  // A new day turns the big number over again.
  const shown = useRef(big);
  useLayoutEffect(() => {
    if (shown.current === big) return;
    shown.current = big;
    if (root.current && motionOk()) spin(root.current, gsap.timeline(), 0);
  }, [big]);

  const replay = () => {
    if (root.current && motionOk()) spin(root.current, gsap.timeline(), 0);
  };

  const label = before ? t.left(c.days, c.hours, c.minutes, city) : t.during(c.day, c.of, city);
  return (
    <section
      ref={root}
      aria-label={t.eyebrow}
      className="relative isolate overflow-hidden rounded-card bg-[linear-gradient(135deg,#073f39_0%,#0a524a_38%,#0e6b60_72%,#16897c_100%)] px-5 pt-5 pb-4 text-white shadow-raised sm:px-8 sm:pt-7"
    >
      <Sky />
      <span className="sr-only">{label}</span>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between lg:gap-10" aria-hidden="true">
        <div className="flex flex-col gap-3">
          <div data-cd="eyebrow" className="flex flex-wrap items-center gap-2 text-[13px] font-bold">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1 ring-1 ring-white/15 backdrop-blur">
              <span className="relative flex size-2">
                <span className="absolute inset-0 animate-ping rounded-full bg-[#7ff0dc] opacity-70 motion-reduce:animate-none" />
                <span className="relative size-2 rounded-full bg-[#7ff0dc]" />
              </span>
              {t.eyebrow}
            </span>
            <span className="rounded-full px-1 text-white/70">
              {from} → {to}
            </span>
          </div>

          <div className="flex items-end gap-4">
            <button
              type="button"
              tabIndex={-1}
              onClick={replay}
              className="flex cursor-pointer items-end gap-2 border-0 bg-transparent p-0 text-left text-white"
            >
              {!before && (
                <span data-cd="unit" className="pb-[0.16em] text-[22px] font-bold text-white/80 sm:text-[26px]">
                  {t.day}
                </span>
              )}
              <Reel value={big} />
            </button>
            <span className="flex flex-col pb-[10px] sm:pb-[16px]">
              <span data-cd="unit" className="text-[26px] leading-none font-extrabold tracking-[-0.02em] sm:text-[34px]">
                {before ? (inHours ? t.hoursBig(c.hours) : t.days(c.days)) : t.of(c.of)}
              </span>
              <span data-cd="unit" className="text-[15px] font-semibold text-white/75 sm:text-[17px]">
                {before ? t.to(city) : t.in(city)}
              </span>
            </span>
          </div>
        </div>

        {before && (
          <div className="flex gap-2.5 sm:gap-3">
            {!inHours && <Tile value={c.hours} unit={t.hours} />}
            <Tile value={c.minutes} unit={t.minutes} />
            <Tile value={c.seconds} unit={t.seconds} />
          </div>
        )}
      </div>

      <Route
        progress={progress}
        plane={plane}
        flown={flown}
        startLabel={before ? from : t.first}
        endLabel={before ? to : t.last(c.of)}
      />

      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6" aria-hidden="true">
        <span data-cd="line" className="text-[17px] font-extrabold tracking-[-0.01em]">
          {before ? message(c, t) : c.day === c.of ? t.lastDay : t.enjoy(city)}
        </span>
        {before && (
          <span data-cd="line" className="text-[13px] text-white/70">
            {departAt ? t.takeOff(shortDate(dateFrom), localTime(departAt), from) : t.leave(shortDate(dateFrom))}
          </span>
        )}
      </div>
    </section>
  );
}

// The big number, one reel per digit, like an airport's flap board.
const LOOPS = 3;
function Reel({ value }: { value: number }) {
  const digits = String(value).split("").map(Number);
  return (
    <span className="flex overflow-hidden text-[88px] leading-[0.92] font-extrabold tracking-[-0.05em] tabular-nums sm:text-[124px]">
      {digits.map((d, i) => (
        <span key={`${digits.length}-${i}`} className="relative h-[0.92em] overflow-hidden" style={{ width: "0.62em" }}>
          <span
            data-cd="strip"
            data-digit={d}
            className="absolute inset-x-0 top-0 flex flex-col"
            style={{ transform: `translateY(-${((LOOPS - 1) * 10 + d) * (100 / (LOOPS * 10))}%)` }}
          >
            {Array.from({ length: LOOPS * 10 }, (_, k) => (
              <span key={k} className="block h-[0.92em] text-center">
                {k % 10}
              </span>
            ))}
          </span>
        </span>
      ))}
    </span>
  );
}

// Every reel spins through its digits and lands on its own, the last one
// longest, with a little overshoot.
function spin(root: HTMLElement, tl: gsap.core.Timeline, at: number) {
  const strips = [...root.querySelectorAll<HTMLElement>("[data-cd=strip]")];
  // From here GSAP places the strips; React's resting position steps aside.
  for (const strip of strips) strip.style.transform = "";
  strips.forEach((strip, i) => {
    const d = Number(strip.dataset.digit);
    const end = -((LOOPS - 1) * 10 + d) * (100 / (LOOPS * 10));
    tl.fromTo(
      strip,
      { yPercent: 0, y: 0, filter: "blur(6px)" },
      { yPercent: end, filter: "blur(0px)", duration: 1.5 + i * 0.35, ease: "expo.out", overwrite: true },
      at + i * 0.06,
    );
  });
}

// One unit of the clock, its digits flipping in as they change.
function Tile({ value, unit }: { value: number; unit: string }) {
  return (
    <span data-cd="tile" className="flex min-w-[72px] flex-col items-center gap-1 rounded-[16px] bg-white/10 px-3 pt-2.5 pb-2 ring-1 ring-white/15 backdrop-blur-sm sm:min-w-[84px]">
      <span className="flex text-[34px] leading-none font-extrabold tracking-[-0.03em] tabular-nums sm:text-[40px]" style={{ perspective: "300px" }}>
        {pad(value)
          .split("")
          .map((ch, i) => (
            <Flip key={i} ch={ch} />
          ))}
      </span>
      <span className="text-[11px] font-bold tracking-[0.08em] text-white/65 uppercase">{unit}</span>
    </span>
  );
}

function Flip({ ch }: { ch: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const last = useRef(ch);
  useLayoutEffect(() => {
    if (last.current === ch) return;
    last.current = ch;
    if (!ref.current || !motionOk()) return;
    gsap.fromTo(ref.current, { rotateX: -90, yPercent: -30, opacity: 0 }, { rotateX: 0, yPercent: 0, opacity: 1, duration: 0.5, ease: "back.out(2)", overwrite: true });
  }, [ch]);
  return (
    <span ref={ref} className="inline-block w-[0.62em] text-center" style={{ transformOrigin: "50% 0%" }}>
      {ch}
    </span>
  );
}

function Route({
  progress,
  plane,
  flown,
  startLabel,
  endLabel,
}: {
  progress: number;
  plane: React.RefObject<HTMLDivElement | null>;
  flown: React.RefObject<SVGPathElement | null>;
  startLabel: string;
  endLabel: string;
}) {
  return (
    <div className="relative mt-4 mb-8 h-[78px] sm:mx-2 sm:h-[112px]" aria-hidden="true">
      <svg viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible">
        <defs>
          <linearGradient id="cd-flown" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#7ff0dc" stopOpacity="0.35" />
            <stop offset="1" stopColor="#ffffff" />
          </linearGradient>
        </defs>
        <path data-cd="route" d={PATH} fill="none" stroke="white" strokeOpacity={0.4} strokeWidth={2.5} strokeLinecap="round" strokeDasharray="0.5 10" vectorEffect="non-scaling-stroke" />
        <path ref={flown} d={along(progress).flown} fill="none" stroke="url(#cd-flown)" strokeWidth={3} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <span data-cd="end" className="absolute size-3 -translate-1/2 rounded-full bg-[#7ff0dc] ring-4 ring-[#7ff0dc]/25" style={pct(P0)} />
      <span data-cd="end" className="absolute size-3.5 -translate-1/2" style={pct(P2)}>
        <span data-cd="ping" className="absolute inset-0 rounded-full border-2 border-white" />
        <span className="absolute inset-0 rounded-full bg-white shadow-[0_0_18px_rgba(255,255,255,0.7)]" />
      </span>
      <span className="absolute mt-3 -translate-x-1/2 text-[12px] font-bold tracking-[0.04em] whitespace-nowrap text-white/75" style={pct(P0)}>
        {startLabel}
      </span>
      <span className="absolute mt-3 -translate-x-1/2 text-[12px] font-bold tracking-[0.04em] whitespace-nowrap text-white/75" style={pct(P2)}>
        {endLabel}
      </span>
      <div ref={plane} className="absolute size-9 drop-shadow-[0_6px_10px_rgba(0,0,0,0.35)] sm:size-11">
        <div data-cd="bob" className="size-full">
          <svg viewBox="0 0 24 24" className="size-full" fill="white">
            <path d="M21.6 12c0-.9-1-1.4-2-1.4h-4.9L9.4 3.5H7.3l2.8 7.1H5.5L3.6 8.3H2l1.2 3.7L2 15.7h1.6l1.9-2.3h4.6l-2.8 7.1h2.1l5.3-7.1h4.9c1 0 2-.5 2-1.4Z" />
          </svg>
        </div>
      </div>
    </div>
  );
}

// The sky behind it: two soft glows, drifting clouds and a few stars.
const STARS = [
  [8, 18],
  [22, 8],
  [37, 24],
  [55, 10],
  [68, 30],
  [81, 14],
  [93, 26],
  [47, 40],
  [14, 44],
  [88, 46],
] as const;
function Sky() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
      <div data-cd="glow" className="absolute -top-24 -right-16 size-72 rounded-full bg-[#7ff0dc]/25 blur-3xl" />
      <div data-cd="glow" className="absolute -bottom-28 -left-20 size-80 rounded-full bg-[#f6c879]/15 blur-3xl" />
      <div data-cd="cloud" className="absolute top-[18%] left-[12%] h-10 w-44 rounded-full bg-white/[0.07] blur-xl" />
      <div data-cd="cloud" className="absolute top-[52%] right-[8%] h-12 w-56 rounded-full bg-white/[0.06] blur-xl" />
      <div data-cd="cloud" className="absolute bottom-[12%] left-[38%] h-8 w-36 rounded-full bg-white/[0.05] blur-xl" />
      {STARS.map(([x, y], i) => (
        <span key={i} data-cd="star" className={cn("absolute rounded-full bg-white/30", i % 3 ? "size-1" : "size-1.5")} style={{ left: `${x}%`, top: `${y}%` }} />
      ))}
    </div>
  );
}

// Confetti for the day before and the day itself.
const CONFETTI = ["#7ff0dc", "#ffffff", "#f6c879", "#f29b8f", "#b8d8ff"];
function confetti(root: HTMLElement) {
  const box = root.getBoundingClientRect();
  for (let i = 0; i < 70; i++) {
    const bit = document.createElement("span");
    const w = gsap.utils.random(6, 11);
    bit.setAttribute("aria-hidden", "true");
    Object.assign(bit.style, {
      position: "absolute",
      left: `${box.width * gsap.utils.random(0.2, 0.8)}px`,
      top: `${box.height * 0.45}px`,
      width: `${w}px`,
      height: `${w * gsap.utils.random(0.4, 1)}px`,
      borderRadius: i % 3 ? "2px" : "50%",
      background: CONFETTI[i % CONFETTI.length]!,
      pointerEvents: "none",
      zIndex: "5",
    });
    root.appendChild(bit);
    const tl = gsap.timeline({ onComplete: () => bit.remove() });
    tl.to(bit, { x: gsap.utils.random(-260, 260), duration: 2.4, ease: "power2.out" }, 0)
      .to(bit, { y: gsap.utils.random(-220, -120), duration: 0.7, ease: "power2.out" }, 0)
      .to(bit, { y: box.height, duration: 1.7, ease: "power1.in" }, 0.7)
      .to(bit, { rotation: gsap.utils.random(-540, 540), rotationX: gsap.utils.random(-360, 360), duration: 2.4, ease: "none" }, 0)
      .to(bit, { opacity: 0, duration: 0.4 }, 2);
  }
}
