import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { dirname, join, relative, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";
import { createPanel, type PanelStatus } from "./app.ts";
import { panelHosts } from "./guard.ts";
import Anthropic from "@anthropic-ai/sdk";
import { anthropicProvider } from "./providers/anthropic.ts";
import { claudeProvider } from "./providers/claude.ts";
import { AI_IDS, AiChoice, apiEntries, type AiId } from "./providers/ai.ts";
import { pexels, unsplash, wikimedia, type PhotoSource } from "./providers/photos.ts";
import { duffelProvider } from "./providers/duffel.ts";
import { siteClient, sitePanelBackend } from "./publish.ts";
import { BrowserChoice, findBrowsers } from "./browsers.ts";
import { PanelStore } from "./store.ts";
import { fileBackend, moveFileToSite } from "./file-store.ts";

// Settings from `npm run setup`, unless already set in the environment.
const envFile = fileURLToPath(new URL("../../../.env", import.meta.url));
try {
  process.loadEnvFile(envFile);
} catch {}

// Keeps one setting in .env, leaving the rest as it is.
function saveEnv(key: string, value: string) {
  const lines = existsSync(envFile) ? readFileSync(envFile, "utf8").split("\n") : [];
  const at = lines.findIndex((l) => l.startsWith(`${key}=`));
  if (at >= 0) lines[at] = `${key}=${value}`;
  else lines.splice(lines.at(-1) === "" ? -1 : lines.length, 0, `${key}=${value}`);
  writeFileSync(envFile, lines.join("\n"));
  try {
    chmodSync(envFile, 0o600);
  } catch {}
}

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

// Where trips are kept (ROADMAP 3.2): on the site, so the panel it serves at
// /admin and this one share them. A site too old for that (or not answering
// yet, with trips still only in the file) keeps them in data/panel.json.
const site = siteClient(siteUrl, adminToken);
const dataFile = process.env.WANDERLOT_PANEL_DATA ?? "data/panel.json";
let onSite = false;
try {
  onSite = (await site.version()) >= 10;
} catch (e) {
  console.warn(`The site at ${siteUrl} didn't answer (${(e as Error).message}).`);
}
if (onSite) {
  const moved = await moveFileToSite(dataFile, sitePanelBackend(site));
  if (moved) console.log(`Moved ${moved} trip${moved === 1 ? "" : "s"} from ${dataFile} to the site; the file is kept as ${dataFile}.moved-to-site.`);
} else {
  console.warn(`Keeping trips in ${dataFile}. Run npm run deploy:site to keep them on the site and manage them from your phone.`);
}

// The AIs set up here (ROADMAP 3.3). The command first: it runs on the
// organiser's Claude plan, with no API bill. Ajustes picks another.
const ai = new AiChoice(
  [
    {
      option: {
        id: "claude-cli",
        name: "Claude (comando claude)",
        model: null,
        ready: hasClaude,
        setup: "Instala Claude Code (el comando claude) y reinicia el panel.",
        search: true,
        images: true,
        background: false,
      },
      make: () => claudeProvider(),
    },
    ...apiEntries(process.env, (key) => anthropicProvider(new Anthropic({ apiKey: key }).beta.messages), "local"),
  ],
  (AI_IDS as readonly string[]).includes(process.env.WANDERLOT_AI ?? "") ? (process.env.WANDERLOT_AI as AiId) : null,
  (id) => saveEnv("WANDERLOT_AI", id),
);

// "Comprobar vuelos" (ROADMAP 3.4): the claude command drives a visible
// browser with a profile of its own: Chrome, Brave, Edge or Chromium,
// whichever is installed, or the one chosen in Ajustes.
const browsers = new BrowserChoice(findBrowsers(), process.env.WANDERLOT_BROWSER, (v) => saveEnv("WANDERLOT_BROWSER", v));
let mcpCli: string | null = null;
try {
  mcpCli = join(dirname(createRequire(import.meta.url).resolve("@playwright/mcp/package.json")), "cli.js");
} catch {}

const status: PanelStatus = {
  research: "none",
  // The Duffel provider is still a stub (providers/duffel.ts): until it's
  // wired up, a key doesn't make flight search work, so don't offer it.
  flights: "none",
  ...(!hasClaude ? { browseMissing: "claude" as const } : !mcpCli ? { browseMissing: "install" as const } : !browsers.chosen ? { browseMissing: "browser" as const } : {}),
  photos: photos.map((s) => s.name),
  store: onSite ? "site" : "file",
};

const browse =
  hasClaude && mcpCli && browsers.chosen
    ? claudeProvider(undefined, {
        mcpCli,
        browser: () => browsers.chosen,
        profileDir: resolvePath(process.env.WANDERLOT_BROWSER_PROFILE ?? "data/browser"),
        noSandbox: process.platform === "linux" && process.getuid?.() === 0,
      }).browse
    : undefined;

const app = createPanel({
  status,
  store: new PanelStore(onSite ? sitePanelBackend(site) : fileBackend(dataFile)),
  flights: duffelProvider(process.env.DUFFEL_API_KEY),
  ai,
  ...(browse ? { browse } : {}),
  browsers,
  photos,
  // This server, and Vite's dev server in front of it.
  hosts: panelHosts([port, 5174]),
  site,
  siteUrl,
});

// Built UI (npm run build). In development Vite serves it instead.
const webRoot = relative(process.cwd(), join(dirname(fileURLToPath(import.meta.url)), "../dist/web"));
app.use("/*", serveStatic({ root: webRoot }));
app.get("*", serveStatic({ root: webRoot, path: "index.html" }));

// Local only: API keys and the claude binary never face the network.
serve({ fetch: app.fetch, port, hostname: "127.0.0.1" });
console.log(`Wanderlot panel on http://127.0.0.1:${port}`);
