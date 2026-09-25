import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "../cn.ts";
import { IconButton } from "../Button.tsx";
import { MinusIcon, PlusIcon } from "../icons.tsx";

export interface StepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  unit: string; // "viajamos"
  decrementLabel: string;
  incrementLabel: string;
}

// "6 viajamos  (−) (+)"
export function Stepper({ value, onChange, min = 1, max = 20, unit, decrementLabel, incrementLabel }: StepperProps) {
  return (
    <div className="box-border flex h-[46px] items-center justify-between rounded-xl border border-line pr-[7px] pl-3.5">
      <span className="text-[15px]" aria-live="polite">
        <strong className="font-bold tabular-nums">{value}</strong> <span className="text-muted">{unit}</span>
      </span>
      <div className="flex gap-1.5">
        <IconButton label={decrementLabel} size="sm" className="size-8" disabled={value <= min} onClick={() => onChange(value - 1)}>
          <MinusIcon size={15} />
        </IconButton>
        <IconButton label={incrementLabel} size="sm" className="size-8" disabled={value >= max} onClick={() => onChange(value + 1)}>
          <PlusIcon size={15} />
        </IconButton>
      </div>
    </div>
  );
}

export function Range({ className, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return <input type="range" className={cn("m-0 h-[26px] w-full cursor-pointer", className)} {...rest} />;
}

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: ReactNode;
  // "box" is the grey row used for "Entra en la votación".
  variant?: "plain" | "box";
}

export function Checkbox({ label, variant = "plain", className, ...rest }: CheckboxProps) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-2.5",
        variant === "plain" ? "text-sm font-medium" : "h-[46px] rounded-xl bg-surface-2 px-3.5 text-[13px] font-semibold",
        className,
      )}
    >
      <input type="checkbox" className="m-0 size-[17px] shrink-0" {...rest} />
      {label}
    </label>
  );
}

export interface RadioCardProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "title"> {
  title: ReactNode;
  description?: ReactNode;
}

// A radio with a title and a line of help, ringed when chosen ("API de vuelos").
export function RadioCard({ title, description, checked, className, ...rest }: RadioCardProps) {
  return (
    <label
      className={cn(
        "flex flex-1 cursor-pointer items-start gap-[9px] rounded-xl bg-surface px-[13px] py-[11px]",
        checked ? "ring-2 ring-accent" : "ring-1 ring-line",
        className,
      )}
    >
      <input type="radio" checked={checked} className="m-0 mt-[3px]" {...rest} />
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-bold">{title}</span>
        {description && <span className="text-xs text-muted">{description}</span>}
      </span>
    </label>
  );
}
