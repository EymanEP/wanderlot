import { useEffect, useState, type FormEvent } from "react";
import { longDate } from "@wanderlot/core";
import { Badge, Button, Card, Field, Heading, Notice, Text, TextInput, useToast } from "@wanderlot/ui";
import type { OrganiserAccess } from "../data/backend.ts";
import { usePanel } from "../data/store.tsx";

// "Panel en el móvil" (ROADMAP 3.1): the site serves this panel at /admin,
// without AI, for whoever knows the password set here.
export function OrganiserCard() {
  const { organiser, setOrganiserPassword, state } = usePanel();
  const toast = useToast();
  const [access, setAccess] = useState<OrganiserAccess | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const hosted = !!state.status?.hosted;

  useEffect(() => {
    organiser().then(setAccess, (e: Error) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async (next: string | null) => {
    setBusy(true);
    setError(null);
    try {
      const a = await setOrganiserPassword(next);
      setAccess(a);
      setEditing(false);
      setPassword("");
      setAgain("");
      toast(next ? "Contraseña guardada: los dispositivos que estaban dentro tendrán que volver a entrar" : "Panel en el sitio desactivado");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 10) return setError("Usa al menos 10 caracteres");
    if (password !== again) return setError("Las dos contraseñas no coinciden");
    void save(password);
  };

  return (
    <Card as="section" variant="raised" aria-label="Panel en el móvil" className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex max-w-[640px] flex-col gap-1">
          <Heading size="subheading">Panel en el móvil</Heading>
          <Text tone="muted" size="sm">
            El sitio también sirve este panel, sin Claude: para revisar, publicar, abrir votaciones o invitar a alguien desde el móvil. Comparte los viajes con el de tu
            ordenador. Entra con una contraseña que solo sepas tú.
          </Text>
        </div>
        {access && (
          <Badge tone={access.enabled ? "accent" : "muted"} size="md">
            {access.enabled ? "Activado" : "Desactivado"}
          </Badge>
        )}
      </div>

      {error && <Notice role="alert">{error}</Notice>}

      {access?.enabled && !editing && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-2 px-3.5 py-3">
          <span className="flex flex-col text-sm">
            <a href={access.url} target="_blank" rel="noreferrer" className="font-semibold">
              {access.url}
            </a>
            {access.setAt && <span className="text-[13px] text-muted">Contraseña puesta el {longDate(access.setAt)}</span>}
          </span>
          <span className="flex gap-2">
            <Button size="sm" onClick={() => setEditing(true)}>
              Cambiar contraseña
            </Button>
            {!hosted && (
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => void save(null)}>
                Desactivar
              </Button>
            )}
          </span>
        </div>
      )}

      {access && (!access.enabled || editing) && (
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end" aria-label="Contraseña del panel">
          <Field label={access.enabled ? "Contraseña nueva" : "Contraseña"}>
            {({ inputId }) => <TextInput id={inputId} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
          </Field>
          <Field label="Repítela">
            {({ inputId }) => <TextInput id={inputId} type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} />}
          </Field>
          <span className="flex gap-2">
            {editing && (
              <Button onClick={() => setEditing(false)} className="h-[46px]">
                Cancelar
              </Button>
            )}
            <Button type="submit" variant="dark" className="h-[46px]" disabled={busy || !password || !again}>
              {access.enabled ? "Guardar" : "Activar"}
            </Button>
          </span>
          <span className="text-[13px] text-muted sm:col-span-3">Al menos 10 caracteres. Cambiarla saca a todos los dispositivos que estaban dentro.</span>
        </form>
      )}
    </Card>
  );
}
