import "./zod-config.ts";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { ToastProvider } from "@wanderlot/ui";
import { App } from "./App.tsx";
import { httpBackend } from "./data/backend.ts";
import { mockBackend } from "./data/mockBackend.ts";
import { PanelProvider } from "./data/store.tsx";
import { Preview } from "./Preview.tsx";
import { HostedGate } from "./components/HostedGate.tsx";
import "./index.css";

// The real panel talks to its local server; VITE_DATA=mock uses the mocks.
const backend = import.meta.env.VITE_DATA === "mock" ? mockBackend() : httpBackend;
// The panel the site serves at /admin asks for its password first.
const hosted = import.meta.env.VITE_HOSTED === "1";
if (hosted) document.title = "Wanderlot · Panel";
const panel = (
  <PanelProvider backend={backend}>
    <App />
  </PanelProvider>
);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {import.meta.env.VITE_PREVIEW === "1" ? (
      <Preview />
    ) : (
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "") || "/"}>
        <ToastProvider>{hosted ? <HostedGate>{panel}</HostedGate> : panel}</ToastProvider>
      </BrowserRouter>
    )}
  </StrictMode>,
);
