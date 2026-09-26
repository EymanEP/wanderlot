import { useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { cn } from "../cn.ts";

export interface FieldProps {
  label: ReactNode;
  // Right-aligned beside the label: the current value ("420 €", "7 – 14 nov").
  aside?: ReactNode;
  children: (ids: { inputId: string; labelId: string }) => ReactNode;
  className?: string;
  hideLabel?: boolean;
}

// Label + control. Children get the ids to wire up htmlFor / aria-labelledby.
export function Field({ label, aside, children, className, hideLabel }: FieldProps) {
  const inputId = useId();
  const labelId = `${inputId}-label`;
  return (
    <div className={cn("flex min-w-0 flex-col gap-2", className)}>
      <div className={cn("flex items-center justify-between gap-3", hideLabel && "sr-only")}>
        <label id={labelId} htmlFor={inputId} className="text-[13px] font-bold">
          {label}
        </label>
        {aside && <span className="text-[13px] font-semibold tabular-nums">{aside}</span>}
      </div>
      {children({ inputId, labelId })}
    </div>
  );
}

export const controlClasses =
  "box-border h-[46px] w-full rounded-xl border border-line bg-surface px-3.5 text-[15px] text-ink placeholder:text-muted";

export function TextInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input type="text" className={cn(controlClasses, className)} {...rest} />;
}

export function TextArea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(controlClasses, "h-auto min-h-[88px] py-3 leading-[1.45]", className)} {...rest} />;
}

export function Fieldset({ legend, children, variant = "plain", className }: { legend: ReactNode; children: ReactNode; variant?: "plain" | "muted"; className?: string }) {
  return (
    <fieldset className={cn("m-0 flex min-w-0 flex-col gap-2 border-0 p-0", variant === "muted" && "gap-2.5 rounded-tile bg-surface-2 p-3.5", className)}>
      {/* Floated so the legend lays out as an ordinary flex child inside the padding. */}
      <legend className="float-left w-full p-0 text-[13px] font-bold">{legend}</legend>
      {children}
    </fieldset>
  );
}
