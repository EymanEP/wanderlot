import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { plan } from "@wanderlot/mocks";
import { Button, Heading, LockIcon, Notice, Skeleton, Text, buttonClasses } from "@wanderlot/ui";
import { AuthLayout } from "../components/AuthLayout.tsx";
import { AuthError, useAuth, type InviteStatus } from "../data/auth.tsx";

type Loaded = { name: string; status: InviteStatus } | null;

const SPENT: Record<Exclude<InviteStatus, "valid">, { title: string; body: string }> = {
  used: {
    title: "Esta invitación ya se usó",
    body: "Cada invitación sirve una vez. Si ya creaste tu passkey, entra con ella. Si no fuiste tú, avisa a quien organiza el grupo.",
  },
  expired: { title: "Esta invitación caducó", body: "Las invitaciones duran 7 días. Pide una nueva a quien organiza el grupo." },
  cancelled: { title: "Esta invitación ya no vale", body: "Se mandó una más nueva. Busca el último enlace o pide otro." },
};

// Opening this page never uses the invite; only creating the passkey does.
export function InvitePage() {
  const { token = "" } = useParams();
  const auth = useAuth();
  const navigate = useNavigate();
  const [invite, setInvite] = useState<Loaded | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    auth.client.invite(token).then(
      (i) => live && setInvite(i),
      () => live && setInvite(null),
    );
    return () => {
      live = false;
    };
  }, [auth.client, token]);

  const accept = async () => {
    setBusy(true);
    setError(null);
    try {
      await auth.acceptInvite(token);
      navigate(`/p/${plan.id}`, { replace: true });
    } catch (e) {
      setError(e instanceof AuthError ? e.message : "Algo ha fallado. Vuelve a intentarlo.");
      setBusy(false);
    }
  };

  const signInLink = (
    <Link to="/entrar" className={buttonClasses({ variant: "secondary", size: "lg", block: true })}>
      Entrar con mi passkey
    </Link>
  );

  if (invite === undefined) {
    return (
      <AuthLayout>
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-[52px] w-full rounded-xl" />
      </AuthLayout>
    );
  }

  if (invite === null || invite.status !== "valid") {
    const copy = invite ? SPENT[invite.status as Exclude<InviteStatus, "valid">] : { title: "Esta invitación no existe", body: "Revisa que el enlace esté completo, o pide uno nuevo." };
    return (
      <AuthLayout>
        <div className="flex flex-col gap-2">
          <Heading as="h1" size="headline">
            {copy.title}
          </Heading>
          <Text>{copy.body}</Text>
        </div>
        {signInLink}
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-bold text-accent-strong">Te han invitado al plan del grupo</span>
        <Heading as="h1" size="headline">
          ¿Eres {invite.name}?
        </Heading>
        <Text>
          Crea tu passkey y ya está: la próxima vez entras en el sitio con Face ID, tu huella o el PIN del móvil. Sin contraseñas.
        </Text>
      </div>
      {!auth.client.supported() && (
        <Notice>Este navegador no admite passkeys. Abre este enlace en Safari, Chrome o Edge actualizados.</Notice>
      )}
      {error && <Notice role="alert">{error}</Notice>}
      <Button variant="primary" size="lg" block icon={<LockIcon size={18} />} onClick={accept} disabled={busy || !auth.client.supported()}>
        {busy ? "Esperando a tu passkey…" : "Crear mi passkey"}
      </Button>
      <Text size="sm" tone="muted" className="border-t border-line-faint pt-4">
        Esta invitación sirve una vez y es solo para {invite.name}. Si no eres {invite.name}, cierra esta página y avisa a quien te la mandó.
      </Text>
    </AuthLayout>
  );
}
