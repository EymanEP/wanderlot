import { extendTailwindMerge } from "tailwind-merge";

// tailwind-merge knows Tailwind's defaults; teach it our tokens from
// theme.css so e.g. "text-display" and "text-ink" don't cancel each other,
// and a caller's "h-[46px]" replaces a component's "h-11".
const merge = extendTailwindMerge({
  extend: {
    theme: {
      color: [
        "ink", "ink-2", "muted", "faint", "dot", "line", "line-soft", "line-faint",
        "surface", "canvas", "surface-2", "surface-3", "surface-4",
        "accent", "accent-hover", "accent-strong", "accent-soft",
        "claude", "claude-hover", "claude-soft",
        "tint-sand", "tint-lilac", "tint-mint", "tint-sky", "tint-rose",
      ],
      text: ["display", "hero", "title", "headline", "heading"],
      radius: ["tile", "card"],
      shadow: ["card", "raised", "pop", "pill", "chip"],
    },
  },
});

// Joins class names, skipping falsy entries; later classes win conflicts.
export function cn(...parts: (string | false | null | undefined)[]): string {
  return merge(parts.filter(Boolean).join(" "));
}
