import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { ToastProvider } from "@wanderlot/ui";
import { App } from "./App.tsx";
import { PanelProvider } from "./data/store.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <PanelProvider>
          <App />
        </PanelProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
);
