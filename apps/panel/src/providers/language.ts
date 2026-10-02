// The language the AI writes in for the group (ROADMAP 4): the group's, set in
// Ajustes. The instructions stay in Spanish; only what the group will read
// changes language, names of places included.
import { DEFAULT_LOCALE, type Locale } from "@wanderlot/core";

const NAME: Record<Locale, string> = { es: "español de España", en: "inglés británico (British English)" };

export function languageLine(l: Locale = DEFAULT_LOCALE): string {
  return l === "es"
    ? "Todo el texto que verá el grupo, en español de España."
    : `Escribe todo el texto que verá el grupo en ${NAME[l]}, aunque estas instrucciones y sus ejemplos estén en español: títulos, detalles, descripciones y los nombres de ciudades y países (por ejemplo «Lisbon», «Portugal»).`;
}
