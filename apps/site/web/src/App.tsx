import type { ReactNode } from "react";
import { Navigate, Route, Routes, useLocation, useParams } from "react-router";
import { EmptyState, Main, Skeleton } from "@wanderlot/ui";
import { PageErrorBoundary } from "./components/PageErrorBoundary.tsx";
import { SiteShell } from "./components/SiteShell.tsx";
import { useAuth } from "./data/auth.tsx";
import { currentPlan, usePlans } from "./data/store.tsx";
import { ComentariosPage } from "./pages/ComentariosPage.tsx";
import { InvitePage } from "./pages/InvitePage.tsx";
import { SignInPage } from "./pages/SignInPage.tsx";
import { DestinoPage } from "./pages/DestinoPage.tsx";
import { PlanPage } from "./pages/PlanPage.tsx";
import { VotacionPage } from "./pages/VotacionPage.tsx";

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

// "/" opens the plan being voted on, or the newest.
function Home() {
  const plans = usePlans();
  const { group } = useAuth();
  if (!plans) return null;
  const plan = currentPlan(plans);
  if (!plan) {
    return (
      <Main>
        <EmptyState title="Todavía no estás en ningún viaje">Cuando {group.organiserName} te añada a uno, aparecerá aquí.</EmptyState>
      </Main>
    );
  }
  return <Navigate to={`/p/${plan.id}`} replace />;
}

export function App() {
  return (
    <PageErrorBoundary>
      <Routes>
        <Route index element={<RequireSession><Home /></RequireSession>} />
        <Route path="/entrar" element={<SignInPage />} />
        <Route path="/i/:token" element={<InvitePage />} />
        <Route path="/p/:planId" element={<RequireSession><SiteShell /></RequireSession>}>
          <Route index element={<PlanPage />} />
          <Route path="destinos/:destinationId" element={<DestinoPage />} />
          <Route path="votacion" element={<VotacionPage />} />
          <Route path="comentarios" element={<ComentariosPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </PageErrorBoundary>
  );
}
