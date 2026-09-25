import type { Provenance } from "./model.ts";

// A verification older than this is stale (SPEC §3).
export const STALE_AFTER_MS = 72 * 60 * 60 * 1000;

export type TrustState =
  | { kind: "verified"; ageMs: number }
  | { kind: "stale"; ageMs: number }
  | { kind: "unverified" };

export function trustState(p: Provenance, now: Date): TrustState {
  if (p.kind === "claude") return { kind: "unverified" };
  const ageMs = Math.max(0, now.getTime() - Date.parse(p.checkedAt));
  return { kind: ageMs > STALE_AFTER_MS ? "stale" : "verified", ageMs };
}

// Badge copy as the site shows it.
export function trustLabel(state: TrustState): string {
  if (state.kind === "unverified") return "Lo escribió Claude";
  const hours = Math.floor(state.ageMs / 3_600_000);
  if (hours < 1) return "Verificado hace un momento";
  if (hours < 24) return `Verificado hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `Verificado hace ${days} ${days === 1 ? "día" : "días"}`;
}
