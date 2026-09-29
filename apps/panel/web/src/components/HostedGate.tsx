import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Brand, Button, Card, Field, Heading, Notice, Page, Skeleton, Text, TextInput } from "@wanderlot/ui";

// "/admin" in the panel the site serves.
const ROOT = import.meta.env.BASE_URL.replace(/\/$/, "");

type Gate = "loading" | "off" | "out" | "in" | { error: string };

// The panel the site serves at /admin (ROADMAP 3.1) is for the organiser
// only: it asks for the password set from the laptop's panel.
export function HostedGate({ children }: { children: ReactNode }) {
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
        headers: { "content-type": "application/json" },
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
              El panel en el sitio no está activado
            </Heading>
            <Text tone="muted">Actívalo desde el panel de tu ordenador: en Personas, «Panel en el móvil», elige una contraseña.</Text>
          </Card>
        ) : typeof gate === "object" ? (
          <Notice role="alert">No se pudo conectar con el sitio: {gate.error}</Notice>
        ) : (
          <Card as="form" variant="raised" className="flex flex-col gap-4" onSubmit={submit} aria-label="Entrar al panel">
            <div className="flex flex-col gap-1">
              <Heading as="h1" size="subheading">
                Entrar al panel
              </Heading>
              <Text tone="muted">Gestiona los viajes y la cuadrilla desde aquí. Buscar destinos con Claude sigue en tu ordenador.</Text>
            </div>
            <Field label="Contraseña del panel">
              {({ inputId }) => (
                <TextInput id={inputId} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              )}
            </Field>
            {error && <Notice role="alert">{error}</Notice>}
            <Button variant="primary" type="submit" disabled={busy || !password}>
              {busy ? "Entrando…" : "Entrar"}
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
