import { cn } from "./cn.ts";

export type AvatarTint = "accent" | "sand" | "lilac" | "mint" | "sky" | "rose" | "white" | "empty";

const tints: Record<AvatarTint, string> = {
  accent: "bg-accent text-white",
  sand: "bg-tint-sand text-ink-2",
  lilac: "bg-tint-lilac text-ink-2",
  mint: "bg-tint-mint text-accent-strong",
  sky: "bg-tint-sky text-ink-2",
  rose: "bg-tint-rose text-ink-2",
  white: "bg-surface text-ink-2",
  empty: "bg-surface text-muted",
};

const sizes = {
  xs: "size-[26px] text-[10px]",
  sm: "size-[30px] text-[11px]",
  md: "size-[34px] text-xs",
  lg: "size-[38px] text-[13px]",
  xl: "size-10 text-[13px]",
};

export interface AvatarProps {
  initials: string;
  name?: string; // spoken instead of the initials when given
  tint?: AvatarTint;
  size?: keyof typeof sizes;
  className?: string;
}

export function Avatar({ initials, name, tint = "sand", size = "md", className }: AvatarProps) {
  return (
    <span
      role={name ? "img" : undefined}
      aria-label={name}
      aria-hidden={name ? undefined : true}
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-bold", sizes[size], tints[tint], className)}
    >
      {initials}
    </span>
  );
}
