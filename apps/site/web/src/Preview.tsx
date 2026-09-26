// A self-contained build of the site for sharing as a single page (npm run
// build:preview). Routing stays in memory, since the page can't own its URL,
// and a bar at the top flips between the open and the closed vote.
import { useMemo, useState } from "react";
import { MemoryRouter, useNavigate } from "react-router";
import { plan } from "@wanderlot/mocks";
import { mockSource } from "./data/source.ts";
import { Chip, ToastProvider } from "@wanderlot/ui";
import { App } from "./App.tsx";
import { AuthProvider, mockAuthClient, useAuth } from "./data/auth.tsx";
import { SourceProvider } from "./data/store.tsx";

export function Preview() {
  const [closed, setClosed] = useState(false);
  const auth = useMemo(() => mockAuthClient(), []);
  const source = useMemo(() => mockSource({ closed }), [closed]);
  return (
    // Remount on toggle so the store starts from the matching mock state.
    <MemoryRouter key={String(closed)} initialEntries={[`/p/${plan.id}`]}>
      <ToastProvider>
        <AuthProvider client={auth}>
          <PreviewBar closed={closed} setClosed={setClosed} />
          <SourceProvider source={source}>
            <App />
          </SourceProvider>
        </AuthProvider>
      </ToastProvider>
    </MemoryRouter>
  );
}

function PreviewBar({ closed, setClosed }: { closed: boolean; setClosed: (v: boolean) => void }) {
  const navigate = useNavigate();
  const auth = useAuth();
  const quiet = "text-white/80 hover:bg-white/10";
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 bg-ink px-4 py-2 text-[13px] text-white">
      <span className="font-semibold">Vista previa con datos de ejemplo</span>
      <div role="group" aria-label="Estado de la votación" className="flex gap-1 rounded-full bg-white/10 p-1">
        <Chip size="sm" variant="subtle" on={!closed} onClick={() => setClosed(false)} className={closed ? quiet : ""}>
          Votación abierta
        </Chip>
        <Chip size="sm" variant="subtle" on={closed} onClick={() => setClosed(true)} className={!closed ? quiet : ""}>
          Votación cerrada
        </Chip>
      </div>
      <div role="group" aria-label="Otras pantallas" className="flex gap-1 rounded-full bg-white/10 p-1">
        <Chip size="sm" variant="subtle" on={false} className={quiet} onClick={() => auth.signOut().then(() => navigate("/entrar"))}>
          Entrar
        </Chip>
        <Chip size="sm" variant="subtle" on={false} className={quiet} onClick={() => navigate("/i/demo")}>
          Invitación
        </Chip>
        <Chip size="sm" variant="subtle" on={false} className={quiet} onClick={() => navigate("/i/usada")}>
          Invitación usada
        </Chip>
      </div>
    </div>
  );
}
