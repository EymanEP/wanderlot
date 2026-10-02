import { useState } from "react";
import { addDaysIso, copy, deadlineLabel } from "@wanderlot/core";
import { Dialog, Field, Notice, TextInput, useCopy } from "@wanderlot/ui";
import { MessageDialog } from "./MessageDialog.tsx";

const COPY = copy({
  es: {
    opened: "Votación abierta",
    pasteIntro: "Pega este mensaje en el grupo. Lleva la dirección del sitio y las invitaciones de quien aún no ha entrado.",
    title: (plan: string) => `Abrir la votación de ${plan}`,
    opening: "Abriendo…",
    openWith: (n: number) => `Abrir con ${n} destinos`,
    text: "Publica los destinos marcados y abre la votación. Desde el primer voto ya no se pueden quitar ni añadir destinos.",
    closes: "Se cierra el",
  },
  en: {
    opened: "Vote open",
    pasteIntro: "Paste this message into the group. It has the site's link and invitations for anyone who hasn't joined yet.",
    title: (plan: string) => `Open the vote for ${plan}`,
    opening: "Opening…",
    openWith: (n: number) => `Open with ${n} destinations`,
    text: "Publishes the marked destinations and opens the vote. Once the first vote is in, destinations can't be removed or added.",
    closes: "Closes on",
  },
});

export interface OpenVoteDialogProps {
  open: boolean;
  planName: string;
  count: number;
  today: string; // YYYY-MM-DD
  onOpen: (deadline: string) => Promise<string>;
  onClose: () => void;
}

// Opens the vote on the site, then hands over the message for the group chat
// (SPEC §7): the site's address plus invites for whoever hasn't joined.
export function OpenVoteDialog({ open, planName, count, today, onOpen, onClose }: OpenVoteDialogProps) {
  const t = useCopy(COPY);
  const [date, setDate] = useState(addDaysIso(today, 14));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  // Closes at 23:59 on the chosen day, in the organiser's time zone.
  const deadline = new Date(`${date}T23:59:00`).toISOString();

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      setMessage(await onOpen(deadline));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    setMessage(null);
    setError(null);
    onClose();
  };

  if (message) {
    return (
      <MessageDialog
        open={open}
        title={t.opened}
        intro={t.pasteIntro}
        message={message}
        onClose={close}
      />
    );
  }

  return (
    <Dialog
      open={open}
      title={t.title(planName)}
      confirmLabel={busy ? t.opening : t.openWith(count)}
      busy={busy}
      onConfirm={confirm}
      onClose={close}
    >
      <div className="flex flex-col gap-3">
        <span>{t.text}</span>
        <Field label={t.closes} aside={deadlineLabel(deadline)}>
          {({ inputId }) => <TextInput id={inputId} type="date" min={addDaysIso(today, 1)} value={date} onChange={(e) => setDate(e.target.value)} />}
        </Field>
        {error && <Notice role="alert">{error}</Notice>}
      </div>
    </Dialog>
  );
}
