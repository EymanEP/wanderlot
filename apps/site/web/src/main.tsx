import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { ToastProvider } from "@wanderlot/ui";
import { App } from "./App.tsx";
import { SiteProvider } from "./data/store.tsx";
import { Preview } from "./Preview.tsx";
import "./index.css";

// ?estado=cerrada previews the site after the vote closes.
const closed = new URLSearchParams(window.location.search).get("estado") === "cerrada";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {import.meta.env.VITE_PREVIEW === "1" ? (
      <Preview />
    ) : (
      <BrowserRouter>
        <ToastProvider>
          <SiteProvider closed={closed}>
            <App />
          </SiteProvider>
        </ToastProvider>
      </BrowserRouter>
    )}
  </StrictMode>,
);
