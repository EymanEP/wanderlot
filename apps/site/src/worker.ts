// The site on Cloudflare Workers (SPEC §11). Static assets (the built UI) are
// served by Cloudflare directly; /api/* and the panel at /admin reach this code.
import { createApp } from "./app.ts";
import { D1Store, type D1Like } from "./d1.ts";
import { SECURITY_HEADERS } from "./headers.ts";

export interface Env {
  DB: D1Like;
  ADMIN_TOKEN: string;
  // The site's public address (set by `npm run deploy:site`). Passkeys belong
  // to it, so once people have signed up it must not change.
  ORIGIN?: string;
  // Keys the PIN hashes (set by `npm run deploy:site`); falls back to ADMIN_TOKEN.
  PIN_SECRET?: string;
  // Cloudflare's rate limiter (wrangler.jsonc), for sign-in attempts.
  AUTH_LIMIT?: { limit(o: { key: string }): Promise<{ success: boolean }> };
  // The built files (wrangler.jsonc), for the panel's under /admin.
  ASSETS?: { fetch(request: Request | string): Promise<Response> };
}

// The panel's pages and files (ROADMAP 3.1): its files as they are, and its
// index.html for every other address under /admin (its API aside).
async function adminAsset(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);
  if (!env.ASSETS || request.method !== "GET" || url.pathname.startsWith("/admin/api/")) return null;
  if (url.pathname === "/admin") return Response.redirect(new URL("/admin/", url).toString(), 302);
  const isFile = /\.[a-z0-9]+$/i.test(url.pathname);
  const res = await env.ASSETS.fetch(isFile ? request : new URL("/admin/index.html", url).toString());
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) out.headers.set(k, v);
  return out;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (!env.ADMIN_TOKEN || env.ADMIN_TOKEN.length < 32) {
      return new Response("Missing the ADMIN_TOKEN secret (32+ characters): npx wrangler secret put ADMIN_TOKEN", { status: 500 });
    }
    // Required rather than taken from the request, so a preview or second
    // hostname can't start collecting passkeys that work nowhere else.
    if (!env.ORIGIN) {
      return new Response("Missing ORIGIN, the site's public address: run npm run deploy:site again", { status: 500 });
    }
    const asset = new URL(request.url).pathname.startsWith("/admin") ? await adminAsset(request, env) : null;
    if (asset) return asset;
    const limiter = env.AUTH_LIMIT;
    const app = createApp({
      store: new D1Store(env.DB),
      adminToken: env.ADMIN_TOKEN,
      rp: { name: "Wanderlot", origin: env.ORIGIN },
      ...(env.PIN_SECRET ? { pinSecret: env.PIN_SECRET } : {}),
      ...(limiter ? { limit: async (key: string) => (await limiter.limit({ key })).success } : {}),
    });
    return app.fetch(request);
  },
};
