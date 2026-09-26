import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.ts";
import { SECURITY_HEADERS, headersFile, memoryLimiter } from "../src/headers.ts";
import { SqliteStore } from "../src/sqlite.ts";

const ADMIN = "a".repeat(40);
const ORIGIN = "https://viaje.example.org";
const make = (limit?: (key: string) => Promise<boolean>) =>
  createApp({ store: new SqliteStore(), adminToken: ADMIN, rp: { name: "Wanderlot", origin: ORIGIN }, indexHtml: "<p>ui</p>", ...(limit ? { limit } : {}) });

describe("security headers", () => {
  it("are on pages and API answers alike", async () => {
    const app = make();
    for (const path of ["/", "/p/x", "/api/session"]) {
      const res = await app.request(path);
      expect(res.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
      expect(res.headers.get("x-frame-options")).toBe("DENY");
      expect(res.headers.get("referrer-policy")).toBe("same-origin");
    }
  });

  it("match what Cloudflare serves the built UI with", () => {
    expect(readFileSync(new URL("../web/public/_headers", import.meta.url), "utf8")).toBe(headersFile());
    expect(headersFile()).toContain(SECURITY_HEADERS["Content-Security-Policy"]!);
  });
});

describe("cross-site writes", () => {
  it("are refused when the browser says they come from elsewhere", async () => {
    const app = make();
    const post = (origin?: string) =>
      Promise.resolve(app.request("/api/session/options", { method: "POST", headers: { "content-type": "application/json", ...(origin ? { origin } : {}) } })).then((r) => r.status);
    expect(await post("https://evil.example.org")).toBe(403);
    // A sibling subdomain is same-site for cookies, but not the same origin.
    expect(await post("https://otro.example.org")).toBe(403);
    expect(await post(ORIGIN)).toBe(200);
    expect(await post()).toBe(200);
  });

  it("leave the admin API to its token", async () => {
    const res = await make().request("/api/admin/settings", { headers: { authorization: `Bearer ${ADMIN}`, origin: "https://evil.example.org" } });
    expect(res.status).toBe(200);
  });
});

describe("sign-in attempts", () => {
  it("are throttled per client address", async () => {
    let allowed = 2;
    const keys: string[] = [];
    const app = make(async (key) => {
      keys.push(key);
      return allowed-- > 0;
    });
    const post = () => Promise.resolve(app.request("/api/session/options", { method: "POST", headers: { "cf-connecting-ip": "203.0.113.9" } })).then((r) => r.status);
    expect([await post(), await post(), await post()]).toEqual([200, 200, 429]);
    expect(keys).toEqual(["203.0.113.9", "203.0.113.9", "203.0.113.9"]);
  });

  it("reuse a flow only once", async () => {
    const app = make();
    const { flowId } = (await (await app.request("/api/session/options", { method: "POST" })).json()) as { flowId: string };
    const verify = () =>
      Promise.resolve(app.request("/api/session/verify", { method: "POST", body: JSON.stringify({ flowId, response: { id: "x" } }) })).then((r) => r.json() as Promise<{ error: string }>);
    const [a, b] = await Promise.all([verify(), verify()]);
    // One got past the flow (and failed on the unknown passkey); the other didn't.
    expect([a.error, b.error].sort()).toEqual(["El intento caducó; vuelve a empezar", "Esta passkey ya no vale aquí. Pide una invitación nueva."].sort());
  });
});

describe("memoryLimiter", () => {
  it("allows a burst per window, per key", async () => {
    let t = 0;
    const limit = memoryLimiter(2, 60_000, () => t);
    expect([await limit("a"), await limit("a"), await limit("a"), await limit("b")]).toEqual([true, true, false, true]);
    t = 60_000;
    expect(await limit("a")).toBe(true);
  });
});
