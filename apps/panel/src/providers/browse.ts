// "Mirar en Google Flights" / "Mirar en Airbnb" for the finalists: Claude
// opens the real page in a browser window on the organiser's laptop and reads
// the price off it, into the same fields as a screenshot (extract.ts). The
// organiser watches, clears any consent page or CAPTCHA, and reviews the
// result before saving. Few pages, by hand, on their own machine: this is the
// organiser checking prices, not a crawler.
import { z } from "zod";
import { FlightExtract, StayExtract, type ExtractRequest } from "./extract.ts";

export type BrowseKind = ExtractRequest["kind"];

export interface BrowseRequest {
  kind: BrowseKind;
  // The page to start from: the Google Flights search, or the stay (the
  // listing already chosen, or an Airbnb search for the group).
  url: string;
  context: ExtractRequest["context"];
  // The stay already chosen, to check rather than replace.
  stayName?: string;
}

// What was read, plus the page it was read on.
// Flights: the best few round trips, for the organiser to pick one.
export const MAX_FLIGHT_OPTIONS = 5;
export const FlightOption = FlightExtract.extend({
  // Why it's among the best, in a few words: "El más barato", "Directo, por la mañana".
  note: z.string().max(300).nullable(),
  // The price in the results list; pricePerPersonEuros is the one on the
  // booking page, which is what's paid and can differ.
  listedEuros: z.number().nonnegative().nullable(),
  // Followed through to the booking page ("Opciones de reserva").
  checkedToEnd: z.boolean(),
  // Who sells it there ("Ryanair", "Vueling", "eDreams"), and that page.
  bookWith: z.string().max(300).nullable(),
  bookingUrl: z.string().nullable(),
});
// What got in the way when nothing could be read: a CAPTCHA, a notice, a
// different page. In the organiser's words, for the price dialog.
const problem = z.string().max(500).nullable();
export const BrowseFlight = z.object({ options: z.array(FlightOption).max(MAX_FLIGHT_OPTIONS), pageUrl: z.string().nullable(), problem });
// A stay already chosen: its price for the trip's dates.
export const BrowseStay = StayExtract.extend({ url: z.string().nullable(), pageUrl: z.string().nullable(), problem });
// No stay chosen yet: what an Airbnb search shows, for a typical price and a
// few to pick from.
export const MAX_LISTINGS = 20;
export const StayListing = z.object({
  // Long titles are cut here, not refused (browsedFields).
  name: z.string().min(1).max(500),
  description: z.string().max(500).nullable(),
  totalEuros: z.number().nonnegative().nullable(),
  // When the card shows only a price per night.
  nightlyEuros: z.number().nonnegative().nullable(),
  rating: z.number().min(0).max(5).nullable(),
  url: z.string().nullable(),
  // Among the three Claude would suggest.
  recommended: z.boolean(),
});
export const BrowseStaySearch = z.object({ listings: z.array(StayListing).max(MAX_LISTINGS), pageUrl: z.string().nullable(), problem });
export const browseSchemas = { flight: BrowseFlight, stay: BrowseStay, search: BrowseStaySearch } as const;
export type BrowseSchema = keyof typeof browseSchemas;

// Which answer a request wants: a stay already chosen is read as one listing.
export const schemaFor = (req: BrowseRequest): BrowseSchema => (req.kind === "flight" ? "flight" : req.stayName ? "stay" : "search");

export function browseJsonSchema(schema: BrowseSchema) {
  return z.toJSONSchema(browseSchemas[schema], { target: "draft-7" });
}

// Only the browser, and only what reading a page needs: no running scripts,
// no files, no cookies or storage by hand (SPEC §8).
export const BROWSE_TOOLS = [
  "browser_navigate",
  "browser_navigate_back",
  "browser_snapshot",
  "browser_find",
  "browser_take_screenshot",
  "browser_click",
  "browser_type",
  "browser_press_key",
  "browser_select_option",
  "browser_fill_form",
  "browser_mouse_wheel",
  "browser_wait_for",
  "browser_handle_dialog",
  "browser_tabs",
  "browser_close",
].map((t) => `mcp__playwright__${t}`);

// The Airbnb page to start from: the chosen listing for the trip's dates and
// people, or a search for a whole place for the group.
export function airbnbUrl(c: ExtractRequest["context"], listing?: string): string {
  const dates = `check_in=${c.dateFrom}&check_out=${c.dateTo}&adults=${c.partySize}`;
  if (listing && /^https:\/\/(www\.)?airbnb\.[a-z.]+\/rooms\/\d+/.test(listing)) {
    const u = new URL(listing);
    return `${u.origin}${u.pathname}?${dates}`;
  }
  return `https://www.airbnb.es/s/${encodeURIComponent(c.city)}/homes?checkin=${c.dateFrom}&checkout=${c.dateTo}&adults=${c.partySize}&room_types%5B%5D=Entire%20home%2Fapt`;
}

export function browsePrompt(req: BrowseRequest): string {
  const c = req.context;
  const trip = `El viaje: ${c.partySize} personas, de ${c.origin} a ${c.city} (${c.iata}), ida el ${c.dateFrom} y vuelta el ${c.dateTo}, ${c.nights} noches.`;
  const manners = [
    `Abre ${req.url} en el navegador y mira la página tú: es la ventana que ve la persona que organiza.`,
    "Si sale un aviso de cookies, elige rechazar o solo las necesarias. Si sale un CAPTCHA o piden iniciar sesión, espera hasta 90 segundos con browser_wait_for a que la persona lo resuelva en la ventana; si sigue ahí, deja los datos a null.",
    "No reserves, no pagues, no inicies sesión y no rellenes datos personales. Quédate en esa web y lee solo lo necesario, con las menos páginas posible.",
    "Usa solo lo que ves en la página: si un dato no aparece, pon null. En pageUrl pon la dirección de la página donde lo has leído.",
    "Si el navegador no se abre o da error, no busques otra forma: deja los datos a null.",
    "Si la página es muy larga, usa browser_find para buscar los precios (por ejemplo «€») en vez de leerla entera.",
    "Si algo te impide leer lo que se pide (un CAPTCHA que sigue ahí, un aviso, otra página, una lista vacía), dilo en problem en una frase clara para la persona que organiza; si todo fue bien, problem es null.",
  ];
  if (req.kind === "flight") {
    return [
      "Busca en Google Flights las mejores opciones de vuelo de ida y vuelta de un viaje.",
      trip,
      ...manners,
      `Elige hasta ${MAX_FLIGHT_OPTIONS} opciones de ida y vuelta entre los primeros resultados: las que Google marca como mejores, y la más barata si no está entre ellas. Prefiere directos y horas razonables. Apunta el precio que muestra la lista en listedEuros.`,
      "El precio de la lista puede cambiar al final, así que sigue cada opción hasta la página de reserva: elige ese vuelo de ida, luego la vuelta más parecida (directa, a buena hora), hasta que Google muestre las opciones de reserva («Reservar con…»). Ahí lee el precio más barato por persona, ida y vuelta, y quién lo vende. No pulses en reservar ni salgas de Google: vuelve atrás a los resultados para la siguiente opción.",
      "Para cada una: el vuelo de ida (outbound) y el de vuelta (inbound) con aeropuertos (código IATA), hora de salida y de llegada en ISO 8601 con el desfase horario de cada aeropuerto, compañía, número de vuelo (si no se ve, pon el código de la compañía) y escalas.",
      "Del precio de la página de reserva: por persona e ida y vuelta en pricePerPersonEuros; si muestra un total para varios pasajeros, ponlo en totalEuros y el número en passengers. En euros; si no, null. checkedToEnd: true si llegaste a la página de reserva; si no pudiste, false y pon el de la lista en pricePerPersonEuros. En bookWith quién lo vende más barato y en bookingUrl la dirección de esa página de reserva de Google.",
      "En note, en pocas palabras por qué es buena opción (por ejemplo «El más barato» o «Directo, sale por la mañana»). Ordénalas de mejor a peor.",
    ].join("\n");
  }
  if (req.stayName) {
    return [
      "Comprueba en Airbnb el precio real del alojamiento de un viaje.",
      trip,
      ...manners,
      `Ya habían elegido «${req.stayName}»: si la página es ese anuncio, lee su precio para esas fechas. Si no está disponible, dilo en description y deja totalEuros a null.`,
      "Extrae el nombre del alojamiento tal como aparece, una descripción corta (tipo, habitaciones, barrio) de menos de 200 caracteres, el precio total de la estancia en euros (todas las noches, con limpieza y tasas), el número de noches y en url la dirección del anuncio (https://www.airbnb…/rooms/…).",
    ].join("\n");
  }
  return [
    "Mira en Airbnb qué alojamientos hay para un viaje y cuánto cuestan, para saber el precio típico y proponer unos pocos.",
    trip,
    ...manners,
    `La página es una búsqueda de alojamientos enteros para ${c.partySize} personas en esas fechas. Si hay un interruptor para ver el precio total («Mostrar el precio total» o parecido), actívalo. Lee las tarjetas de los resultados, sin abrir cada anuncio: hasta ${MAX_LISTINGS}, bajando por la página si hace falta.`,
    `De cada una: el nombre o título tal como aparece, una descripción corta (tipo, habitaciones, barrio), el precio total de la estancia en euros (totalEuros) si la tarjeta lo muestra («X € en total», «X € por ${c.nights} noches»), o si solo muestra el precio por noche («X € noche»), ese (nightlyEuros). Si una tarjeta muestra un precio tachado y otro rebajado, usa el rebajado. La valoración sobre 5 si aparece, y en url la dirección del anuncio (puede empezar por /rooms/…).`,
    `Marca con recommended: true las 3 que tú propondrías: bien valoradas, con sitio para los ${c.partySize}, bien situadas y a buen precio. Las demás, false.`,
  ].join("\n");
}

// --- what the price dialog gets ----------------------------------------------

const https = (u: unknown) => (typeof u === "string" && /^https:\/\/[^\s]+$/.test(u) ? u : null);
// A link as the page had it, maybe relative ("/rooms/123?…"): made whole
// against the page it was read on, and kept only if it's https.
const absolute = (u: string | null, base: string) => {
  if (!u) return null;
  try {
    return https(new URL(u, base).toString());
  } catch {
    return null;
  }
};
const cut = (s: string | null, n: number) => (s === null ? null : s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const cents = (euros: number | null) => (euros === null ? null : Math.round(euros * 100));
const perPerson = (o: { pricePerPersonEuros: number | null; totalEuros: number | null; passengers: number | null }) =>
  cents(o.pricePerPersonEuros ?? (o.totalEuros !== null && o.passengers ? o.totalEuros / o.passengers : null));

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : Math.round((s[mid - 1]! + s[mid]!) / 2);
}

// A page read in the browser, as the price dialog fills it in: the flights
// to pick from (the best first), one stay's price, or what an Airbnb search
// costs (median, range) with three to pick from.
export function browsedFields(schema: BrowseSchema, raw: unknown, trip: { nights: number }, fallbackUrl: string) {
  if (schema === "flight") {
    const r = BrowseFlight.parse(raw);
    const options = r.options
      .map((o) => ({
        outbound: o.outbound,
        inbound: o.inbound,
        flightCents: perPerson(o) ?? cents(o.listedEuros),
        listedCents: cents(o.listedEuros),
        checkedToEnd: o.checkedToEnd && perPerson(o) !== null,
        bookWith: cut(o.bookWith, 60),
        bookingUrl: https(o.bookingUrl),
        note: cut(o.note, 80),
      }))
      .filter((o): o is typeof o & { flightCents: number } => o.flightCents !== null);
    const best = options[0];
    return { kind: "flight" as const, outbound: best?.outbound ?? null, inbound: best?.inbound ?? null, flightCents: best?.flightCents ?? null, options, pageUrl: https(r.pageUrl) ?? fallbackUrl, problem: cut(r.problem, 300) };
  }
  if (schema === "stay") {
    const r = BrowseStay.parse(raw);
    return { kind: "stay" as const, name: r.name, description: r.description, stayCents: cents(r.totalEuros), nights: r.nights, url: absolute(r.url, fallbackUrl), pageUrl: https(r.pageUrl) ?? fallbackUrl, problem: cut(r.problem, 300) };
  }
  const r = BrowseStaySearch.parse(raw);
  const priced = r.listings
    .map((l) => ({
      name: cut(l.name, 120)!,
      description: cut(l.description, 200),
      rating: l.rating,
      url: absolute(l.url, https(r.pageUrl) ?? fallbackUrl),
      recommended: l.recommended,
      stayCents: cents(l.totalEuros ?? (l.nightlyEuros !== null ? l.nightlyEuros * trip.nights : null)),
    }))
    .filter((l): l is typeof l & { stayCents: number } => l.stayCents !== null && l.stayCents > 0);
  const totals = priced.map((l) => l.stayCents);
  const recommended = priced.filter((l) => l.recommended);
  const picks = (recommended.length ? recommended : [...priced].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))).slice(0, 3).map(({ recommended: _r, ...l }) => l);
  return {
    kind: "stay" as const,
    name: null,
    description: null,
    stayCents: null,
    nights: null,
    url: null,
    pageUrl: https(r.pageUrl) ?? fallbackUrl,
    market: totals.length ? { medianCents: median(totals)!, minCents: Math.min(...totals), maxCents: Math.max(...totals), count: totals.length, picks } : null,
    problem: cut(r.problem, 300),
  };
}
export type Browsed = ReturnType<typeof browsedFields>;
