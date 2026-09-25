import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createPanel } from "./app.ts";
import { claudeProvider } from "./providers/claude.ts";
import { duffelProvider } from "./providers/duffel.ts";
import { siteClient } from "./publish.ts";
import { PanelStore } from "./store.ts";

const siteUrl = process.env.WANDERLOT_SITE_URL ?? "http://localhost:8787";
const adminToken = process.env.WANDERLOT_ADMIN_TOKEN ?? "";
const port = Number(process.env.PORT ?? 5151);

const app = createPanel({
  store: new PanelStore(process.env.WANDERLOT_PANEL_DATA ?? "data/panel.json"),
  flights: duffelProvider(process.env.DUFFEL_API_KEY),
  research: claudeProvider(),
  site: siteClient(siteUrl, adminToken),
  siteUrl,
});

// Built UI (npm run build). In development Vite serves it instead.
const webRoot = relative(process.cwd(), join(dirname(fileURLToPath(import.meta.url)), "../dist/web"));
app.use("/*", serveStatic({ root: webRoot }));
app.get("*", serveStatic({ root: webRoot, path: "index.html" }));

// Local only: API keys and the claude binary never face the network.
serve({ fetch: app.fetch, port, hostname: "127.0.0.1" });
console.log(`Wanderlot panel on http://127.0.0.1:${port}`);
