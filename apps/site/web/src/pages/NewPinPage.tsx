import { useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router";
import { Button, Heading, LockIcon, Notice, Text, useToast } from "@wanderlot/ui";
import { AuthLayout } from "../components/AuthLayout.tsx";
import { PinField } from "../components/PinField.tsx";
import { AuthError, useAuth } from "../data/auth.tsx";

// Choosing a new 4-digit PIN while signed in: where a 6-digit PIN from before
// the switch leads, and "Cambiar mi PIN" in the account menu.
export function NewPinPage() {
  const auth = useAuth();
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
    if (pin !== again) return setError("Los dos PIN no coinciden");
    setBusy(true);
    setError(null);
    try {
      await auth.changePin(pin);
      toast("PIN nuevo guardado. Úsalo la próxima vez que entres.");
      navigate(back, { replace: true });
    } catch (err) {
      setError(err instanceof AuthError ? err.message : "Algo ha fallado. Vuelve a intentarlo.");
      setBusy(false);
    }
  };

  return (
    <AuthLayout>
      <div className="flex flex-col gap-2">
        <Heading as="h1" size="headline">
          Elige tu PIN nuevo
        </Heading>
        <Text>Ahora los PIN son de 4 números. Elige uno para entrar a partir de ahora; el de antes deja de valer.</Text>
      </div>
      {error && <Notice role="alert">{error}</Notice>}
      <form onSubmit={submit} className="flex flex-col gap-4" aria-label="Elegir PIN nuevo">
        <PinField label="PIN nuevo" value={pin} onChange={setPin} autoComplete="new-password" autoFocus />
        <PinField label="Repítelo" value={again} onChange={setAgain} autoComplete="new-password" />
        <Button type="submit" variant="primary" size="lg" block icon={<LockIcon size={18} />} disabled={busy || pin.length !== 4 || again.length !== 4}>
          {busy ? "Guardando…" : "Guardar PIN"}
        </Button>
      </form>
    </AuthLayout>
  );
}
