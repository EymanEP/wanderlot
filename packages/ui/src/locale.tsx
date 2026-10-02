// The language the screens are in (ROADMAP 4). The app decides it (the
// person's own choice, or the group's) and everything under the provider
// follows: copy picked with useCopy, and the dates and prices core's display
// helpers write.
import { createContext, useContext, useLayoutEffect, useMemo, type ReactNode } from "react";
import { DEFAULT_LOCALE, setLocale as setDisplayLocale, type Locale } from "@wanderlot/core";

interface LocaleApi {
  locale: Locale;
  // Changes it, where the app lets it change (the site's account menu).
  setLocale: (l: Locale) => void;
}

const Ctx = createContext<LocaleApi>({ locale: DEFAULT_LOCALE, setLocale: () => {} });

export function LocaleProvider({ locale, setLocale = () => {}, children }: { locale: Locale; setLocale?: (l: Locale) => void; children: ReactNode }) {
  // The display helpers read the language as they render: set before then.
  setDisplayLocale(locale);
  useLayoutEffect(() => {
    if (typeof document !== "undefined") document.documentElement.lang = locale;
  }, [locale]);
  const api = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useLocale(): LocaleApi {
  return useContext(Ctx);
}

// A component's copy in the current language.
export function useCopy<T>(c: Record<Locale, T>): T {
  return c[useLocale().locale];
}
