import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { localOnly, panelHosts } from "../src/guard.ts";

const app = new Hono().use("*", localOnly(panelHosts([5151, 5174])));
app.get("/api/members", (c) => c.json([]));
app.post("/api/members/ana/revoke", (c) => c.json({ ok: true }));

const req = (path: string, init: RequestInit & { headers?: Record<string, string> } = {}) =>
  Promise.resolve(app.request(`http://127.0.0.1:5151${path}`, init)).then((r) => r.status);

describe("localOnly", () => {
  it("answers the panel's own page, directly and through Vite", async () => {
    expect(await req("/api/members", { headers: { host: "127.0.0.1:5151" } })).toBe(200);
    const json = { "content-type": "application/json" };
    expect(await req("/api/members/ana/revoke", { method: "POST", headers: { host: "127.0.0.1:5151", origin: "http://127.0.0.1:5151", ...json } })).toBe(200);
    expect(await req("/api/members/ana/revoke", { method: "POST", headers: { host: "127.0.0.1:5174", origin: "http://127.0.0.1:5174", ...json } })).toBe(200);
    expect(await req("/api/members/ana/revoke", { method: "POST", headers: { host: "localhost:5151", ...json } })).toBe(200);
  });

  it("refuses a rebound hostname even for reads", async () => {
    expect(await req("/api/members", { headers: { host: "evil.test:5151" } })).toBe(403);
  });

  it("refuses changes from other sites and non-JSON posts", async () => {
    const host = { host: "127.0.0.1:5151" };
    expect(await req("/api/members/ana/revoke", { method: "POST", headers: { ...host, origin: "https://evil.test", "content-type": "application/json" } })).toBe(403);
    // A cross-site form or fetch without preflight can only send text/plain.
    expect(await req("/api/members/ana/revoke", { method: "POST", headers: { ...host, "content-type": "text/plain" }, body: "{}" })).toBe(415);
    expect(await req("/api/members/ana/revoke", { method: "POST", headers: host })).toBe(415);
  });
});
