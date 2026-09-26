// The site on Cloudflare Workers (SPEC §11). Static assets (the built UI) are
// served by Cloudflare directly; only /api/* reaches this code.
import { createApp } from "./app.ts";
import { D1Store, type D1Like } from "./d1.ts";

export interface Env {
  DB: D1Like;
  ADMIN_TOKEN: string;
  // The site's public address. Passkeys belong to it, so once people have
  // signed up it must not change. Defaults to the address of each request.
  ORIGIN?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (!env.ADMIN_TOKEN || env.ADMIN_TOKEN.length < 32) {
      return new Response("Falta el secreto ADMIN_TOKEN (32 caracteres o más): npx wrangler secret put ADMIN_TOKEN", { status: 500 });
    }
    const app = createApp({
      store: new D1Store(env.DB),
      adminToken: env.ADMIN_TOKEN,
      rp: { name: "Wanderlot", origin: env.ORIGIN || new URL(request.url).origin },
    });
    return app.fetch(request);
  },
};
