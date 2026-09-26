import { useState } from "react";
import { addDaysIso, deadlineLabel } from "@wanderlot/core";
import { Dialog, Field, Notice, TextInput } from "@wanderlot/ui";
import { MessageDialog } from "./MessageDialog.tsx";

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
        title="Votación abierta"
        intro="Pega este mensaje en el grupo. Lleva la dirección del sitio y las invitaciones de quien aún no ha entrado."
        message={message}
        onClose={close}
      />
    );
  }

  return (
    <Dialog
      open={open}
      title={`Abrir la votación de ${planName}`}
      confirmLabel={busy ? "Abriendo…" : `Abrir con ${count} destinos`}
      busy={busy}
      onConfirm={confirm}
      onClose={close}
    >
      <div className="flex flex-col gap-3">
        <span>Publica los destinos marcados y abre la votación. Desde el primer voto ya no se pueden quitar ni añadir destinos.</span>
        <Field label="Se cierra el" aside={deadlineLabel(deadline)}>
          {({ inputId }) => <TextInput id={inputId} type="date" min={addDaysIso(today, 1)} value={date} onChange={(e) => setDate(e.target.value)} />}
        </Field>
        {error && <Notice role="alert">{error}</Notice>}
      </div>
    </Dialog>
  );
}
