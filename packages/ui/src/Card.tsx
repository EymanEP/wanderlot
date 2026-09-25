import type { ElementType, HTMLAttributes } from "react";
import { cn } from "./cn.ts";

export type CardVariant =
  | "raised" // white, soft shadow: most cards
  | "flat" // white, lighter shadow: list rows
  | "outline" // hairline border, no shadow
  | "muted" // grey fill: secondary groups ("Fuera de tu reparto")
  | "accent" // accent tint fill ("4 de 6 votos")
  | "dashed"; // loading placeholder

const variants: Record<CardVariant, string> = {
  raised: "bg-surface shadow-raised",
  flat: "bg-surface shadow-card",
  outline: "border border-line-soft bg-surface",
  muted: "bg-surface-2",
  accent: "bg-accent-soft text-accent-strong",
  dashed: "border border-dashed border-line",
};

const paddings = { none: "", sm: "p-3.5", md: "p-5", lg: "p-6" };
const radii = { tile: "rounded-tile", lg: "rounded-2xl", card: "rounded-card" };

export interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  variant?: CardVariant;
  padding?: keyof typeof paddings;
  radius?: keyof typeof radii;
  // A 2px accent ring: the selected or approved item.
  selected?: boolean;
}

export function Card({ as: Tag = "div", variant = "raised", padding = "md", radius = "lg", selected, className, ...rest }: CardProps) {
  return (
    <Tag
      className={cn(variants[variant], paddings[padding], radii[radius], selected && "ring-2 ring-accent", className)}
      {...rest}
    />
  );
}
