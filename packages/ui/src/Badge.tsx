import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn.ts";
import { AlertIcon, CheckIcon, ClockIcon } from "./icons.tsx";

export type BadgeTone = "accent" | "accent-solid" | "claude" | "neutral" | "muted" | "white" | "dark";

const tones: Record<BadgeTone, string> = {
  accent: "bg-accent-soft text-accent-strong",
  "accent-solid": "bg-accent text-white",
  claude: "bg-claude-soft text-claude",
  neutral: "bg-surface-3 text-ink-2",
  muted: "bg-surface-3 text-muted",
  white: "bg-surface text-ink",
  dark: "bg-ink text-white",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  size?: "sm" | "md";
  icon?: ReactNode;
}

export function Badge({ tone = "neutral", size = "sm", icon, className, children, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full font-bold whitespace-nowrap",
        size === "sm" ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-xs",
        tones[tone],
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </span>
  );
}

export type Trust = "verified" | "stale" | "unverified";

export interface ProvenanceBadgeProps extends Omit<BadgeProps, "tone" | "icon" | "children"> {
  trust: Trust;
  // "short": "Verificado" · "long": "Verificado con la API" · or any label, e.g. "Verificado hace 3 días".
  label?: "short" | "long" | (string & {});
  withIcon?: boolean;
}

// The two provenance states of SPEC §3, plus "stale" (verified but old), which
// renders neutral rather than green.
export function ProvenanceBadge({ trust, label = "short", withIcon, size, ...rest }: ProvenanceBadgeProps) {
  const text =
    label === "short" || label === "long"
      ? trust === "unverified"
        ? "Lo escribió Claude"
        : trust === "stale"
          ? "Precio caducado"
          : label === "long"
            ? "Verificado con la API"
            : "Verificado"
      : label;
  const tone: BadgeTone = trust === "verified" ? "accent" : trust === "stale" ? "neutral" : "claude";
  const icon =
    withIcon === false ? undefined : trust === "verified" ? <CheckIcon size={14} /> : trust === "stale" ? <ClockIcon size={14} /> : <AlertIcon size={14} />;
  return (
    <Badge tone={tone} size={size} icon={withIcon ? icon : undefined} {...rest}>
      {text}
    </Badge>
  );
}
