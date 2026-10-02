import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { copy } from "@wanderlot/core";
import { Button, Heading, LockIcon, Notice, Skeleton, Text, buttonClasses, useCopy } from "@wanderlot/ui";
import { AuthLayout } from "../components/AuthLayout.tsx";
import { PinField } from "../components/PinField.tsx";
import { AuthError, useAuth, type InviteStatus } from "../data/auth.tsx";

type Loaded = { name: string; status: InviteStatus } | null;

const COPY = copy({
  es: {
    spent: (organiser: string): Record<Exclude<InviteStatus, "valid">, { title: string; body: string }> => ({
      used: {
        title: "Esta invitación ya se usó",
        body: `Cada invitación sirve una vez. Si ya elegiste tu PIN, entra con tu nombre y tu PIN. Si no fuiste tú, avisa a ${organiser}.`,
      },
      expired: { title: "Esta invitación caducó", body: `Las invitaciones duran 7 días. Pide una nueva a ${organiser}.` },
      cancelled: { title: "Esta invitación ya no vale", body: `Se mandó una más nueva. Busca el último enlace o pide otro a ${organiser}.` },
    }),
    missing: { title: "Esta invitación no existe", body: "Revisa que el enlace esté completo, o pide uno nuevo." },
    failed: "Algo ha fallado. Vuelve a intentarlo.",
    mismatch: "Los dos PIN no coinciden",
    signIn: "Entrar con mi nombre y PIN",
    invited: (organiser: string, group: string) => `${organiser} te ha invitado a ${group}`,
    isIt: (name: string) => `¿Eres ${name}?`,
    intro: "Elige un PIN de 4 números. Con tu nombre y ese PIN entras desde el móvil, el portátil o donde quieras.",
    form: "Elegir PIN",
    pin: "Tu PIN",
    again: "Repítelo",
    entering: "Entrando…",
    save: "Guardar PIN y entrar",
    waiting: "Esperando a tu passkey…",
    passkey: "Prefiero Face ID o huella en este dispositivo",
    onlyFor: (name: string, organiser: string) => `Esta invitación sirve una vez y es solo para ${name}. Si no eres ${name}, cierra esta página y avisa a ${organiser}.`,
  },
  en: {
    spent: (organiser: string): Record<Exclude<InviteStatus, "valid">, { title: string; body: string }> => ({
      used: {
        title: "This invite has already been used",
        body: `Each invite works once. If you've already chosen your PIN, sign in with your name and PIN. If it wasn't you, tell ${organiser}.`,
      },
      expired: { title: "This invite has expired", body: `Invites last 7 days. Ask ${organiser} for a new one.` },
      cancelled: { title: "This invite no longer works", body: `A newer one was sent. Look for the latest link or ask ${organiser} for another.` },
    }),
    missing: { title: "This invite doesn't exist", body: "Check the link is complete, or ask for a new one." },
    failed: "Something went wrong. Try again.",
    mismatch: "The two PINs don't match",
    signIn: "Sign in with my name and PIN",
    invited: (organiser: string, group: string) => `${organiser} has invited you to ${group}`,
    isIt: (name: string) => `Are you ${name}?`,
    intro: "Choose a 4-digit PIN. With your name and that PIN you can sign in from your phone, your laptop or anywhere.",
    form: "Choose a PIN",
    pin: "Your PIN",
    again: "Repeat it",
    entering: "Signing in…",
    save: "Save PIN and sign in",
    waiting: "Waiting for your passkey…",
    passkey: "I'd rather use Face ID or a fingerprint on this device",
    onlyFor: (name: string, organiser: string) => `This invite works once and is only for ${name}. If you're not ${name}, close this page and tell ${organiser}.`,
  },
});

// Opening this page never uses the invite; only choosing a PIN (or creating a
// passkey) does.
export function InvitePage() {
  const { token = "" } = useParams();
  const auth = useAuth();
  const t = useCopy(COPY);
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
      setError(e instanceof AuthError ? e.message : t.failed);
      setBusy(null);
    }
  };

  const withPin = (e: FormEvent) => {
    e.preventDefault();
    if (pin !== again) return setError(t.mismatch);
    void run("pin", () => auth.acceptInviteWithPin(token, pin));
  };

  const signInLink = (
    <Link to="/entrar" className={buttonClasses({ variant: "secondary", size: "lg", block: true })}>
      {t.signIn}
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
    const text = invite ? t.spent(organiser)[invite.status as Exclude<InviteStatus, "valid">] : t.missing;
    return (
      <AuthLayout>
        <div className="flex flex-col gap-2">
          <Heading as="h1" size="headline">
            {text.title}
          </Heading>
          <Text>{text.body}</Text>
        </div>
        {signInLink}
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-bold text-accent-strong">{t.invited(organiser, auth.group.groupName)}</span>
        <Heading as="h1" size="headline">
          {t.isIt(invite.name)}
        </Heading>
        <Text>{t.intro}</Text>
      </div>
      {error && <Notice role="alert">{error}</Notice>}
      <form onSubmit={withPin} className="flex flex-col gap-4" aria-label={t.form}>
        <PinField label={t.pin} value={pin} onChange={setPin} autoComplete="new-password" autoFocus />
        <PinField label={t.again} value={again} onChange={setAgain} autoComplete="new-password" />
        <Button type="submit" variant="primary" size="lg" block icon={<LockIcon size={18} />} disabled={busy !== null || pin.length !== 4 || again.length !== 4}>
          {busy === "pin" ? t.entering : t.save}
        </Button>
      </form>
      {auth.client.supported() && (
        <Button variant="ghost" block onClick={() => void run("passkey", () => auth.acceptInvite(token))} disabled={busy !== null}>
          {busy === "passkey" ? t.waiting : t.passkey}
        </Button>
      )}
      <Text size="sm" tone="muted" className="border-t border-line-faint pt-4">
        {t.onlyFor(invite.name, organiser)}
      </Text>
    </AuthLayout>
  );
}
