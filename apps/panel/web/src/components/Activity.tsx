import { useEffect, useRef } from "react";
import { Link, useLocation } from "react-router";
import { useToast } from "@wanderlot/ui";
import { euros, flightPriceCents, stayShareCents } from "@wanderlot/core";
import type { PriceCheck } from "../data/backend.ts";
import { usePanel, type Task } from "../data/store.tsx";

interface Item {
  key: string;
  label: string;
  to: string;
}

const SITE = { flight: "Google Flights", stay: "Airbnb" } as const;

// How "Comprobar precios" ended, in a line.
function pricesText(t: Task, status: string, plan: { nights: number; partySize: number } | null): string {
  const of = t.city ? ` de ${t.city}` : "";
  if (status !== "done") return `No se pudieron comprobar los precios${of}: ${t.error ?? "error"}`;
  const r = t.result as PriceCheck;
  if (r.saved && plan) {
    const share = stayShareCents(r.saved.stays, plan.nights, plan.partySize) ?? 0;
    return `Precios${of} comprobados y guardados: ${euros(flightPriceCents(r.saved) + share)} por persona`;
  }
  return `Faltan datos${of}: ${(r.missing ?? []).join(", ")}. Revísalo en sus precios`;
}

// What the AI is doing right now, in the top bar, wherever the organiser is
// in the panel: a search, the trip's guide, a page read in the browser. Each
// links to its screen, and says so when it ends.
export function Activity() {
  const { state } = usePanel();
  const toast = useToast();
  const { pathname } = useLocation();
  const ai = state.status?.ai?.name ?? "Claude";
  const winner = state.plan?.winnerDestinationId;

  const place = (t: Task) => (t.kind !== "guide" && t.proposalId !== winner ? "/revisar" : "/viaje");
  const doing = (t: Task) =>
    t.kind === "guide"
      ? `${ai} prepara la guía${t.city ? ` de ${t.city}` : ""}`
      : t.kind === "prices"
        ? `${ai} comprueba precios${t.city ? ` de ${t.city}` : ""} · ${SITE[t.site ?? "flight"]}`
        : `${ai} mira ${SITE[t.site!]}${t.city ? ` · ${t.city}` : ""}`;
  const running: Item[] = [
    ...(state.generation?.running ? [{ key: "generation", label: `${ai} busca destinos · ${state.generation.received}`, to: "/generar" }] : []),
    ...(state.job?.status === "running" ? [{ key: "job", label: `${state.job.aiName} busca en segundo plano`, to: state.job.kind === "guide" ? "/viaje" : "/generar" }] : []),
    ...state.tasks
      .filter((t) => t.status === "running")
      .map((t) => ({ key: t.id, label: doing(t), to: place(t) })),
  ];

  // Say when something ends, with a way back to it from anywhere.
  const seen = useRef(new Map<string, string>());
  useEffect(() => {
    const was = seen.current;
    const now = new Map<string, string>();
    for (const t of state.tasks) now.set(t.id, t.status);
    if (state.generation) now.set("generation", state.generation.running ? "running" : state.generation.error ? "failed" : "done");
    for (const [id, status] of now) {
      if (was.get(id) !== "running" || status === "running") continue;
      const t = state.tasks.find((x) => x.id === id);
      const to = t ? place(t) : "/generar";
      // Generar shows how its search ended; elsewhere, say it here.
      if (id === "generation" && pathname.startsWith("/generar")) continue;
      const where = pathname.startsWith(to) ? null : (
        <Link to={to} className="font-semibold text-white underline">
          Ver
        </Link>
      );
      const text =
        id === "generation"
          ? status === "done"
            ? `Búsqueda terminada: ${state.generation?.received ?? 0} propuestas nuevas`
            : "La búsqueda se cortó"
          : t?.kind === "prices"
            ? pricesText(t, status, state.plan)
            : t?.kind === "guide"
            ? status === "done"
              ? `La guía${t.city ? ` de ${t.city}` : ""} está lista`
              : `No se pudo preparar la guía: ${t.error ?? "error"}`
            : status === "done"
              ? `${SITE[t!.site!]} leído${t?.city ? ` para ${t.city}` : ""}: revisa los precios y guárdalos`
              : `No se pudo leer ${SITE[t!.site!]}: ${t?.error ?? "error"}`;
      toast(
        <span className="flex items-center gap-3">
          {text}
          {where}
        </span>,
      );
    }
    seen.current = now;
    // Only when something changes state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.tasks.map((t) => `${t.id}:${t.status}`).join(), state.generation?.running]);

  if (!running.length) return null;
  const [first, ...rest] = running;
  return (
    <Link
      to={first!.to}
      role="status"
      aria-label={`En marcha: ${running.map((r) => r.label).join(", ")}`}
      className="flex max-w-[260px] items-center gap-2 rounded-full bg-accent-soft px-3 py-1.5 text-[13px] font-semibold text-accent-strong no-underline hover:bg-accent-soft/80"
    >
      <span aria-hidden className="size-3 shrink-0 rounded-full border-2 border-accent border-t-transparent motion-safe:animate-spin" />
      <span className="min-w-0 truncate">{first!.label}</span>
      {rest.length > 0 && <span className="shrink-0 rounded-full bg-surface px-1.5 text-[11px]">+{rest.length}</span>}
    </Link>
  );
}
