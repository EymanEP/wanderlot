// "Comprobar vuelos" for the finalists: Claude opens Google Flights in a
// browser window on the organiser's laptop and brings back the best round
// trips, priced as on the booking page, for the organiser to pick one. The
// stay is checked by hand on Airbnb (the price dialog links to the search):
// Airbnb's pages couldn't be read reliably. Few pages, by hand, on their own
// machine: this is the organiser checking prices, not a crawler.
import { z } from "zod";
import { FlightExtract, type ExtractRequest } from "./extract.ts";

export interface BrowseRequest {
  // The Google Flights search to start from.
  url: string;
  context: ExtractRequest["context"];
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
export function browseJsonSchema() {
  return z.toJSONSchema(BrowseFlight, { target: "draft-7" });
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


const https = (u: unknown) => (typeof u === "string" && /^https:\/\/[^\s]+$/.test(u) ? u : null);
const cut = (s: string | null, n: number) => (s === null ? null : s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const cents = (euros: number | null) => (euros === null ? null : Math.round(euros * 100));
const perPerson = (o: { pricePerPersonEuros: number | null; totalEuros: number | null; passengers: number | null }) =>
  cents(o.pricePerPersonEuros ?? (o.totalEuros !== null && o.passengers ? o.totalEuros / o.passengers : null));

// The flights read in the browser, as the price dialog fills them in: the
// best few to pick from, the first filled in.
export function browsedFields(raw: unknown, fallbackUrl: string) {
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
export type Browsed = ReturnType<typeof browsedFields>;
