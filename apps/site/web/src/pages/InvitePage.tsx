import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Button, Heading, LockIcon, Notice, Skeleton, Text, buttonClasses } from "@wanderlot/ui";
import { AuthLayout } from "../components/AuthLayout.tsx";
import { PinField } from "../components/PinField.tsx";
import { AuthError, useAuth, type InviteStatus } from "../data/auth.tsx";

type Loaded = { name: string; status: InviteStatus } | null;

const spent = (organiser: string): Record<Exclude<InviteStatus, "valid">, { title: string; body: string }> => ({
  used: {
    title: "Esta invitación ya se usó",
    body: `Cada invitación sirve una vez. Si ya elegiste tu PIN, entra con tu nombre y tu PIN. Si no fuiste tú, avisa a ${organiser}.`,
  },
  expired: { title: "Esta invitación caducó", body: `Las invitaciones duran 7 días. Pide una nueva a ${organiser}.` },
  cancelled: { title: "Esta invitación ya no vale", body: `Se mandó una más nueva. Busca el último enlace o pide otro a ${organiser}.` },
});

// Opening this page never uses the invite; only choosing a PIN (or creating a
// passkey) does.
export function InvitePage() {
  const { token = "" } = useParams();
  const auth = useAuth();
  const organiser = auth.group.organiserName;
  const navigate = useNavigate();
  const [invite, setInvite] = useState<Loaded | undefined>(undefined);
  const [busy, setBusy] = useState<"pin" | "passkey" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [again, setAgain] = useState("");

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

  const run = async (how: "pin" | "passkey", go: () => Promise<unknown>) => {
    setBusy(how);
    setError(null);
    try {
      await go();
      navigate("/", { replace: true });
    } catch (e) {
      setError(e instanceof AuthError ? e.message : "Algo ha fallado. Vuelve a intentarlo.");
      setBusy(null);
    }
  };

  const withPin = (e: FormEvent) => {
    e.preventDefault();
    if (pin !== again) return setError("Los dos PIN no coinciden");
    void run("pin", () => auth.acceptInviteWithPin(token, pin));
  };

  const signInLink = (
    <Link to="/entrar" className={buttonClasses({ variant: "secondary", size: "lg", block: true })}>
      Entrar con mi nombre y PIN
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
    const copy = invite ? spent(organiser)[invite.status as Exclude<InviteStatus, "valid">] : { title: "Esta invitación no existe", body: "Revisa que el enlace esté completo, o pide uno nuevo." };
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
        <span className="text-[13px] font-bold text-accent-strong">{organiser} te ha invitado a {auth.group.groupName}</span>
        <Heading as="h1" size="headline">
          ¿Eres {invite.name}?
        </Heading>
        <Text>Elige un PIN de 4 números. Con tu nombre y ese PIN entras desde el móvil, el portátil o donde quieras.</Text>
      </div>
      {error && <Notice role="alert">{error}</Notice>}
      <form onSubmit={withPin} className="flex flex-col gap-4" aria-label="Elegir PIN">
        <PinField label="Tu PIN" value={pin} onChange={setPin} autoComplete="new-password" autoFocus />
        <PinField label="Repítelo" value={again} onChange={setAgain} autoComplete="new-password" />
        <Button type="submit" variant="primary" size="lg" block icon={<LockIcon size={18} />} disabled={busy !== null || pin.length !== 4 || again.length !== 4}>
          {busy === "pin" ? "Entrando…" : "Guardar PIN y entrar"}
        </Button>
      </form>
      {auth.client.supported() && (
        <Button variant="ghost" block onClick={() => void run("passkey", () => auth.acceptInvite(token))} disabled={busy !== null}>
          {busy === "passkey" ? "Esperando a tu passkey…" : "Prefiero Face ID o huella en este dispositivo"}
        </Button>
      )}
      <Text size="sm" tone="muted" className="border-t border-line-faint pt-4">
        Esta invitación sirve una vez y es solo para {invite.name}. Si no eres {invite.name}, cierra esta página y avisa a {organiser}.
      </Text>
    </AuthLayout>
  );
}
