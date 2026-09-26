import type { ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router";
import { Skeleton } from "@wanderlot/ui";
import { PageErrorBoundary } from "./components/PageErrorBoundary.tsx";
import { SiteShell } from "./components/SiteShell.tsx";
import { useAuth } from "./data/auth.tsx";
import { ComentariosPage } from "./pages/ComentariosPage.tsx";
import { InvitePage } from "./pages/InvitePage.tsx";
import { NewPinPage } from "./pages/NewPinPage.tsx";
import { SignInPage } from "./pages/SignInPage.tsx";
import { DestinoPage } from "./pages/DestinoPage.tsx";
import { PlanPage } from "./pages/PlanPage.tsx";
import { TripsPage } from "./pages/TripsPage.tsx";
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

export function App() {
  return (
    <PageErrorBoundary>
      <Routes>
        <Route index element={<RequireSession><TripsPage /></RequireSession>} />
        <Route path="/entrar" element={<SignInPage />} />
        <Route path="/i/:token" element={<InvitePage />} />
        <Route path="/nuevo-pin" element={<RequireSession><NewPinPage /></RequireSession>} />
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
