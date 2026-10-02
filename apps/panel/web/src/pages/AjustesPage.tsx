import { useEffect, useState } from "react";
import { DEFAULT_LOCALE, LOCALES, LOCALE_NAMES, copy, type Locale } from "@wanderlot/core";
import { Badge, Card, EmptyState, Heading, Notice, PageHeader, RadioCard, Skeleton, Text, useCopy, useLocale, useToast } from "@wanderlot/ui";
import { PanelShell } from "../components/PanelShell.tsx";
import type { AiOption, AiView, BrowserView, Status } from "../data/backend.ts";
import { useLoad, usePanel } from "../data/store.tsx";

const COPY = copy({
  es: {
    search: "Busca en la web",
    noSearch: "No busca en la web: precios estimados",
    images: "lee capturas",
    noImages: "no lee capturas",
    fromSite: "busca desde el sitio",
    siteImagesOnly: "desde el sitio solo lee capturas",
    nowOpens: (name: string) => `Ahora abre ${name}`,
    thatBrowser: "ese navegador",
    failed: (msg: string) => `No se pudo: ${msg}`,
    browserTitle: "Precios reales en el navegador",
    ready: "Listo",
    notSet: "Sin configurar",
    browseOn: (browser: string) =>
      `En las propuestas aprobadas (Revisar) y en El viaje, «Comprobar vuelos» abre una ventana de ${browser} en este ordenador: Claude mira Google Flights y te trae los mejores vuelos, con el precio de la página de reserva, para que elijas uno. El alojamiento se mira a mano en Airbnb (el diálogo de precios tiene el enlace). La ventana usa un perfil suyo, aparte del tuyo: si sale un aviso de cookies o un CAPTCHA, resuélvelo ahí y lo recordará.`,
    yourBrowser: "tu navegador",
    missingInstall: "Falta el paquete del navegador: ejecuta npm install en la carpeta de Wanderlot y reinicia el panel (npm run panel).",
    missingBrowser: "No encontré Chrome, Brave, Edge ni Chromium en este ordenador. Instala uno y reinicia el panel, o pon la ruta del tuyo en WANDERLOT_BROWSER, en el archivo .env.",
    missingClaude: "Necesita el comando claude (Claude Code) en este ordenador. Instálalo y reinicia el panel.",
    browser: "Navegador",
    localeNote: { es: "Lo que ve el grupo, en español.", en: "What the group sees, in English." } as Record<Locale, string>,
    siteIn: (name: string) => `El sitio ya sale en ${name}`,
    groupLanguage: "Idioma del grupo",
    groupLanguageText:
      "El sitio de tus amigos sale en este idioma, y en él escribe la IA los destinos y la guía, y el panel los mensajes para el grupo. Cada uno puede cambiar el sitio para sí en su menú de cuenta. Lo ya escrito se queda como está. Si el sitio no cambia, actualízalo con npm run deploy:site.",
    panelLanguage: "Idioma del panel",
    panelLanguageText: "Solo cambia lo que ves tú en este panel, en este dispositivo. Si no eliges, el panel sale en el idioma del grupo.",
    nowUses: (name: string) => `Ahora usa ${name}`,
    title: "Ajustes",
    subtitle: "La IA que busca destinos, lee capturas y prepara la guía del viaje",
    loadFailed: (error: string) => `No se pudieron leer los ajustes: ${error}`,
    aiInUse: "IA en uso",
    hostedAi: "Aquí la IA lee capturas y, si es Claude por la API u OpenAI, busca destinos y prepara la guía en segundo plano. Usa la primera que tenga clave en el sitio.",
    localAi: "Sin IA también puedes trabajar: añade destinos a mano en Revisar y escribe los precios que veas.",
    noAi: "Ninguna IA configurada",
    noAiHosted: "Guarda una clave en el sitio (abajo) para leer capturas desde el móvil.",
    noAiLocal: "Configura una de las de abajo.",
    estimated: "Esta IA no busca en la web: lo que proponga llega al sitio como «estimado», y conviene comprobar los precios a mano antes de votar.",
    others: "Otras que puedes añadir",
    keys: (hosted: boolean) =>
      `Las claves no se escriben aquí: ${hosted ? "se guardan como secretos del sitio en Cloudflare" : "van en el archivo .env de este ordenador"}, y nunca pasan por el navegador.`,
  },
  en: {
    search: "Searches the web",
    noSearch: "Doesn't search the web: estimated prices",
    images: "reads screenshots",
    noImages: "doesn't read screenshots",
    fromSite: "searches from the site",
    siteImagesOnly: "from the site it only reads screenshots",
    nowOpens: (name: string) => `Now opens ${name}`,
    thatBrowser: "that browser",
    failed: (msg: string) => `Couldn't do it: ${msg}`,
    browserTitle: "Real prices in the browser",
    ready: "Ready",
    notSet: "Not set up",
    browseOn: (browser: string) =>
      `On approved proposals (Review) and in The trip, "Check flights" opens a ${browser} window on this computer: Claude looks at Google Flights and brings you the best flights, with the price from the booking page, for you to pick one. Accommodation is checked by hand on Airbnb (the prices dialog has the link). The window uses its own profile, separate from yours: if a cookie notice or a CAPTCHA appears, deal with it there and it will remember.`,
    yourBrowser: "your browser",
    missingInstall: "The browser package is missing: run npm install in the Wanderlot folder and restart the panel (npm run panel).",
    missingBrowser: "I couldn't find Chrome, Brave, Edge or Chromium on this computer. Install one and restart the panel, or put the path to yours in WANDERLOT_BROWSER, in the .env file.",
    missingClaude: "It needs the claude command (Claude Code) on this computer. Install it and restart the panel.",
    browser: "Browser",
    localeNote: { es: "What the group sees, in Spanish.", en: "What the group sees, in English." } as Record<Locale, string>,
    siteIn: (name: string) => `The site is now in ${name}`,
    groupLanguage: "Group language",
    groupLanguageText:
      "Your friends' site is in this language, and the AI writes the destinations and the guide in it, as does the panel with messages for the group. Each person can switch the site for themselves in their account menu. Anything already written stays as it is. If the site doesn't change, update it with npm run deploy:site.",
    panelLanguage: "Panel language",
    panelLanguageText: "Only changes what you see in this panel, on this device. If you don't choose, the panel follows the group's language.",
    nowUses: (name: string) => `Now using ${name}`,
    title: "Settings",
    subtitle: "The AI that searches for destinations, reads screenshots and prepares the trip guide",
    loadFailed: (error: string) => `Couldn't load the settings: ${error}`,
    aiInUse: "AI in use",
    hostedAi: "Here the AI reads screenshots and, if it's Claude via the API or OpenAI, searches for destinations and prepares the guide in the background. It uses the first one with a key on the site.",
    localAi: "You can work without AI too: add destinations by hand in Review and type in the prices you see.",
    noAi: "No AI set up",
    noAiHosted: "Save a key on the site (below) to read screenshots from your phone.",
    noAiLocal: "Set up one of the ones below.",
    estimated: "This AI doesn't search the web: what it suggests reaches the site as \"estimated\", and it's worth checking the prices by hand before voting.",
    others: "Others you can add",
    keys: (hosted: boolean) =>
      `Keys aren't typed in here: ${hosted ? "they're saved as the site's secrets in Cloudflare" : "they go in this computer's .env file"}, and they never pass through the browser.`,
  },
});

type Copy = (typeof COPY)["es"];

// What each AI can do, in a line; on the site, whether it can search there.
function abilities(t: Copy, o: AiOption, hosted: boolean): string {
  return [
    o.search ? t.search : t.noSearch,
    o.images ? t.images : t.noImages,
    ...(hosted ? [o.background ? t.fromSite : t.siteImagesOnly] : []),
  ].join(" · ");
}

// "Comprobar vuelos" (ROADMAP 3.4): whether it works on this laptop, in
// which browser (any Chromium: Chrome, Brave, Edge), or what it lacks.
function BrowserCard({ status }: { status: Status }) {
  const t = useCopy(COPY);
  const { browsers, chooseBrowser } = usePanel();
  const toast = useToast();
  const { data: view, set } = useLoad<BrowserView>("browsers", browsers);
  const pick = async (id: string) => {
    try {
      const next = await chooseBrowser(id);
      set(next);
      toast(t.nowOpens(next.options.find((o) => o.id === next.active)?.name ?? t.thatBrowser));
    } catch (e) {
      toast(t.failed((e as Error).message));
    }
  };
  return (
    <Card as="section" variant="raised" aria-labelledby="navegador" className="flex flex-col gap-3">
      <span className="flex flex-wrap items-center gap-2">
        <Heading id="navegador" size="subheading">
          {t.browserTitle}
        </Heading>
        <Badge tone={status.browse ? "accent" : "muted"}>{status.browse ? t.ready : t.notSet}</Badge>
      </span>
      <Text tone="muted" size="sm">
        {status.browse
          ? t.browseOn(status.browser ?? t.yourBrowser)
          : status.browseMissing === "install"
            ? t.missingInstall
            : status.browseMissing === "browser"
              ? t.missingBrowser
              : t.missingClaude}
      </Text>
      {status.browse && view && view.options.length > 1 && (
        <div role="radiogroup" aria-label={t.browser} className="flex flex-col gap-2">
          {view.options.map((o) => (
            <RadioCard key={o.id} name="navegador" title={o.name} description={o.path} checked={view.active === o.id} onChange={() => void pick(o.id)} />
          ))}
        </div>
      )}
    </Card>
  );
}

// The group's language (ROADMAP 4): the site starts in it for everyone, and
// each person can still switch it on their own device.
function LanguageCard() {
  const t = useCopy(COPY);
  const { state, saveSettings } = usePanel();
  const toast = useToast();
  const settings = state.settings;
  if (!settings) return null;
  const current = settings.locale ?? DEFAULT_LOCALE;
  const choose = async (locale: Locale) => {
    try {
      await saveSettings({ ...settings, locale });
      toast(t.siteIn(LOCALE_NAMES[locale]));
    } catch (e) {
      toast(t.failed((e as Error).message));
    }
  };
  return (
    <Card as="section" variant="raised" aria-labelledby="idioma" className="flex flex-col gap-3">
      <Heading id="idioma" size="subheading">
        {t.groupLanguage}
      </Heading>
      <Text tone="muted" size="sm">
        {t.groupLanguageText}
      </Text>
      <div role="radiogroup" aria-label={t.groupLanguage} className="flex flex-col gap-2">
        {LOCALES.map((l) => (
          <RadioCard key={l} name="idioma" title={LOCALE_NAMES[l]} description={t.localeNote[l]} checked={current === l} onChange={() => void choose(l)} />
        ))}
      </div>
    </Card>
  );
}

// The panel's own language (ROADMAP 4): what the organiser sees here, on
// this device. Until chosen, the panel follows the group's (PanelLocale).
function PanelLanguageCard() {
  const t = useCopy(COPY);
  const { locale, setLocale } = useLocale();
  return (
    <Card as="section" variant="raised" aria-labelledby="idioma-panel" className="flex flex-col gap-3">
      <Heading id="idioma-panel" size="subheading">
        {t.panelLanguage}
      </Heading>
      <Text tone="muted" size="sm">
        {t.panelLanguageText}
      </Text>
      <div role="radiogroup" aria-label={t.panelLanguage} className="flex flex-col gap-2">
        {LOCALES.map((l) => (
          <RadioCard key={l} name="idioma-panel" title={LOCALE_NAMES[l]} checked={locale === l} onChange={() => setLocale(l)} />
        ))}
      </div>
    </Card>
  );
}

// Ajustes (ROADMAP 3.3): which AI searches destinations, reads screenshots
// and drafts the trip's guide. Keys live in .env or the site's secrets,
// never here: the page says where to put them.
export function AjustesPage() {
  const t = useCopy(COPY);
  const { state, ai, chooseAi } = usePanel();
  const toast = useToast();
  const { data: view, error, set: setView } = useLoad<AiView>("ai", ai);
  const hosted = !!state.status?.hosted;


  const pick = async (o: AiOption) => {
    try {
      setView(await chooseAi(o.id));
      toast(t.nowUses(o.name));
    } catch (e) {
      toast(t.failed((e as Error).message));
    }
  };

  const ready = view?.options.filter((o) => o.ready) ?? [];
  const missing = view?.options.filter((o) => !o.ready) ?? [];

  return (
    <PanelShell trip={false}>
      <main className="mx-auto flex w-full max-w-[900px] flex-col gap-[26px] px-4 py-8 sm:px-8">
        <PageHeader title={t.title} subtitle={t.subtitle} />

        {error && <Notice role="alert">{t.loadFailed(error)}</Notice>}
        {!view && !error && <Skeleton className="h-48 rounded-card" />}

        {view && (
          <Card as="section" variant="raised" aria-labelledby="ia-en-uso" className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <Heading id="ia-en-uso" size="subheading">
                {t.aiInUse}
              </Heading>
              <Text tone="muted" size="sm">
                {hosted ? t.hostedAi : t.localAi}
              </Text>
            </div>
            {ready.length === 0 ? (
              <EmptyState title={t.noAi}>{hosted ? t.noAiHosted : t.noAiLocal}</EmptyState>
            ) : (
              <div role="radiogroup" aria-label={t.aiInUse} className="flex flex-col gap-2">
                {ready.map((o) => (
                  <RadioCard
                    key={o.id}
                    name="ia"
                    title={o.model ? `${o.name} · ${o.model}` : o.name}
                    description={abilities(t, o, hosted)}
                    checked={view.active === o.id}
                    disabled={!view.canChoose}
                    onChange={() => void pick(o)}
                  />
                ))}
              </div>
            )}
            {ready.some((o) => o.id === view.active && !o.search) && (
              <Notice tone="neutral">{t.estimated}</Notice>
            )}
          </Card>
        )}

        <LanguageCard />
        <PanelLanguageCard />

        {!hosted && state.status && <BrowserCard status={state.status} />}

        {missing.length > 0 && (
          <section aria-labelledby="otras-ia" className="flex flex-col gap-3">
            <Heading id="otras-ia" size="subheading">
              {t.others}
            </Heading>
            <Text tone="muted" size="sm">
              {t.keys(hosted)}
            </Text>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {missing.map((o) => (
                <li key={o.id}>
                  <Card variant="muted" className="flex flex-col gap-1.5">
                    <span className="flex flex-wrap items-center gap-2">
                      <strong className="text-[15px]">{o.name}</strong>
                      <Badge tone="muted">{abilities(t, o, hosted)}</Badge>
                    </span>
                    <span className="text-[13px] text-ink-2">{o.setup}</span>
                  </Card>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </PanelShell>
  );
}
