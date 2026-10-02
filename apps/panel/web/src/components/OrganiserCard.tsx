import { useEffect, useState, type FormEvent } from "react";
import { copy, longDate } from "@wanderlot/core";
import { Badge, Button, Card, Field, Heading, Notice, Text, TextInput, useCopy, useToast } from "@wanderlot/ui";
import type { OrganiserAccess } from "../data/backend.ts";
import { usePanel } from "../data/store.tsx";

const COPY = copy({
  es: {
    saved: "Contraseña guardada: los dispositivos que estaban dentro tendrán que volver a entrar",
    off: "Panel en el sitio desactivado",
    tooShort: "Usa al menos 10 caracteres",
    mismatch: "Las dos contraseñas no coinciden",
    title: "Panel en el móvil",
    intro:
      "El sitio también sirve este panel, sin buscar destinos: para revisar, publicar, abrir votaciones o invitar a alguien desde el móvil. Comparte los viajes con el de tu ordenador. Entra con una contraseña que solo sepas tú.",
    enabled: "Activado",
    disabled: "Desactivado",
    setOn: (date: string) => `Contraseña puesta el ${date}`,
    change: "Cambiar contraseña",
    disable: "Desactivar",
    form: "Contraseña del panel",
    newPassword: "Contraseña nueva",
    password: "Contraseña",
    again: "Repítela",
    cancel: "Cancelar",
    save: "Guardar",
    enable: "Activar",
    hint: "Al menos 10 caracteres. Cambiarla saca a todos los dispositivos que estaban dentro.",
  },
  en: {
    saved: "Password saved: devices that were signed in will have to sign in again",
    off: "Panel on the site turned off",
    tooShort: "Use at least 10 characters",
    mismatch: "The two passwords don't match",
    title: "Panel on your phone",
    intro:
      "The site also serves this panel, without searching for destinations: to review, publish, open votes or invite someone from your phone. It shares the trips with the one on your computer. Sign in with a password only you know.",
    enabled: "On",
    disabled: "Off",
    setOn: (date: string) => `Password set on ${date}`,
    change: "Change password",
    disable: "Turn off",
    form: "Panel password",
    newPassword: "New password",
    password: "Password",
    again: "Repeat it",
    cancel: "Cancel",
    save: "Save",
    enable: "Turn on",
    hint: "At least 10 characters. Changing it signs out every device that was signed in.",
  },
});

// "Panel en el móvil" (ROADMAP 3.1): the site serves this panel at /admin,
// without AI, for whoever knows the password set here.
export function OrganiserCard() {
  const t = useCopy(COPY);
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
      toast(next ? t.saved : t.off);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 10) return setError(t.tooShort);
    if (password !== again) return setError(t.mismatch);
    void save(password);
  };

  return (
    <Card as="section" variant="raised" aria-label={t.title} className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex max-w-[640px] flex-col gap-1">
          <Heading size="subheading">{t.title}</Heading>
          <Text tone="muted" size="sm">
            {t.intro}
          </Text>
        </div>
        {access && (
          <Badge tone={access.enabled ? "accent" : "muted"} size="md">
            {access.enabled ? t.enabled : t.disabled}
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
            {access.setAt && <span className="text-[13px] text-muted">{t.setOn(longDate(access.setAt))}</span>}
          </span>
          <span className="flex gap-2">
            <Button size="sm" onClick={() => setEditing(true)}>
              {t.change}
            </Button>
            {!hosted && (
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => void save(null)}>
                {t.disable}
              </Button>
            )}
          </span>
        </div>
      )}

      {access && (!access.enabled || editing) && (
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end" aria-label={t.form}>
          <Field label={access.enabled ? t.newPassword : t.password}>
            {({ inputId }) => <TextInput id={inputId} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
          </Field>
          <Field label={t.again}>
            {({ inputId }) => <TextInput id={inputId} type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} />}
          </Field>
          <span className="flex gap-2">
            {editing && (
              <Button onClick={() => setEditing(false)} className="h-[46px]">
                {t.cancel}
              </Button>
            )}
            <Button type="submit" variant="dark" className="h-[46px]" disabled={busy || !password || !again}>
              {access.enabled ? t.save : t.enable}
            </Button>
          </span>
          <span className="text-[13px] text-muted sm:col-span-3">{t.hint}</span>
        </form>
      )}
    </Card>
  );
}
