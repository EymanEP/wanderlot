import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { Button, Field, Heading, LockIcon, Notice, Text, TextInput } from "@wanderlot/ui";
import { AuthLayout } from "../components/AuthLayout.tsx";
import { PinField } from "../components/PinField.tsx";
import { AuthError, useAuth } from "../data/auth.tsx";

// The name last used on this device, to save typing it again.
const NAME_KEY = "wanderlot:name";
const lastName = () => {
  try {
    return localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
};
const rememberName = (name: string) => {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {}
};

// Name and PIN from any device; a passkey for those who set one up here.
export function SignInPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [name, setName] = useState(lastName);
  const [pin, setPin] = useState("");
  // PINs chosen before the switch to 4 digits still work, once: signing in
  // with one leads straight to choosing a new 4-digit PIN.
  const [oldPin, setOldPin] = useState(false);
  const length = oldPin ? 6 : 4;
  const [busy, setBusy] = useState<"pin" | "passkey" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const back = (location.state as { from?: string } | null)?.from ?? "/";

  if (auth.state.status === "in" && !busy) return <Navigate to={back} replace />;

  const run = async (how: "pin" | "passkey", go: () => Promise<unknown>) => {
    setBusy(how);
    setError(null);
    try {
      await go();
      if (how === "pin" && oldPin) navigate("/nuevo-pin", { replace: true, state: { from: back } });
      else navigate(back, { replace: true });
    } catch (e) {
      setError(e instanceof AuthError ? e.message : "Algo ha fallado. Vuelve a intentarlo.");
      if (how === "pin") setPin("");
      // Only on failure: clearing it on success would let the signed-in
      // redirect above win over the navigation just made.
      setBusy(null);
    }
  };

  const withPin = (e: FormEvent) => {
    e.preventDefault();
    rememberName(name.trim());
    void run("pin", () => auth.signInWithPin(name, pin));
  };

  return (
    <AuthLayout>
      <div className="flex flex-col gap-2">
        <Heading as="h1" size="headline">
          Entra en {auth.group.groupName}
        </Heading>
        <Text>Con tu nombre y el PIN que elegiste al aceptar la invitación.</Text>
      </div>
      {error && <Notice role="alert">{error}</Notice>}
      <form onSubmit={withPin} className="flex flex-col gap-4" aria-label="Entrar con PIN">
        <Field label="Tu nombre">
          {({ inputId }) => (
            <TextInput id={inputId} autoComplete="username" required value={name} onChange={(e) => setName(e.target.value)} autoFocus={!name} />
          )}
        </Field>
        <div className="flex flex-col gap-1.5">
          <PinField label="PIN" value={pin} onChange={setPin} autoComplete="current-password" autoFocus={!!name} length={length} />
          <button
            type="button"
            onClick={() => {
              setOldPin((x) => !x);
              setPin("");
            }}
            className="cursor-pointer self-start border-0 bg-transparent p-0 text-[13px] font-semibold text-accent hover:text-accent-hover"
          >
            {oldPin ? "Mi PIN tiene 4 números" : "Mi PIN tiene 6 números (lo elegí antes)"}
          </button>
        </div>
        <Button type="submit" variant="primary" size="lg" block icon={<LockIcon size={18} />} disabled={busy !== null || pin.length !== length || !name.trim()}>
          {busy === "pin" ? "Entrando…" : "Entrar"}
        </Button>
      </form>
      {auth.client.supported() && (
        <Button variant="ghost" block onClick={() => void run("passkey", auth.signIn)} disabled={busy !== null}>
          {busy === "passkey" ? "Esperando a tu passkey…" : "Entrar con passkey (Face ID o huella)"}
        </Button>
      )}
      <Text size="sm" tone="muted" className="border-t border-line-faint pt-4">
        ¿Primera vez, o no recuerdas tu PIN? Pide una invitación nueva a {auth.group.organiserName}.
      </Text>
    </AuthLayout>
  );
}
