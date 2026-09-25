import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { ToastProvider } from "@wanderlot/ui";
import { App } from "./App.tsx";
import { AuthProvider, httpAuthClient, mockAuthClient } from "./data/auth.tsx";
import { SiteProvider } from "./data/store.tsx";
import { Preview } from "./Preview.tsx";
import "./index.css";

// ?estado=cerrada previews the site after the vote closes.
// VITE_AUTH=http signs in against the real site API; otherwise auth is mocked
// like the rest of the data.
const auth = import.meta.env.VITE_AUTH === "http" ? httpAuthClient : mockAuthClient();
const closed = new URLSearchParams(window.location.search).get("estado") === "cerrada";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {import.meta.env.VITE_PREVIEW === "1" ? (
      <Preview />
    ) : (
      <BrowserRouter>
        <ToastProvider>
          <AuthProvider client={auth}>
            <SiteProvider closed={closed}>
              <App />
            </SiteProvider>
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    )}
  </StrictMode>,
);
