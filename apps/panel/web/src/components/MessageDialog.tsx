import { Button, Dialog, TextArea, buttonClasses, useToast } from "@wanderlot/ui";

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
  const toast = useToast();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      toast("Mensaje copiado");
    } catch {
      toast("No se pudo copiar: selecciona el texto a mano");
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
            Cerrar
          </Button>
          <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer" className={buttonClasses({ variant: "secondary" })}>
            Abrir WhatsApp
          </a>
          <Button variant="primary" onClick={copy}>
            Copiar mensaje
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <span>{intro}</span>
        <TextArea aria-label="Mensaje para el grupo" readOnly rows={Math.min(10, message.split("\n").length + 2)} value={message} className="text-[13px]" />
      </div>
    </Dialog>
  );
}
