import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "./Button.tsx";
import { Heading, Text } from "./Typography.tsx";

export interface DialogProps {
  open: boolean;
  title: ReactNode;
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "primary" | "warning";
  onConfirm?: () => void;
  onClose: () => void;
  busy?: boolean;
  // Replaces the default Cancel / Confirm buttons.
  actions?: ReactNode;
}

// A modal confirmation on the native <dialog>: focus trapping, Escape and the
// backdrop come from the browser.
export function Dialog({ open, title, children, confirmLabel, cancelLabel = "Cancelar", tone = "primary", onConfirm, onClose, busy, actions }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal?.();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-auto w-[min(480px,calc(100vw-32px))] rounded-card border-0 bg-surface p-0 text-ink shadow-pop backdrop:bg-ink/40"
    >
      <div className="flex flex-col gap-4 p-6">
        <Heading size="subheading">{title}</Heading>
        {children && <Text as="div">{children}</Text>}
        <div className="flex flex-wrap justify-end gap-2 pt-2">
          {actions ?? (
            <>
              <Button onClick={onClose}>{cancelLabel}</Button>
              <Button variant={tone} onClick={onConfirm} disabled={busy} autoFocus>
                {confirmLabel}
              </Button>
            </>
          )}
        </div>
      </div>
    </dialog>
  );
}
