import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn.ts";

export type ChipVariant =
  | "outline" // filter pills: "3 noches", on = accent tint
  | "solid" // Revisar filters: on = ink
  | "subtle" // quiet pills: "± 1 día", on = grey fill
  | "nav"; // panel top nav: on = grey fill, bold

const variants: Record<ChipVariant, { base: string; on: string; off: string }> = {
  outline: {
    base: "border",
    on: "border-accent bg-accent-soft text-accent-strong font-bold",
    off: "border-line bg-surface text-ink font-medium hover:bg-surface-2",
  },
  solid: {
    base: "border",
    on: "border-ink bg-ink text-white font-bold",
    off: "border-line bg-surface text-ink font-medium hover:bg-surface-2",
  },
  subtle: {
    base: "",
    on: "bg-surface-3 text-ink font-bold",
    off: "bg-transparent text-ink-2 font-medium hover:bg-surface-2",
  },
  nav: {
    base: "",
    on: "bg-surface-3 text-ink font-bold",
    off: "bg-transparent text-ink-2 font-semibold hover:bg-surface-2 hover:text-ink",
  },
};

const sizes = { sm: "h-8 px-3 text-xs", md: "h-9 px-[15px] text-[13px]", lg: "h-[42px] px-[17px] text-sm" };

export function chipClasses(variant: ChipVariant, on: boolean, size: keyof typeof sizes = "md"): string {
  const v = variants[variant];
  return cn(
    "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-full no-underline transition-colors",
    sizes[size],
    v.base,
    on ? v.on : v.off,
  );
}

export interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  on: boolean;
  variant?: ChipVariant;
  size?: keyof typeof sizes;
  icon?: ReactNode;
}

// A pressable pill. Announces its state with aria-pressed.
export function Chip({ on, variant = "outline", size = "md", icon, className, children, type = "button", ...rest }: ChipProps) {
  return (
    <button type={type} aria-pressed={on} className={cn(chipClasses(variant, on, size), className)} {...rest}>
      {icon}
      {children}
    </button>
  );
}

export interface ChoiceChipProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size"> {
  type: "radio" | "checkbox";
  label: ReactNode;
}

// A real radio or checkbox dressed as a pill ("Directo", "Estimar alojamiento").
export function ChoiceChip({ type, label, checked, className, ...rest }: ChoiceChipProps) {
  return (
    <label className={cn(chipClasses("outline", !!checked, "lg"), "px-[15px]", className)}>
      <input type={type} checked={checked} className="m-0" {...rest} />
      {label}
    </label>
  );
}
