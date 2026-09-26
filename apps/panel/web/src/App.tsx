import type { ReactNode } from "react";
import { Link, Navigate, Route, Routes } from "react-router";
import { EmptyState, Page, Skeleton, buttonClasses } from "@wanderlot/ui";
import { PanelShell } from "./components/PanelShell.tsx";
import { usePanel } from "./data/store.tsx";
import { ComparativaPage } from "./pages/ComparativaPage.tsx";
import { GenerarPage } from "./pages/GenerarPage.tsx";
import { NewPlanPage } from "./pages/NewPlanPage.tsx";
import { VotacionPage } from "./pages/VotacionPage.tsx";
import { PersonasPage } from "./pages/PersonasPage.tsx";
import { RevisarPage } from "./pages/RevisarPage.tsx";
import { TripsPage } from "./pages/TripsPage.tsx";

// Generar, Revisar and Comparativa work on a plan; without one, make one.
function RequirePlan({ children }: { children: ReactNode }) {
  const { state } = usePanel();
  if (state.loading) {
    return (
      <Page>
        <div aria-busy="true" className="mx-auto flex w-full max-w-[1100px] flex-col gap-4 px-8 py-12">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
      </Page>
    );
  }
  if (state.error) {
    return (
      <PanelShell showPlan={false}>
        <main className="mx-auto w-full max-w-[720px] px-4 py-12">
          <EmptyState title="El panel no arranca">{state.error}</EmptyState>
        </main>
      </PanelShell>
    );
  }
  if (!state.plan) {
    return (
      <PanelShell showPlan={false}>
        <main className="mx-auto w-full max-w-[720px] px-4 py-12">
          <EmptyState
            title="Todavía no hay ningún plan"
            action={
              <Link to="/planes/nuevo" className={buttonClasses({ variant: "primary" })}>
                Crear el primero
              </Link>
            }
          >
            Un plan es una ventana de viaje: sus fechas, quién va y cuánto gastar.
          </EmptyState>
        </main>
      </PanelShell>
    );
  }
  return children;
}

export function App() {
  return (
    <Routes>
      <Route index element={<TripsPage />} />
      <Route path="/generar" element={<RequirePlan><GenerarPage /></RequirePlan>} />
      <Route path="/revisar" element={<RequirePlan><RevisarPage /></RequirePlan>} />
      <Route path="/comparativa" element={<RequirePlan><ComparativaPage /></RequirePlan>} />
      <Route path="/votacion" element={<RequirePlan><VotacionPage /></RequirePlan>} />
      <Route path="/personas" element={<PersonasPage />} />
      <Route path="/planes/nuevo" element={<NewPlanPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
