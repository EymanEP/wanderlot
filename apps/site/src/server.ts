import { serve } from "@hono/node-server";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createApp } from "./app.ts";
import { SiteDb } from "./db.ts";

const adminToken = process.env.WANDERLOT_ADMIN_TOKEN;
if (!adminToken || adminToken.length < 32) {
  console.error("Set WANDERLOT_ADMIN_TOKEN (at least 32 characters).");
  process.exit(1);
}
const dbPath = process.env.WANDERLOT_DB ?? "data/site.sqlite";
mkdirSync(dirname(dbPath), { recursive: true });

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: createApp({ db: new SiteDb(dbPath), adminToken }).fetch, port });
console.log(`Wanderlot site on http://localhost:${port}`);
