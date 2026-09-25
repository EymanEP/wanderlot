import type { ElementType, HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn.ts";

type HeadingSize = "hero" | "display" | "title" | "headline" | "heading" | "subheading" | "card" | "small";

// Large sizes step down on phones so titles never overflow.
const headingSizes: Record<HeadingSize, string> = {
  hero: "text-[40px] leading-none tracking-[-0.035em] font-extrabold sm:text-hero",
  display: "text-[38px] leading-[1.05] tracking-[-0.035em] font-extrabold sm:text-display",
  title: "text-[30px] leading-[1.05] tracking-[-0.03em] font-extrabold sm:text-title",
  headline: "text-[26px] leading-[1.05] tracking-[-0.03em] font-extrabold sm:text-headline",
  heading: "text-xl sm:text-heading font-bold",
  subheading: "text-lg font-bold tracking-[-0.02em]",
  card: "text-[15px] font-bold",
  small: "text-xs font-bold",
};

export interface HeadingProps extends HTMLAttributes<HTMLHeadingElement> {
  as?: ElementType;
  size?: HeadingSize;
}

export function Heading({ as: Tag = "h2", size = "heading", className, ...rest }: HeadingProps) {
  return <Tag className={cn("m-0 text-balance", headingSizes[size], className)} {...rest} />;
}

export type TextTone = "ink" | "ink-2" | "muted" | "accent" | "claude";

const tones: Record<TextTone, string> = {
  ink: "text-ink",
  "ink-2": "text-ink-2",
  muted: "text-muted",
  accent: "text-accent-strong",
  claude: "text-claude",
};

export interface TextProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  tone?: TextTone;
  size?: "xs" | "sm" | "md" | "lg";
  weight?: "normal" | "medium" | "semibold" | "bold";
}

const textSizes = { xs: "text-xs", sm: "text-[13px] leading-[1.45]", md: "text-sm leading-[1.45]", lg: "text-[15px] sm:text-base leading-[1.45]" };
const weights = { normal: "font-normal", medium: "font-medium", semibold: "font-semibold", bold: "font-bold" };

export function Text({ as: Tag = "p", tone = "ink-2", size = "md", weight = "normal", className, ...rest }: TextProps) {
  return <Tag className={cn("m-0 text-pretty", tones[tone], textSizes[size], weights[weight], className)} {...rest} />;
}

// The small bold label above a group: "A favor", "Qué hacer", "Fuente de datos".
export function Eyebrow({ tone = "muted", className, ...rest }: HTMLAttributes<HTMLSpanElement> & { tone?: TextTone }) {
  return <span className={cn("text-xs font-bold", tones[tone], className)} {...rest} />;
}

// Numbers that line up: prices, counts, times.
export function Num({ className, ...rest }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("tabular-nums", className)} {...rest} />;
}

export interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  back?: ReactNode; // a link rendered above the title
  actions?: ReactNode;
  size?: "hero" | "display" | "title" | "headline";
  className?: string;
}

export function PageHeader({ title, subtitle, back, actions, size = "title", className }: PageHeaderProps) {
  return (
    <section className={cn("flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between lg:gap-12", className)}>
      <div className="flex max-w-[820px] min-w-0 flex-col gap-2.5">
        {back}
        <Heading as="h1" size={size}>
          {title}
        </Heading>
        {subtitle && (
          <Text size={size === "display" || size === "hero" ? "lg" : "md"} tone={size === "title" || size === "headline" ? "muted" : "ink-2"}>
            {subtitle}
          </Text>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-3 lg:gap-[18px]">{actions}</div>}
    </section>
  );
}

export interface SectionHeaderProps {
  title: ReactNode;
  aside?: ReactNode;
  size?: "heading" | "subheading" | "card";
  as?: ElementType;
  id?: string;
  className?: string;
}

export function SectionHeader({ title, aside, size = "heading", as = "h2", id, className }: SectionHeaderProps) {
  return (
    <div className={cn("flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1", className)}>
      <Heading as={as} size={size} id={id}>
        {title}
      </Heading>
      {aside && <span className="text-[13px] text-muted">{aside}</span>}
    </div>
  );
}
