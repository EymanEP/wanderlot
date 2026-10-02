import { useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router";
import { copy } from "@wanderlot/core";
import { Button, Heading, LockIcon, Notice, Text, useCopy, useToast } from "@wanderlot/ui";
import { AuthLayout } from "../components/AuthLayout.tsx";
import { PinField } from "../components/PinField.tsx";
import { AuthError, useAuth } from "../data/auth.tsx";

const COPY = copy({
  es: {
    mismatch: "Los dos PIN no coinciden",
    saved: "PIN nuevo guardado. Úsalo la próxima vez que entres.",
    failed: "Algo ha fallado. Vuelve a intentarlo.",
    title: "Cambia tu PIN",
    intro: "Elige un PIN nuevo de 4 números para entrar a partir de ahora; el de antes deja de valer.",
    form: "Elegir PIN nuevo",
    pin: "PIN nuevo",
    again: "Repítelo",
    saving: "Guardando…",
    save: "Guardar PIN",
  },
  en: {
    mismatch: "The two PINs don't match",
    saved: "New PIN saved. Use it next time you sign in.",
    failed: "Something went wrong. Try again.",
    title: "Change your PIN",
    intro: "Choose a new 4-digit PIN to sign in from now on; the old one stops working.",
    form: "Choose a new PIN",
    pin: "New PIN",
    again: "Repeat it",
    saving: "Saving…",
    save: "Save PIN",
  },
});

// Choosing a new PIN while signed in: "Cambiar mi PIN" in the account menu.
export function NewPinPage() {
  const auth = useAuth();
  const t = useCopy(COPY);
  const navigate = useNavigate();
  const toast = useToast();
  const location = useLocation();
  const back = (location.state as { from?: string } | null)?.from ?? "/";
  const [pin, setPin] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (pin !== again) return setError(t.mismatch);
    setBusy(true);
    setError(null);
    try {
      await auth.changePin(pin);
      toast(t.saved);
      navigate(back, { replace: true });
    } catch (err) {
      setError(err instanceof AuthError ? err.message : t.failed);
      setBusy(false);
    }
  };

  return (
    <AuthLayout>
      <div className="flex flex-col gap-2">
        <Heading as="h1" size="headline">
          {t.title}
        </Heading>
        <Text>{t.intro}</Text>
      </div>
      {error && <Notice role="alert">{error}</Notice>}
      <form onSubmit={submit} className="flex flex-col gap-4" aria-label={t.form}>
        <PinField label={t.pin} value={pin} onChange={setPin} autoComplete="new-password" autoFocus />
        <PinField label={t.again} value={again} onChange={setAgain} autoComplete="new-password" />
        <Button type="submit" variant="primary" size="lg" block icon={<LockIcon size={18} />} disabled={busy || pin.length !== 4 || again.length !== 4}>
          {busy ? t.saving : t.save}
        </Button>
      </form>
    </AuthLayout>
  );
}
