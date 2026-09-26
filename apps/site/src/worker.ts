// The site on Cloudflare Workers (SPEC §11). Static assets (the built UI) are
// served by Cloudflare directly; only /api/* reaches this code.
import { createApp } from "./app.ts";
import { D1Store, type D1Like } from "./d1.ts";

export interface Env {
  DB: D1Like;
  ADMIN_TOKEN: string;
  // The site's public address (set by `npm run deploy:site`). Passkeys belong
  // to it, so once people have signed up it must not change.
  ORIGIN?: string;
  // Cloudflare's rate limiter (wrangler.jsonc), for sign-in attempts.
  AUTH_LIMIT?: { limit(o: { key: string }): Promise<{ success: boolean }> };
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
    const limiter = env.AUTH_LIMIT;
    const app = createApp({
      store: new D1Store(env.DB),
      adminToken: env.ADMIN_TOKEN,
      rp: { name: "Wanderlot", origin: env.ORIGIN },
      ...(limiter ? { limit: async (key: string) => (await limiter.limit({ key })).success } : {}),
    });
    return app.fetch(request);
  },
};
