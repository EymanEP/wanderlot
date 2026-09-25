import { useEffect, useState } from "react";

type Plan = { id: string; name: string; status: "draft" | "voting" | "closed" };

const TABS = [
  { id: "generar", label: "Generar" },
  { id: "revisar", label: "Revisar" },
  { id: "comparativa", label: "Comparativa" },
] as const;
type Tab = (typeof TABS)[number]["id"];

export function App() {
  const [tab, setTab] = useState<Tab>("generar");
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/plans")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`API ${r.status}`))))
      .then(setPlans)
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <div className="min-h-screen">
      <header className="flex items-center gap-8 border-b border-line px-8 py-4">
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-extrabold tracking-tight">Wanderlot</span>
          <span className="text-sm text-muted">Panel local</span>
        </div>
        <nav className="flex gap-1" aria-label="Secciones">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? "page" : undefined}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                tab === t.id ? "bg-accent-soft text-accent-hover" : "text-ink-2 hover:bg-surface-2"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-8 py-10">
        <h1 className="text-3xl font-extrabold tracking-tight">{TABS.find((t) => t.id === tab)!.label}</h1>
        <p className="mt-2 text-muted">Nada llega al sitio de la cuadrilla hasta que tú lo apruebes.</p>

        <section className="mt-8 rounded-xl border border-line p-6">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Planes</h2>
          {error && <p className="mt-3 text-claude">No se pudo leer la API del panel: {error}</p>}
          {plans?.length === 0 && <p className="mt-3 text-ink-2">Todavía no hay ningún plan.</p>}
          <ul className="mt-3 divide-y divide-line-soft">
            {plans?.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-3">
                <span className="font-semibold">{p.name}</span>
                <span className="text-sm text-muted">{p.status}</span>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
