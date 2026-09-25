import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn.ts";

export type ButtonVariant =
  | "primary" // solid accent: the one main action on a screen
  | "secondary" // white with a line: every other action
  | "soft" // accent tint with an accent line: "Aprobar", "Darle 1 punto"
  | "dark" // solid ink: "Comentar", active filter chip
  | "warning" // solid amber: "Verificar con la API"
  | "ghost"; // text only

export type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap font-semibold no-underline transition-colors disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-accent text-white font-bold hover:bg-accent-hover hover:text-white",
  secondary: "border border-line bg-surface text-ink hover:bg-surface-2 hover:text-ink",
  soft: "border border-accent bg-accent-soft text-accent-strong font-bold hover:bg-[#d5e8e4] hover:text-accent-strong",
  dark: "bg-ink text-white font-bold hover:bg-black hover:text-white",
  warning: "bg-claude text-white font-bold hover:bg-claude-hover hover:text-white",
  ghost: "text-ink-2 hover:bg-surface-3 hover:text-ink",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-10 rounded-xl px-4 text-[13px]",
  md: "h-11 rounded-xl px-[18px] text-sm",
  lg: "h-[52px] rounded-xl px-[26px] text-[15px]",
};

export interface ButtonStyleOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  pill?: boolean;
  block?: boolean;
}

// Exposed so apps can style router links as buttons without this package
// depending on a router.
export function buttonClasses({ variant = "secondary", size = "md", pill, block }: ButtonStyleOptions = {}): string {
  return cn(base, variants[variant], sizes[size], pill && "rounded-full", block && "w-full");
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, ButtonStyleOptions {
  icon?: ReactNode;
}

export function Button({ variant, size, pill, block, icon, className, children, type = "button", ...rest }: ButtonProps) {
  return (
    <button type={type} className={cn(buttonClasses({ variant, size, pill, block }), className)} {...rest}>
      {icon}
      {children}
    </button>
  );
}

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string; // required: icon-only buttons need an accessible name
  size?: "sm" | "md" | "lg";
  tone?: "outline" | "filled" | "floating";
}

const iconSizes = { sm: "size-[30px]", md: "size-[34px]", lg: "size-11" };
const iconTones = {
  outline: "border border-line bg-surface text-ink hover:bg-surface-2",
  filled: "bg-surface-3 text-ink hover:bg-line-soft",
  floating: "bg-surface text-ink shadow-chip hover:bg-surface-2",
};

export function IconButton({ label, size = "lg", tone = "outline", className, children, type = "button", ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        iconSizes[size],
        iconTones[tone],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
