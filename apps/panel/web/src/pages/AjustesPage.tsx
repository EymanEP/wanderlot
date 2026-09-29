import { useEffect, useState } from "react";
import { Badge, Card, EmptyState, Heading, Notice, PageHeader, RadioCard, Skeleton, Text, useToast } from "@wanderlot/ui";
import { PanelShell } from "../components/PanelShell.tsx";
import type { AiOption, AiView } from "../data/backend.ts";
import { usePanel } from "../data/store.tsx";

// What each AI can do, in a line; on the site, whether it can search there.
function abilities(o: AiOption, hosted: boolean): string {
  return [
    o.search ? "Busca en la web" : "No busca en la web: precios estimados",
    o.images ? "lee capturas" : "no lee capturas",
    ...(hosted ? [o.background ? "busca desde el sitio" : "desde el sitio solo lee capturas"] : []),
  ].join(" · ");
}

// Ajustes (ROADMAP 3.3): which AI searches destinations, reads screenshots
// and drafts the trip's guide. Keys live in .env or the site's secrets,
// never here: the page says where to put them.
export function AjustesPage() {
  const { state, ai, chooseAi } = usePanel();
  const toast = useToast();
  const [view, setView] = useState<AiView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hosted = !!state.status?.hosted;

  useEffect(() => {
    ai().then(setView, (e: Error) => setError(e.message));
    // Once: `ai` is a new function on every panel change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
