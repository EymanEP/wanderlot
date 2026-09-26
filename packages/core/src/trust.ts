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

// Badge copy as the site shows it. A price the organiser checked by hand says
// so ("Comprobado"), rather than claiming a flight API confirmed it.
export function trustLabel(state: TrustState, by: Provenance["kind"] = "api"): string {
  if (state.kind === "unverified") return "Lo escribió Claude";
  const verb = by === "organiser" ? "Comprobado" : "Verificado";
  const hours = Math.floor(state.ageMs / 3_600_000);
  if (hours < 1) return `${verb} hace un momento`;
  if (hours < 24) return `${verb} hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `${verb} hace ${days} ${days === 1 ? "día" : "días"}`;
}
