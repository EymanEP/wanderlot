import { useState, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "./cn.ts";

// The grey square with an airport code that stands in for a destination.
export function IataTile({ code, size = "md", className }: { code: string; size?: "sm" | "md" | "lg"; className?: string }) {
  const s = { sm: "size-[50px] rounded-xl text-xs", md: "h-[50px] w-14 rounded-xl text-xs", lg: "size-[66px] rounded-xl text-[13px]" }[size];
  return (
    <div aria-hidden="true" className={cn("flex shrink-0 items-center justify-center bg-surface-4 font-bold tracking-[0.06em] text-muted", s, className)}>
      {code}
    </div>
  );
}

export interface PhotoProps extends HTMLAttributes<HTMLDivElement> {
  // Shown until real photos are sourced (SPEC §6), or when one fails to load:
  // "[FOTO DE LISBOA]".
  label?: string;
  src?: string;
  alt?: string;
  // Content laid over the photo (badges, buttons). Top row and bottom row.
  top?: ReactNode;
  bottom?: ReactNode;
  labelPosition?: "bottom-left" | "center";
}

export function Photo({ label, src, alt = "", top, bottom, labelPosition = "bottom-left", className, ...rest }: PhotoProps) {
  // A photo that fails to load (moved, deleted, blocked) shows the grey
  // placeholder rather than a broken-image icon.
  const [failed, setFailed] = useState<string | null>(null);
  const shown = src && failed !== src ? src : undefined;
  return (
    <div className={cn("relative flex flex-col justify-between overflow-hidden bg-surface-4 p-3.5", className)} {...rest}>
      {shown && <img src={shown} alt={alt} onError={() => setFailed(shown)} className="absolute inset-0 size-full object-cover" />}
      {top && <div className="relative flex items-start justify-between gap-2.5">{top}</div>}
      {!shown && (label || alt) && (
        <span
          className={cn(
            "relative text-xs text-muted uppercase",
            labelPosition === "center" ? "absolute inset-0 flex items-center justify-center text-center" : "mt-auto",
          )}
        >
          [{label || alt}]
        </span>
      )}
      {bottom && <div className="relative mt-auto flex items-end justify-end gap-2.5">{bottom}</div>}
    </div>
  );
}
