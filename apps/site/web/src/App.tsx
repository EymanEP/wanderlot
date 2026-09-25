import type { ReactNode } from "react";
import { Navigate, Route, Routes, useLocation, useParams } from "react-router";
import { Skeleton } from "@wanderlot/ui";
import { plan } from "@wanderlot/mocks";
import { SiteShell } from "./components/SiteShell.tsx";
import { useAuth } from "./data/auth.tsx";
import { ComentariosPage } from "./pages/ComentariosPage.tsx";
import { InvitePage } from "./pages/InvitePage.tsx";
import { SignInPage } from "./pages/SignInPage.tsx";
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

// Everything under /p/ needs a session; without one, sign in and come back.
function RequireSession({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  const location = useLocation();
  if (state.status === "loading") {
    return (
      <div aria-busy="true" className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 px-4 py-10 sm:px-8 xl:px-16">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
    );
  }
  if (state.status === "out") return <Navigate to="/entrar" replace state={{ from: location.pathname }} />;
  return children;
}

export function App() {
  return (
    <Routes>
      <Route index element={<Navigate to={`/p/${plan.id}`} replace />} />
      <Route path="/entrar" element={<SignInPage />} />
      <Route path="/i/:token" element={<InvitePage />} />
      <Route path="/p/:planId" element={<RequireSession><SiteShell /></RequireSession>}>
        <Route index element={<PlanIndex />} />
        <Route path="destinos/:destinationId" element={<CurrentPlanOnly><DestinoPage /></CurrentPlanOnly>} />
        <Route path="votacion" element={<CurrentPlanOnly><VotacionPage /></CurrentPlanOnly>} />
        <Route path="comentarios" element={<CurrentPlanOnly><ComentariosPage /></CurrentPlanOnly>} />
      </Route>
      <Route path="*" element={<Navigate to={`/p/${plan.id}`} replace />} />
    </Routes>
  );
}
