import { spawnSync } from "node:child_process";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createPanel, type PanelStatus } from "./app.ts";
import { panelHosts } from "./guard.ts";
import { anthropicProvider } from "./providers/anthropic.ts";
import { claudeProvider } from "./providers/claude.ts";
import { pexels, unsplash, wikimedia, type PhotoSource } from "./providers/photos.ts";
import { duffelProvider } from "./providers/duffel.ts";
import { siteClient } from "./publish.ts";
import { PanelStore } from "./store.ts";

// Settings from `npm run setup`, unless already set in the environment.
try {
  process.loadEnvFile(fileURLToPath(new URL("../../../.env", import.meta.url)));
} catch {}

const siteUrl = process.env.WANDERLOT_SITE_URL ?? "http://localhost:8787";
const adminToken = process.env.WANDERLOT_ADMIN_TOKEN ?? "";
const port = Number(process.env.PORT ?? 5151);

// What this computer can do (SPEC §8).
const claudeBin = process.env.CLAUDE_BIN ?? "claude";
const hasClaude = spawnSync(claudeBin, ["--version"], { stdio: "ignore" }).status === 0;
const photos: PhotoSource[] = [
  wikimedia(),
  ...(process.env.UNSPLASH_ACCESS_KEY ? [unsplash(process.env.UNSPLASH_ACCESS_KEY)] : []),
  ...(process.env.PEXELS_API_KEY ? [pexels(process.env.PEXELS_API_KEY)] : []),
];

const status: PanelStatus = {
  // The command first: it runs on the organiser's Claude plan, with no API bill.
  research: hasClaude ? "claude-cli" : process.env.ANTHROPIC_API_KEY ? "anthropic-api" : "none",
  // The Duffel provider is still a stub (providers/duffel.ts): until it's
  // wired up, a key doesn't make flight search work, so don't offer it.
  flights: "none",
  photos: photos.map((s) => s.name),
};

const app = createPanel({
  status,
  store: new PanelStore(process.env.WANDERLOT_PANEL_DATA ?? "data/panel.json"),
  flights: duffelProvider(process.env.DUFFEL_API_KEY),
  research: status.research === "anthropic-api" ? anthropicProvider() : claudeProvider(),
  photos,
  // This server, and Vite's dev server in front of it.
  hosts: panelHosts([port, 5174]),
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
