// The panel's language (ROADMAP 4): what the organiser chose on this device,
// or the group's (Ajustes), or Spanish. The choice is kept in the browser.
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { DEFAULT_LOCALE, currentLocale, isLocale, type Locale } from "@wanderlot/core";
import { LocaleProvider } from "@wanderlot/ui";

const LOCALE_KEY = "wanderlot:panel-locale";

function chosenLocale(): Locale | null {
  try {
    const v = localStorage.getItem(LOCALE_KEY);
    return isLocale(v) ? v : null;
  } catch {
    return null;
  }
}

// So the panel's server answers in the same language.
export const localeHeaders = (): Record<string, string> => ({ "x-wanderlot-locale": currentLocale() });

const GroupCtx = createContext<(l: Locale | null) => void>(() => {});

export function PanelLocale({ children }: { children: ReactNode }) {
  const [chosen, setChosen] = useState<Locale | null>(chosenLocale);
  const [group, setGroup] = useState<Locale | null>(null);
  const choose = useCallback((l: Locale) => {
    setChosen(l);
    try {
      localStorage.setItem(LOCALE_KEY, l);
    } catch {}
  }, []);
  return (
    <GroupCtx.Provider value={setGroup}>
      <LocaleProvider locale={chosen ?? group ?? DEFAULT_LOCALE} setLocale={choose}>
        {children}
      </LocaleProvider>
    </GroupCtx.Provider>
  );
}

// Inside the panel's data: the group's language, once the settings load.
export function useGroupLocale(locale: Locale | null | undefined) {
  const set = useContext(GroupCtx);
  useEffect(() => set(locale ?? null), [locale, set]);
}
