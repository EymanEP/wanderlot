import type { Provenance } from "./model.ts";
import { currentLocale, type Locale } from "./i18n.ts";

// A verification older than this is stale (SPEC §3).
export const STALE_AFTER_MS = 72 * 60 * 60 * 1000;

export type TrustState =
  | { kind: "verified"; ageMs: number }
  // Too old, or checked for dates the trip no longer has.
  | { kind: "stale"; ageMs: number; otherDates?: boolean }
  // Research's figures: by which AI, and whether it could search the web.
  | { kind: "unverified"; by?: string; estimate?: boolean };

export function trustState(p: Provenance, now: Date): TrustState {
  if (p.kind === "claude") return { kind: "unverified", ...(p.by ? { by: p.by } : {}), ...(p.estimate ? { estimate: true } : {}) };
  const ageMs = Math.max(0, now.getTime() - Date.parse(p.checkedAt));
  if (p.forOtherDates) return { kind: "stale", ageMs, otherDates: true };
  return { kind: ageMs > STALE_AFTER_MS ? "stale" : "verified", ageMs };
}

// Badge copy as the site shows it. A price the organiser checked by hand says
// so ("Comprobado"), rather than claiming a flight API confirmed it.
export function trustLabel(state: TrustState, by: Provenance["kind"] = "api", l: Locale = currentLocale()): string {
  if (l === "en") {
    if (state.kind === "unverified") return state.estimate ? `Estimated by ${state.by ?? "Claude"}` : `Written by ${state.by ?? "Claude"}`;
    if (state.kind === "stale" && state.otherDates) return "Price for other dates";
    const verb = by === "organiser" ? "Checked" : "Verified";
    const hours = Math.floor(state.ageMs / 3_600_000);
    if (hours < 1) return `${verb} just now`;
    if (hours < 24) return `${verb} ${hours} h ago`;
    const days = Math.floor(hours / 24);
    return `${verb} ${days} ${days === 1 ? "day" : "days"} ago`;
  }
  if (state.kind === "unverified") return state.estimate ? `Estimado por ${state.by ?? "Claude"}` : `Lo escribió ${state.by ?? "Claude"}`;
  if (state.kind === "stale" && state.otherDates) return "Precio de otras fechas";
  const verb = by === "organiser" ? "Comprobado" : "Verificado";
  const hours = Math.floor(state.ageMs / 3_600_000);
  if (hours < 1) return `${verb} hace un momento`;
  if (hours < 24) return `${verb} hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `${verb} hace ${days} ${days === 1 ? "día" : "días"}`;
}
