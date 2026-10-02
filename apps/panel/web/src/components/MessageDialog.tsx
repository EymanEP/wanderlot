import { copy } from "@wanderlot/core";
import { Button, Dialog, TextArea, buttonClasses, useCopy, useToast } from "@wanderlot/ui";

const COPY = copy({
  es: {
    copied: "Mensaje copiado",
    copyFailed: "No se pudo copiar: selecciona el texto a mano",
    close: "Cerrar",
    whatsapp: "Abrir WhatsApp",
    copy: "Copiar mensaje",
    message: "Mensaje para el grupo",
  },
  en: {
    copied: "Message copied",
    copyFailed: "Couldn't copy it: select the text by hand",
    close: "Close",
    whatsapp: "Open WhatsApp",
    copy: "Copy message",
    message: "Message for the group",
  },
});

export interface MessageDialogProps {
  open: boolean;
  title: string;
  intro: string;
  message: string;
  onClose: () => void;
}

// A ready-to-paste message for the group chat (SPEC §7): open it in WhatsApp
// or copy it.
export function MessageDialog({ open, title, intro, message, onClose }: MessageDialogProps) {
  const t = useCopy(COPY);
  const toast = useToast();
  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message);
      toast(t.copied);
    } catch {
      toast(t.copyFailed);
    }
  };
  return (
    <Dialog
      open={open}
      title={title}
      onClose={onClose}
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t.close}
          </Button>
          <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer" className={buttonClasses({ variant: "secondary" })}>
            {t.whatsapp}
          </a>
          <Button variant="primary" onClick={copyMessage}>
            {t.copy}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <span>{intro}</span>
        <TextArea aria-label={t.message} readOnly rows={Math.min(10, message.split("\n").length + 2)} value={message} className="text-[13px]" />
      </div>
    </Dialog>
  );
}
