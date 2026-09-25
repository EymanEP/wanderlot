import type { ReactNode } from "react";
import { Navigate, Route, Routes, useParams } from "react-router";
import { plan } from "@wanderlot/mocks";
import { SiteShell } from "./components/SiteShell.tsx";
import { ComentariosPage } from "./pages/ComentariosPage.tsx";
import { DestinoPage } from "./pages/DestinoPage.tsx";
import { OtherPlanPage } from "./pages/OtherPlanPage.tsx";
import { PlanPage } from "./pages/PlanPage.tsx";
import { VotacionPage } from "./pages/VotacionPage.tsx";

// The mocks hold one full plan; the others only have a headline.
function PlanIndex() {
  const { planId } = useParams();
  return planId === plan.id ? <PlanPage /> : <OtherPlanPage />;
}

// Sub-pages exist only for the plan the mocks describe in full.
function CurrentPlanOnly({ children }: { children: ReactNode }) {
  const { planId } = useParams();
  return planId === plan.id ? children : <Navigate to={`/p/${planId}`} replace />;
}

export function App() {
  return (
    <Routes>
      <Route index element={<Navigate to={`/p/${plan.id}`} replace />} />
      <Route path="/p/:planId" element={<SiteShell />}>
        <Route index element={<PlanIndex />} />
        <Route path="destinos/:destinationId" element={<CurrentPlanOnly><DestinoPage /></CurrentPlanOnly>} />
        <Route path="votacion" element={<CurrentPlanOnly><VotacionPage /></CurrentPlanOnly>} />
        <Route path="comentarios" element={<CurrentPlanOnly><ComentariosPage /></CurrentPlanOnly>} />
      </Route>
      <Route path="*" element={<Navigate to={`/p/${plan.id}`} replace />} />
    </Routes>
  );
}
