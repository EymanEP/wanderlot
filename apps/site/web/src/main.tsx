import "./zod-config.ts";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { ToastProvider } from "@wanderlot/ui";
import { App } from "./App.tsx";
import { AuthProvider, httpAuthClient, mockAuthClient } from "./data/auth.tsx";
import { httpSource, mockSource } from "./data/source.ts";
import { SourceProvider } from "./data/store.tsx";
import { Preview } from "./Preview.tsx";
import "./index.css";

// The real site talks to its API. VITE_DATA=mock runs on the mock data instead
// (UI work without a server); there, ?estado=cerrada shows the closed vote.
const mock = import.meta.env.VITE_DATA === "mock";
const closed = new URLSearchParams(window.location.search).get("estado") === "cerrada";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {import.meta.env.VITE_PREVIEW === "1" ? (
      <Preview />
    ) : (
      <BrowserRouter>
        <ToastProvider>
          <AuthProvider client={mock ? mockAuthClient() : httpAuthClient}>
            <SourceProvider source={mock ? mockSource({ closed }) : httpSource}>
              <App />
            </SourceProvider>
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    )}
  </StrictMode>,
);
