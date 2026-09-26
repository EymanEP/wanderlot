import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn.ts";

export interface TopBarProps {
  brand: ReactNode;
  nav?: ReactNode;
  center?: ReactNode;
  end?: ReactNode;
  variant?: "panel" | "site";
  className?: string;
}

// The header both apps share. The panel puts nav next to the brand; the site
// centres the plan pill and puts nav on the right.
export function TopBar({ brand, nav, center, end, variant = "panel", className }: TopBarProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex shrink-0 items-center justify-between gap-4 border-b border-line-soft bg-surface/95 backdrop-blur",
        variant === "panel" ? "h-[74px] px-4 sm:px-8 xl:px-14" : "h-16 px-4 sm:h-20 sm:px-8 xl:px-16",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-7">
        {brand}
        {variant === "panel" && nav}
      </div>
      {center && <div className="hidden min-w-0 lg:block">{center}</div>}
      <div className="flex shrink-0 items-center gap-3.5 sm:gap-6">
        {variant === "site" && nav}
        {end}
      </div>
    </header>
  );
}

export function Brand({ sub, size = "md" }: { sub?: ReactNode; size?: "md" | "lg" }) {
  return (
    <span className="flex items-baseline gap-[9px] whitespace-nowrap">
      <span className={cn("font-extrabold tracking-[-0.02em]", size === "lg" ? "text-[21px]" : "text-[19px]")}>Wanderlot</span>
      {sub && <span className="text-[13px] font-semibold text-muted">{sub}</span>}
    </span>
  );
}

// Site nav link: bold ink when current, quieter otherwise.
export function navLinkClasses(active: boolean): string {
  return cn(
    "text-[15px] no-underline transition-colors",
    active ? "font-bold text-ink hover:text-ink" : "font-medium text-ink-2 hover:text-ink",
  );
}

// "Noviembre 2026 · 7 – 14 nov · 6 personas" in a floating pill.
export function InfoPill({ items, end, className }: { items: ReactNode[]; end?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex h-[50px] items-center rounded-full border border-line-soft bg-surface px-[22px] shadow-pill", className)}>
      {items.map((item, i) => (
        <span key={i} className="flex items-center whitespace-nowrap">
          {i > 0 && <span className="px-3 text-faint">·</span>}
          <span className={cn("text-sm", i === 0 ? "font-bold" : "text-ink-2")}>{item}</span>
        </span>
      ))}
      {end && <span className="ml-3.5">{end}</span>}
    </div>
  );
}

export function Page({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex min-h-dvh flex-col bg-surface text-ink", className)} {...rest} />;
}

export function Main({ width = "wide", className, ...rest }: HTMLAttributes<HTMLElement> & { width?: "wide" | "full" }) {
  return (
    <main
      className={cn(
        "flex w-full flex-1 flex-col",
        width === "wide" && "mx-auto max-w-[1440px] gap-7 px-4 py-8 sm:px-8 sm:py-10 xl:px-16",
        className,
      )}
      {...rest}
    />
  );
}

export function Footer({ className, ...rest }: HTMLAttributes<HTMLElement>) {
  return <footer className={cn("mt-auto flex flex-col gap-4 border-t border-line-soft pt-6 sm:flex-row sm:items-center sm:justify-between", className)} {...rest} />;
}

// Horizontal scroller on phones, a plain row on wider screens.
export function ScrollRow({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 [scrollbar-width:none]", className)} {...rest} />;
}
