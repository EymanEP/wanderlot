import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.ts";
import { SqliteStore } from "./sqlite.ts";

// The site on a plain Node server (self-hosting, local development).
const adminToken = process.env.WANDERLOT_ADMIN_TOKEN;
if (!adminToken || adminToken.length < 32) {
  console.error("Set WANDERLOT_ADMIN_TOKEN (at least 32 characters).");
  process.exit(1);
}
const port = Number(process.env.PORT ?? 8787);
// Passkeys belong to this origin: set it to the site's final public address.
const origin = process.env.WANDERLOT_ORIGIN ?? `http://localhost:${port}`;
const dbPath = process.env.WANDERLOT_DB ?? "data/site.sqlite";
if (dbPath !== ":memory:") mkdirSync(dirname(dbPath), { recursive: true });

// Built UI (npm run build). In development Vite serves it instead.
const webDir = join(dirname(fileURLToPath(import.meta.url)), "../dist/web");
const indexPath = join(webDir, "index.html");
const indexHtml = existsSync(indexPath) ? readFileSync(indexPath, "utf8") : undefined;

const app = createApp({
  store: new SqliteStore(dbPath),
  adminToken,
  rp: { name: "Wanderlot", origin },
  ...(indexHtml ? { indexHtml } : {}),
});
app.use("/assets/*", serveStatic({ root: relative(process.cwd(), webDir) }));

serve({ fetch: app.fetch, port });
console.log(`Wanderlot site on ${origin}`);
