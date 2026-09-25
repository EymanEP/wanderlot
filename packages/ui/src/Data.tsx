import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn.ts";
import { CheckIcon, DashIcon } from "./icons.tsx";

export interface StatTileProps {
  label: ReactNode;
  value: ReactNode;
  tone?: "neutral" | "accent" | "claude";
  className?: string;
}

// "Vuelo · Directo · 2 h 40 m": one fact in a grey tile.
export function StatTile({ label, value, tone = "neutral", className }: StatTileProps) {
  const t = { neutral: ["bg-surface-2", "text-muted", "text-ink"], accent: ["bg-accent-soft", "text-accent-strong", "text-accent-strong"], claude: ["bg-claude-soft", "text-claude", "text-claude"] }[tone];
  return (
    <div className={cn("flex flex-col gap-[3px] rounded-tile px-[18px] py-4", t[0], className)}>
      <span className={cn("text-[13px]", t[1])}>{label}</span>
      <span className={cn("text-[17px] font-bold", t[2])}>{value}</span>
    </div>
  );
}

export function DataList({ className, ...rest }: HTMLAttributes<HTMLDListElement>) {
  return <dl className={cn("m-0 flex flex-col gap-[11px]", className)} {...rest} />;
}

export interface DataRowProps {
  label: ReactNode;
  value: ReactNode;
  // "highlight" is the boxed total: "Total / persona · 412 €".
  variant?: "plain" | "highlight" | "highlight-muted";
  className?: string;
}

export function DataRow({ label, value, variant = "plain", className }: DataRowProps) {
  if (variant === "plain") {
    return (
      <div className={cn("flex items-baseline justify-between gap-2.5", className)}>
        <dt className="text-[13px] text-muted">{label}</dt>
        <dd className="m-0 text-right text-sm font-semibold tabular-nums">{value}</dd>
      </div>
    );
  }
  const accent = variant === "highlight";
  return (
    <div className={cn("flex items-center justify-between gap-2.5 rounded-xl px-[13px] py-[11px]", accent ? "bg-accent-soft" : "bg-surface-3", className)}>
      <dt className={cn("text-xs font-bold", accent ? "text-accent-strong" : "text-ink-2")}>{label}</dt>
      <dd className={cn("m-0 text-[21px] font-extrabold tracking-[-0.02em] tabular-nums", accent && "text-accent-strong")}>{value}</dd>
    </div>
  );
}

export interface ProsConsProps {
  pros: readonly ReactNode[];
  cons: readonly ReactNode[];
  prosLabel?: string;
  consLabel?: string;
  className?: string;
}

export function ProsCons({ pros, cons, prosLabel = "A favor", consLabel = "En contra", className }: ProsConsProps) {
  return (
    <div className={cn("flex flex-col gap-3.5", className)}>
      <MarkList label={prosLabel} items={pros} kind="pro" />
      <MarkList label={consLabel} items={cons} kind="con" />
    </div>
  );
}

export function MarkList({ label, items, kind }: { label: string; items: readonly ReactNode[]; kind: "pro" | "con" }) {
  return (
    <div className="flex flex-col gap-2">
      <span className={cn("text-xs font-bold", kind === "pro" ? "text-accent-strong" : "text-muted")}>{label}</span>
      <ul className="m-0 flex list-none flex-col gap-[7px] p-0">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2 text-[13px] leading-[1.35] text-ink-2">
            {kind === "pro" ? (
              <CheckIcon size={15} className="mt-0.5 shrink-0 text-accent" />
            ) : (
              <DashIcon size={15} className="mt-0.5 shrink-0 text-muted" />
            )}
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface BulletItem {
  title: ReactNode;
  detail?: ReactNode;
}

// "Qué hacer" / "Qué ver": a titled list of specific things.
export function BulletList({ label, items, tone = "accent", className }: { label: string; items: readonly BulletItem[]; tone?: "accent" | "neutral"; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <span className={cn("text-xs font-bold", tone === "accent" ? "text-accent-strong" : "text-ink-2")}>{label}</span>
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {items.map((item, i) => (
          <li key={i} className="flex gap-[11px]">
            <span className={cn("mt-[7px] size-[7px] shrink-0 rounded-full", tone === "accent" ? "bg-accent" : "bg-faint")} />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-bold">{item.title}</span>
              {item.detail && <span className="text-[13px] leading-[1.35] text-muted">{item.detail}</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
