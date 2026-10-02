import { useEffect, useRef } from "react";
import { Link, useLocation } from "react-router";
import { copy } from "@wanderlot/core";
import { useCopy, useToast } from "@wanderlot/ui";
import { usePanel, type Task } from "../data/store.tsx";

const COPY = copy({
  es: {
    guide: (ai: string, city?: string | null) => `${ai} prepara la guía${city ? ` de ${city}` : ""}`,
    flights: (ai: string, city?: string | null) => `${ai} mira vuelos en Google Flights${city ? ` · ${city}` : ""}`,
    searching: (ai: string, n: number) => `${ai} busca destinos · ${n}`,
    background: (ai: string) => `${ai} busca en segundo plano`,
    see: "Ver",
    searchDone: (n: number) => `Búsqueda terminada: ${n} propuestas nuevas`,
    searchCut: "La búsqueda se cortó",
    guideReady: (city?: string | null) => `La guía${city ? ` de ${city}` : ""} está lista`,
    guideFailed: (error: string) => `No se pudo preparar la guía: ${error}`,
    flightsRead: (city?: string | null) => `Vuelos${city ? ` de ${city}` : ""} leídos en Google Flights: elige uno`,
    flightsFailed: (error: string) => `No se pudo leer Google Flights: ${error}`,
    running: (labels: string) => `En marcha: ${labels}`,
  },
  en: {
    guide: (ai: string, city?: string | null) => `${ai} is preparing the guide${city ? ` to ${city}` : ""}`,
    flights: (ai: string, city?: string | null) => `${ai} is checking flights on Google Flights${city ? ` · ${city}` : ""}`,
    searching: (ai: string, n: number) => `${ai} is finding destinations · ${n}`,
    background: (ai: string) => `${ai} is searching in the background`,
    see: "View",
    searchDone: (n: number) => `Search finished: ${n} new proposals`,
    searchCut: "The search stopped",
    guideReady: (city?: string | null) => `The guide${city ? ` to ${city}` : ""} is ready`,
    guideFailed: (error: string) => `Couldn't prepare the guide: ${error}`,
    flightsRead: (city?: string | null) => `Flights${city ? ` to ${city}` : ""} read on Google Flights: pick one`,
    flightsFailed: (error: string) => `Couldn't read Google Flights: ${error}`,
    running: (labels: string) => `In progress: ${labels}`,
  },
});

interface Item {
  key: string;
  label: string;
  to: string;
}

// What the AI is doing right now, in the top bar, wherever the organiser is
// in the panel: a search, the trip's guide, a page read in the browser. Each
// links to its screen, and says so when it ends.
export function Activity() {
  const t = useCopy(COPY);
  const { state } = usePanel();
  const toast = useToast();
  const { pathname } = useLocation();
  const ai = state.status?.ai?.name ?? "Claude";
  const winner = state.plan?.winnerDestinationId;

  const place = (task: Task) => (task.kind !== "guide" && task.proposalId !== winner ? "/revisar" : "/viaje");
  const doing = (task: Task) => (task.kind === "guide" ? t.guide(ai, task.city) : t.flights(ai, task.city));
  const running: Item[] = [
    ...(state.generation?.running ? [{ key: "generation", label: t.searching(ai, state.generation.received), to: "/generar" }] : []),
    ...(state.job?.status === "running" ? [{ key: "job", label: t.background(state.job.aiName), to: state.job.kind === "guide" ? "/viaje" : "/generar" }] : []),
    ...state.tasks
      .filter((task) => task.status === "running")
      .map((task) => ({ key: task.id, label: doing(task), to: place(task) })),
  ];

  // Say when something ends, with a way back to it from anywhere.
  const seen = useRef(new Map<string, string>());
  useEffect(() => {
    const was = seen.current;
    const now = new Map<string, string>();
    for (const task of state.tasks) now.set(task.id, task.status);
    if (state.generation) now.set("generation", state.generation.running ? "running" : state.generation.error ? "failed" : "done");
    for (const [id, status] of now) {
      if (was.get(id) !== "running" || status === "running") continue;
      const task = state.tasks.find((x) => x.id === id);
      const to = task ? place(task) : "/generar";
      // Generar shows how its search ended; elsewhere, say it here.
      if (id === "generation" && pathname.startsWith("/generar")) continue;
      const where = pathname.startsWith(to) ? null : (
        <Link to={to} className="font-semibold text-white underline">
          {t.see}
        </Link>
      );
      const text =
        id === "generation"
          ? status === "done"
            ? t.searchDone(state.generation?.received ?? 0)
            : t.searchCut
          : task?.kind === "guide"
            ? status === "done"
              ? t.guideReady(task.city)
              : t.guideFailed(task.error ?? "error")
            : status === "done"
              ? t.flightsRead(task?.city)
              : t.flightsFailed(task?.error ?? "error");
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
      aria-label={t.running(running.map((r) => r.label).join(", "))}
      className="flex max-w-[260px] items-center gap-2 rounded-full bg-accent-soft px-3 py-1.5 text-[13px] font-semibold text-accent-strong no-underline hover:bg-accent-soft/80"
    >
      <span aria-hidden className="size-3 shrink-0 rounded-full border-2 border-accent border-t-transparent motion-safe:animate-spin" />
      <span className="min-w-0 truncate">{first!.label}</span>
      {rest.length > 0 && <span className="shrink-0 rounded-full bg-surface px-1.5 text-[11px]">+{rest.length}</span>}
    </Link>
  );
}
