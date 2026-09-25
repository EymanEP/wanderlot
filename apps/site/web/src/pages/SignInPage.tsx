import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { plan } from "@wanderlot/mocks";
import { Button, Heading, LockIcon, Notice, Text } from "@wanderlot/ui";
import { AuthLayout } from "../components/AuthLayout.tsx";
import { AuthError, useAuth } from "../data/auth.tsx";

export function SignInPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const back = (location.state as { from?: string } | null)?.from ?? `/p/${plan.id}`;

  if (auth.state.status === "in" && !busy) return <Navigate to={back} replace />;

  const enter = async () => {
    setBusy(true);
    setError(null);
    try {
      await auth.signIn();
      navigate(back, { replace: true });
    } catch (e) {
      setError(e instanceof AuthError ? e.message : "Algo ha fallado. Vuelve a intentarlo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout>
      <div className="flex flex-col gap-2">
        <Heading as="h1" size="headline">
          Entra con tu passkey
        </Heading>
        <Text>Face ID, huella o el PIN del móvil. Sin contraseñas.</Text>
      </div>
      {!auth.client.supported() && (
        <Notice>Este navegador no admite passkeys. Abre el sitio en Safari, Chrome o Edge actualizados.</Notice>
      )}
      {error && <Notice role="alert">{error}</Notice>}
      <Button variant="primary" size="lg" block icon={<LockIcon size={18} />} onClick={enter} disabled={busy || !auth.client.supported()}>
        {busy ? "Esperando a tu passkey…" : "Entrar"}
      </Button>
      <Text size="sm" tone="muted" className="border-t border-line-faint pt-4">
        ¿Es la primera vez, o estás en un móvil nuevo sin tu passkey? Pide una invitación a quien organiza el grupo.
      </Text>
    </AuthLayout>
  );
}
