import { createContext, useCallback, useContext, useEffect, useRef, useState, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "./cn.ts";
import { AlertIcon, CheckIcon } from "./icons.tsx";

export interface NoticeProps extends HTMLAttributes<HTMLDivElement> {
  tone?: "claude" | "accent" | "neutral";
  icon?: ReactNode | false;
}

// Inline callout: "Precio y horarios salen de búsquedas web…".
export function Notice({ tone = "claude", icon, className, children, ...rest }: NoticeProps) {
  const t = { claude: "bg-claude-soft text-claude", accent: "bg-accent-soft text-accent-strong", neutral: "bg-surface-2 text-ink-2" }[tone];
  const defaultIcon = tone === "accent" ? <CheckIcon size={17} strokeWidth={2} /> : <AlertIcon size={17} strokeWidth={2} />;
  return (
    <div role="note" className={cn("flex items-start gap-2.5 rounded-xl px-[13px] py-[11px] text-[13px] leading-[1.4]", t, className)} {...rest}>
      {icon !== false && <span className="mt-px shrink-0">{icon ?? defaultIcon}</span>}
      <span>{children}</span>
    </div>
  );
}

export function StatusDot({ tone = "off", children }: { tone?: "off" | "on" | "busy"; children: ReactNode }) {
  const dot = { off: "bg-dot", on: "bg-accent", busy: "bg-claude animate-pulse-soft" }[tone];
  return (
    <span className="inline-flex items-center gap-2 text-[13px] text-muted">
      <span className={cn("size-2 rounded-full", dot)} />
      {children}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("animate-pulse-soft rounded-full bg-line-soft", className)} />;
}

export function EmptyState({ title, children, action, className }: { title: ReactNode; children?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line px-6 py-10 text-center", className)}>
      <p className="m-0 text-[15px] font-bold">{title}</p>
      {children && <p className="m-0 max-w-md text-sm text-muted">{children}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

// --- toasts -------------------------------------------------------------------

interface ToastItem {
  id: number;
  message: ReactNode;
}

const ToastContext = createContext<((message: ReactNode) => void) | null>(null);

// Short confirmations for mock actions ("Toque enviado a Laura y Diego").
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const next = useRef(0);
  const show = useCallback((message: ReactNode) => {
    const id = ++next.current;
    setItems((xs) => [...xs, { id, message }]);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex flex-col items-center gap-2 px-4">
        {items.map((t) => (
          <Toast key={t.id} onDone={() => setItems((xs) => xs.filter((x) => x.id !== t.id))}>
            {t.message}
          </Toast>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function Toast({ children, onDone }: { children: ReactNode; onDone: () => void }) {
  // Keep the timer from restarting when a newer toast re-renders the list.
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    const t = setTimeout(() => done.current(), 3200);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="pointer-events-auto flex animate-toast-in items-center gap-2.5 rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-white shadow-pop">
      <CheckIcon size={16} className="text-[#8fd3c7]" />
      {children}
    </div>
  );
}

export function useToast(): (message: ReactNode) => void {
  const show = useContext(ToastContext);
  if (!show) throw new Error("useToast needs a <ToastProvider>");
  return show;
}
