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
export const BrowseFlight = FlightExtract.extend({ pageUrl: z.string().nullable() });
export const BrowseStay = StayExtract.extend({ url: z.string().nullable(), pageUrl: z.string().nullable() });
export const browseSchemas = { flight: BrowseFlight, stay: BrowseStay } as const;

export function browseJsonSchema(kind: BrowseKind) {
  return z.toJSONSchema(browseSchemas[kind], { target: "draft-7" });
}

// Only the browser, and only what reading a page needs: no running scripts,
// no files, no cookies or storage by hand (SPEC §8).
export const BROWSE_TOOLS = [
  "browser_navigate",
  "browser_navigate_back",
  "browser_snapshot",
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
  ];
  if (req.kind === "flight") {
    return [
      "Comprueba en Google Flights el precio real del vuelo de un viaje.",
      trip,
      ...manners,
      "Elige el vuelo de ida y vuelta más conveniente (directo si lo hay, a horas razonables) entre los primeros resultados; si hace falta, elige la ida para ver las vueltas.",
      "Extrae el vuelo de ida (outbound) y el de vuelta (inbound): aeropuertos (código IATA), hora de salida y de llegada en ISO 8601 con el desfase horario de cada aeropuerto, compañía, número de vuelo (si no se ve, pon el código de la compañía) y escalas.",
      "Del precio: Google Flights suele mostrarlo por persona e ida y vuelta; ponlo en pricePerPersonEuros. Si muestra un total para varios pasajeros, ponlo en totalEuros y el número en passengers. En euros; si no, null.",
    ].join("\n");
  }
  return [
    "Comprueba en Airbnb el precio real del alojamiento de un viaje.",
    trip,
    ...manners,
    req.stayName
      ? `Ya habían elegido «${req.stayName}»: si la página es ese anuncio, lee su precio para esas fechas. Si no está disponible, dilo en description y deja totalEuros a null.`
      : `Busca un alojamiento entero donde quepan ${c.partySize} personas, bien valorado y bien situado, con buen precio; ábrelo para ver el precio total de esas fechas.`,
    "Extrae el nombre del alojamiento tal como aparece, una descripción corta (tipo, habitaciones, barrio) de menos de 200 caracteres, el precio total de la estancia en euros (todas las noches, con limpieza y tasas), el número de noches y en url la dirección del anuncio (https://www.airbnb…/rooms/…).",
  ].join("\n");
}
