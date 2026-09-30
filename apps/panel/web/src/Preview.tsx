// A self-contained build of the panel for sharing as a single page (npm run
// build:preview). Routing stays in memory, since the page can't own its URL.
import { useEffect, useMemo, useState } from "react";
import { MemoryRouter } from "react-router";
import { ToastProvider } from "@wanderlot/ui";
import { App } from "./App.tsx";
import { mockBackend } from "./data/mockBackend.ts";
import { PanelProvider } from "./data/store.tsx";

// "#decidido": Noviembre's vote is over and Nápoles won, to show El viaje.
const decided = typeof location !== "undefined" && location.hash === "#decidido";

export function Preview() {
  const backend = useMemo(() => mockBackend(), []);
  const [ready, setReady] = useState(!decided);
  useEffect(() => {
    if (!decided) return;
    try {
      // Open on Noviembre, now that it's no longer in progress.
      localStorage.setItem("wanderlot:panel-plan", "noviembre-2026");
    } catch {}
    void backend.plan("noviembre-2026").then(async (e) => {
      if (e) await backend.savePlan({ ...e.plan, status: "closed", winnerDestinationId: "nap" });
      setReady(true);
    });
  }, [backend]);
  if (!ready) return null;
  return (
    <>
      <div className="bg-ink px-4 py-2 text-center text-[13px] font-semibold text-white">
        Vista previa con datos de ejemplo: nada se conecta a Claude ni a ninguna API
      </div>
      <MemoryRouter initialEntries={[decided ? "/viaje" : "/generar"]}>
        <ToastProvider>
          <PanelProvider backend={backend}>
            <App />
          </PanelProvider>
        </ToastProvider>
      </MemoryRouter>
    </>
  );
}
