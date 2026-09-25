import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.ts";
import { SiteDb } from "./db.ts";

const adminToken = process.env.WANDERLOT_ADMIN_TOKEN;
if (!adminToken || adminToken.length < 32) {
  console.error("Set WANDERLOT_ADMIN_TOKEN (at least 32 characters).");
  process.exit(1);
}
const dbPath = process.env.WANDERLOT_DB ?? "data/site.sqlite";
mkdirSync(dirname(dbPath), { recursive: true });

// Built UI (npm run build). In development Vite serves it instead.
const webDir = join(dirname(fileURLToPath(import.meta.url)), "../dist/web");
const indexPath = join(webDir, "index.html");
const indexHtml = existsSync(indexPath) ? readFileSync(indexPath, "utf8") : undefined;

const app = createApp({ db: new SiteDb(dbPath), adminToken, ...(indexHtml ? { indexHtml } : {}) });
app.use("/assets/*", serveStatic({ root: relative(process.cwd(), webDir) }));

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: app.fetch, port });
console.log(`Wanderlot site on http://localhost:${port}`);
