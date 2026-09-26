// A self-contained build of the panel for sharing as a single page (npm run
// build:preview). Routing stays in memory, since the page can't own its URL.
import { useMemo } from "react";
import { MemoryRouter } from "react-router";
import { ToastProvider } from "@wanderlot/ui";
import { App } from "./App.tsx";
import { mockBackend } from "./data/mockBackend.ts";
import { PanelProvider } from "./data/store.tsx";

export function Preview() {
  const backend = useMemo(() => mockBackend(), []);
  return (
    <>
      <div className="bg-ink px-4 py-2 text-center text-[13px] font-semibold text-white">
        Vista previa con datos de ejemplo: nada se conecta a Claude ni a ninguna API
      </div>
      <MemoryRouter initialEntries={["/generar"]}>
        <ToastProvider>
          <PanelProvider backend={backend}>
            <App />
          </PanelProvider>
        </ToastProvider>
      </MemoryRouter>
    </>
  );
}
