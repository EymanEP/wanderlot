import { useEffect, useState } from "react";

type View = {
  plan: { id: string; name: string; status: "draft" | "voting" | "closed"; dateFrom: string; dateTo: string; partySize: number; origin: string };
  destinations: { id: string; place: { city: string; country: string }; totalPerPersonCents: number }[];
  me: { name: string };
};

type State = { kind: "loading" } | { kind: "nolink" } | { kind: "error"; message: string } | { kind: "ok"; view: View };

const euros = (cents: number) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(cents / 100);

function planIdFromPath(): string | null {
  return /^\/p\/([a-z0-9-]+)\/?$/.exec(window.location.pathname)?.[1] ?? null;
}

export function App() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    const planId = planIdFromPath();
    if (!planId) return setState({ kind: "nolink" });
    fetch(`/api/plans/${planId}`)
      .then(async (r) => {
        if (r.status === 401) return setState({ kind: "nolink" });
        if (!r.ok) throw new Error(`API ${r.status}`);
        setState({ kind: "ok", view: (await r.json()) as View });
      })
      .catch((e: Error) => setState({ kind: "error", message: e.message }));
  }, []);

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-line px-4 py-4 sm:px-8">
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-extrabold tracking-tight">Wanderlot</span>
          <span className="text-sm text-muted">Grupo 51</span>
        </div>
        {state.kind === "ok" && <span className="text-sm text-ink-2">Hola, {state.view.me.name}</span>}
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-8">
        {state.kind === "loading" && <p className="text-muted">Cargando…</p>}
        {state.kind === "nolink" && <p className="text-ink-2">Pide tu enlace al organizador.</p>}
        {state.kind === "error" && <p className="text-claude">Algo ha fallado: {state.message}</p>}
        {state.kind === "ok" && <Plan view={state.view} />}
      </main>
    </div>
  );
}

function Plan({ view }: { view: View }) {
  const { plan, destinations } = view;
  return (
    <>
      <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{plan.name}</h1>
      <p className="mt-2 text-muted">
        {plan.dateFrom} – {plan.dateTo} · {plan.partySize} personas · desde {plan.origin}
      </p>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {destinations.map((d) => (
          <li key={d.id} className="rounded-xl border border-line p-5">
            <p className="text-lg font-bold">{d.place.city}</p>
            <p className="text-sm text-muted">{d.place.country}</p>
            <p className="mt-4 font-semibold">{euros(d.totalPerPersonCents)} por persona</p>
          </li>
        ))}
      </ul>
    </>
  );
}
