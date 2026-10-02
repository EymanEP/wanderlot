import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { copy } from "@wanderlot/core";
import { Brand, Button, Card, Field, Heading, Notice, Page, Skeleton, Text, TextInput, useCopy } from "@wanderlot/ui";
import { localeHeaders } from "../data/locale.tsx";

const COPY = copy({
  es: {
    notOn: "El panel en el sitio no está activado",
    howOn: "Actívalo desde el panel de tu ordenador: en Personas, «Panel en el móvil», elige una contraseña.",
    noConnect: (error: string) => `No se pudo conectar con el sitio: ${error}`,
    signIn: "Entrar al panel",
    intro: "Gestiona los viajes y la cuadrilla desde aquí. Buscar destinos con Claude sigue en tu ordenador.",
    password: "Contraseña del panel",
    entering: "Entrando…",
    enter: "Entrar",
  },
  en: {
    notOn: "The panel on the site isn't turned on",
    howOn: "Turn it on from the panel on your computer: in People, \"Panel on your phone\", choose a password.",
    noConnect: (error: string) => `Couldn't connect to the site: ${error}`,
    signIn: "Sign in to the panel",
    intro: "Manage the trips and the group from here. Searching for destinations with Claude stays on your computer.",
    password: "Panel password",
    entering: "Signing in…",
    enter: "Sign in",
  },
});

// "/admin" in the panel the site serves.
const ROOT = import.meta.env.BASE_URL.replace(/\/$/, "");

type Gate = "loading" | "off" | "out" | "in" | { error: string };

// The panel the site serves at /admin (ROADMAP 3.1) is for the organiser
// only: it asks for the password set from the laptop's panel.
export function HostedGate({ children }: { children: ReactNode }) {
  const t = useCopy(COPY);
  const [gate, setGate] = useState<Gate>("loading");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`${ROOT}/api/session`, { credentials: "same-origin" }).then(
      (res) => setGate(res.ok ? "in" : res.status === 404 ? "off" : "out"),
      (e: Error) => setGate({ error: e.message }),
    );
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${ROOT}/api/session`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json", ...localeHeaders() },
        body: JSON.stringify({ password }),
      });
      if (res.ok) return setGate("in");
      setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? `Error ${res.status}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (gate === "in") return children;

  return (
    <Page className="bg-canvas">
      <main className="mx-auto flex w-full max-w-[440px] flex-1 flex-col justify-center gap-6 px-4 py-12">
        <Brand sub="Panel" size="lg" />
        {gate === "loading" ? (
          <Skeleton className="h-56 rounded-card" />
        ) : gate === "off" ? (
          <Card variant="raised" className="flex flex-col gap-3">
            <Heading as="h1" size="subheading">
              {t.notOn}
            </Heading>
            <Text tone="muted">{t.howOn}</Text>
          </Card>
        ) : typeof gate === "object" ? (
          <Notice role="alert">{t.noConnect(gate.error)}</Notice>
        ) : (
          <Card as="form" variant="raised" className="flex flex-col gap-4" onSubmit={submit} aria-label={t.signIn}>
            <div className="flex flex-col gap-1">
              <Heading as="h1" size="subheading">
                {t.signIn}
              </Heading>
              <Text tone="muted">{t.intro}</Text>
            </div>
            <Field label={t.password}>
              {({ inputId }) => (
                <TextInput id={inputId} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              )}
            </Field>
            {error && <Notice role="alert">{error}</Notice>}
            <Button variant="primary" type="submit" disabled={busy || !password}>
              {busy ? t.entering : t.enter}
            </Button>
          </Card>
        )}
      </main>
    </Page>
  );
}

export async function signOutHosted(): Promise<void> {
  await fetch(`${ROOT}/api/session`, { method: "DELETE", credentials: "same-origin", headers: { "content-type": "application/json" } });
  window.location.assign(`${ROOT}/`);
}
