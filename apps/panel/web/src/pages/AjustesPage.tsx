import { useEffect, useState } from "react";
import { DEFAULT_LOCALE, LOCALES, LOCALE_NAMES, type Locale } from "@wanderlot/core";
import { Badge, Card, EmptyState, Heading, Notice, PageHeader, RadioCard, Skeleton, Text, useToast } from "@wanderlot/ui";
import { PanelShell } from "../components/PanelShell.tsx";
import type { AiOption, AiView, BrowserView, Status } from "../data/backend.ts";
import { useLoad, usePanel } from "../data/store.tsx";

// What each AI can do, in a line; on the site, whether it can search there.
function abilities(o: AiOption, hosted: boolean): string {
  return [
    o.search ? "Busca en la web" : "No busca en la web: precios estimados",
    o.images ? "lee capturas" : "no lee capturas",
    ...(hosted ? [o.background ? "busca desde el sitio" : "desde el sitio solo lee capturas"] : []),
  ].join(" · ");
}

// "Comprobar vuelos" (ROADMAP 3.4): whether it works on this laptop, in
// which browser (any Chromium: Chrome, Brave, Edge), or what it lacks.
function BrowserCard({ status }: { status: Status }) {
  const { browsers, chooseBrowser } = usePanel();
  const toast = useToast();
  const { data: view, set } = useLoad<BrowserView>("browsers", browsers);
  const pick = async (id: string) => {
    try {
      const next = await chooseBrowser(id);
      set(next);
      toast(`Ahora abre ${next.options.find((o) => o.id === next.active)?.name ?? "ese navegador"}`);
    } catch (e) {
      toast(`No se pudo: ${(e as Error).message}`);
    }
  };
  return (
    <Card as="section" variant="raised" aria-labelledby="navegador" className="flex flex-col gap-3">
      <span className="flex flex-wrap items-center gap-2">
        <Heading id="navegador" size="subheading">
          Precios reales en el navegador
        </Heading>
        <Badge tone={status.browse ? "accent" : "muted"}>{status.browse ? "Listo" : "Sin configurar"}</Badge>
      </span>
      <Text tone="muted" size="sm">
        {status.browse
          ? `En las propuestas aprobadas (Revisar) y en El viaje, «Comprobar vuelos» abre una ventana de ${status.browser ?? "tu navegador"} en este ordenador: Claude mira Google Flights y te trae los mejores vuelos, con el precio de la página de reserva, para que elijas uno. El alojamiento se mira a mano en Airbnb (el diálogo de precios tiene el enlace). La ventana usa un perfil suyo, aparte del tuyo: si sale un aviso de cookies o un CAPTCHA, resuélvelo ahí y lo recordará.`
          : status.browseMissing === "install"
            ? "Falta el paquete del navegador: ejecuta npm install en la carpeta de Wanderlot y reinicia el panel (npm run panel)."
            : status.browseMissing === "browser"
              ? "No encontré Chrome, Brave, Edge ni Chromium en este ordenador. Instala uno y reinicia el panel, o pon la ruta del tuyo en WANDERLOT_BROWSER, en el archivo .env."
              : "Necesita el comando claude (Claude Code) en este ordenador. Instálalo y reinicia el panel."}
      </Text>
      {status.browse && view && view.options.length > 1 && (
        <div role="radiogroup" aria-label="Navegador" className="flex flex-col gap-2">
          {view.options.map((o) => (
            <RadioCard key={o.id} name="navegador" title={o.name} description={o.path} checked={view.active === o.id} onChange={() => void pick(o.id)} />
          ))}
        </div>
      )}
    </Card>
  );
}

const LOCALE_NOTE: Record<Locale, string> = {
  es: "Lo que ve el grupo, en español.",
  en: "What the group sees, in English.",
};

// The group's language (ROADMAP 4): the site starts in it for everyone, and
// each person can still switch it on their own device.
function LanguageCard() {
  const { state, saveSettings } = usePanel();
  const toast = useToast();
  const settings = state.settings;
  if (!settings) return null;
  const current = settings.locale ?? DEFAULT_LOCALE;
  const choose = async (locale: Locale) => {
    try {
      await saveSettings({ ...settings, locale });
      toast(`El sitio ya sale en ${LOCALE_NAMES[locale]}`);
    } catch (e) {
      toast(`No se pudo: ${(e as Error).message}`);
    }
  };
  return (
    <Card as="section" variant="raised" aria-labelledby="idioma" className="flex flex-col gap-3">
      <Heading id="idioma" size="subheading">
        Idioma del grupo
      </Heading>
      <Text tone="muted" size="sm">
        El sitio de tus amigos sale en este idioma; cada uno puede cambiarlo para sí en su menú de cuenta. Si no cambia, actualiza el sitio con npm run deploy:site.
      </Text>
      <div role="radiogroup" aria-label="Idioma del grupo" className="flex flex-col gap-2">
        {LOCALES.map((l) => (
          <RadioCard key={l} name="idioma" title={LOCALE_NAMES[l]} description={LOCALE_NOTE[l]} checked={current === l} onChange={() => void choose(l)} />
        ))}
      </div>
    </Card>
  );
}

// Ajustes (ROADMAP 3.3): which AI searches destinations, reads screenshots
// and drafts the trip's guide. Keys live in .env or the site's secrets,
// never here: the page says where to put them.
export function AjustesPage() {
  const { state, ai, chooseAi } = usePanel();
  const toast = useToast();
  const { data: view, error, set: setView } = useLoad<AiView>("ai", ai);
  const hosted = !!state.status?.hosted;


  const pick = async (o: AiOption) => {
    try {
      setView(await chooseAi(o.id));
      toast(`Ahora usa ${o.name}`);
    } catch (e) {
      toast(`No se pudo: ${(e as Error).message}`);
    }
  };

  const ready = view?.options.filter((o) => o.ready) ?? [];
  const missing = view?.options.filter((o) => !o.ready) ?? [];

  return (
    <PanelShell trip={false}>
      <main className="mx-auto flex w-full max-w-[900px] flex-col gap-[26px] px-4 py-8 sm:px-8">
        <PageHeader title="Ajustes" subtitle="La IA que busca destinos, lee capturas y prepara la guía del viaje" />

        {error && <Notice role="alert">No se pudieron leer los ajustes: {error}</Notice>}
        {!view && !error && <Skeleton className="h-48 rounded-card" />}

        {view && (
          <Card as="section" variant="raised" aria-labelledby="ia-en-uso" className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <Heading id="ia-en-uso" size="subheading">
                IA en uso
              </Heading>
              <Text tone="muted" size="sm">
                {hosted
                  ? "Aquí la IA lee capturas y, si es Claude por la API u OpenAI, busca destinos y prepara la guía en segundo plano. Usa la primera que tenga clave en el sitio."
                  : "Sin IA también puedes trabajar: añade destinos a mano en Revisar y escribe los precios que veas."}
              </Text>
            </div>
            {ready.length === 0 ? (
              <EmptyState title="Ninguna IA configurada">{hosted ? "Guarda una clave en el sitio (abajo) para leer capturas desde el móvil." : "Configura una de las de abajo."}</EmptyState>
            ) : (
              <div role="radiogroup" aria-label="IA en uso" className="flex flex-col gap-2">
                {ready.map((o) => (
                  <RadioCard
                    key={o.id}
                    name="ia"
                    title={o.model ? `${o.name} · ${o.model}` : o.name}
                    description={abilities(o, hosted)}
                    checked={view.active === o.id}
                    disabled={!view.canChoose}
                    onChange={() => void pick(o)}
                  />
                ))}
              </div>
            )}
            {ready.some((o) => o.id === view.active && !o.search) && (
              <Notice tone="neutral">Esta IA no busca en la web: lo que proponga llega al sitio como «estimado», y conviene comprobar los precios a mano antes de votar.</Notice>
            )}
          </Card>
        )}

        <LanguageCard />

        {!hosted && state.status && <BrowserCard status={state.status} />}

        {missing.length > 0 && (
          <section aria-labelledby="otras-ia" className="flex flex-col gap-3">
            <Heading id="otras-ia" size="subheading">
              Otras que puedes añadir
            </Heading>
            <Text tone="muted" size="sm">
              Las claves no se escriben aquí: {hosted ? "se guardan como secretos del sitio en Cloudflare" : "van en el archivo .env de este ordenador"}, y nunca pasan por el navegador.
            </Text>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {missing.map((o) => (
                <li key={o.id}>
                  <Card variant="muted" className="flex flex-col gap-1.5">
                    <span className="flex flex-wrap items-center gap-2">
                      <strong className="text-[15px]">{o.name}</strong>
                      <Badge tone="muted">{abilities(o, hosted)}</Badge>
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
