// Languages (ROADMAP 4). Spanish is the default, so a group that never
// chooses sees nothing change. The group's language is the organiser's
// choice (GroupSettings.locale); each person can switch the site to their
// own on their device.
//
// Copy lives next to the code that shows it, as one object per language
// (`copy({ es, en })`), so whoever translates sees where a string goes and
// TypeScript checks that every language has every string.
import { z } from "zod";

export const LOCALES = ["es", "en"] as const;
export const Locale = z.enum(LOCALES);
export type Locale = z.infer<typeof Locale>;
export const DEFAULT_LOCALE: Locale = "es";

// Each language in its own words, for the switch.
export const LOCALE_NAMES: Record<Locale, string> = { es: "Español", en: "English" };

// For Intl: dates and money. Euros in both; British English writes dates
// day first, as the group does.
export const INTL_LOCALE: Record<Locale, string> = { es: "es-ES", en: "en-GB" };

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as readonly string[]).includes(v);
}

// The language the display helpers (display.ts) write in, in a browser: set
// by the app when the language is chosen. Servers pass a language instead.
let current: Locale = DEFAULT_LOCALE;

export function setLocale(l: Locale): void {
  current = l;
}

export function currentLocale(): Locale {
  return current;
}

// One piece of copy in every language. English must have every key Spanish
// has, with the same shape.
export function copy<T>(c: { es: T; en: NoInfer<T> }): Record<Locale, T> {
  return c;
}

// The copy for a language (the current one by default).
export function pick<T>(c: Record<Locale, T>, l: Locale = current): T {
  return c[l];
}
