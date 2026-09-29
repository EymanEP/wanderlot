// The panel's data on the site (ROADMAP 3.2) and the panel it serves at
// /admin (ROADMAP 3.1): the laptop and the phone share one store.
import { mkdtempSync, existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.ts";
import { SqliteStore } from "../src/sqlite.ts";
import { createPanel } from "../../panel/src/app.ts";
import { siteClient, sitePanelBackend } from "../../panel/src/publish.ts";
import { PanelStore } from "../../panel/src/store.ts";
import { moveFileToSite } from "../../panel/src/file-store.ts";
import type { FlightProvider, ResearchProvider } from "../../panel/src/providers/types.ts";

const ADMIN = "p".repeat(40);
const ORIGIN = "https://wanderlot.test";
const PASSWORD = "una contraseña larga";

let clock: Date;
let store: SqliteStore;
let site: ReturnType<typeof createApp>;
let laptop: ReturnType<typeof createPanel>;

const plan = (id: string, name: string) => ({
  name,
  origin: "MAD",
  dateFrom: "2026-11-07",
  dateTo: "2026-11-14",
  nights: 7,
  flexDays: 0,
  partySize: 6,
  maxPriceCents: null,
  status: "draft",
  id,
});

beforeEach(() => {
  clock = new Date("2026-10-10T12:00:00Z");
  store = new SqliteStore();
  site = createApp({ store, adminToken: ADMIN, rp: { name: "Wanderlot", origin: ORIGIN }, now: () => clock, adminIndexHtml: "<p>panel</p>" });
  const client = siteClient(ORIGIN, ADMIN, async (input, init) => site.request(String(input), init));
  laptop = createPanel({
    store: new PanelStore(sitePanelBackend(client)),
    flights: {} as FlightProvider,
    research: {} as ResearchProvider,
    site: client,
    siteUrl: ORIGIN,
    now: () => clock,
  });
});

const onLaptop = async (path: string, method = "GET", body?: unknown) => {
  const res = await laptop.request(path, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, data: (await res.json().catch(() => null)) as any };
};

const onPhone = async (path: string, opts: { method?: string; body?: unknown; cookie?: string; headers?: Record<string, string> } = {}) =>
  site.request(`/admin${path}`, {
    method: opts.method ?? "GET",
    headers: { "content-type": "application/json", origin: ORIGIN, ...(opts.cookie ? { cookie: opts.cookie } : {}), ...(opts.headers ?? {}) },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });

async function signIn(): Promise<string> {
  expect((await onLaptop("/api/organiser", "PUT", { password: PASSWORD })).status).toBe(200);
  const res = await onPhone("/api/session", { method: "POST", body: { password: PASSWORD } });
  expect(res.status).toBe(200);
  return res.headers.get("set-cookie")!.split(";")[0]!;
}

describe("the panel at /admin", () => {
  it("is off until the organiser sets a password from the laptop", async () => {
    expect(await (await onLaptop("/api/organiser")).data).toEqual({ enabled: false, setAt: null, url: `${ORIGIN}/admin/` });
    expect((await onPhone("/api/session")).status).toBe(404);
    expect((await onPhone("/api/session", { method: "POST", body: { password: PASSWORD } })).status).toBe(404);
    expect((await onPhone("/api/plans")).status).toBe(401);
    // The page itself loads, and asks to sign in.
    expect(await (await site.request("/admin/viajes")).text()).toBe("<p>panel</p>");
    expect((await site.request("/admin")).headers.get("location")).toBe("/admin/");

    expect((await onLaptop("/api/organiser", "PUT", { password: "corta" })).status).toBe(400);
    const on = (await onLaptop("/api/organiser", "PUT", { password: PASSWORD })).data;
    expect(on).toMatchObject({ enabled: true, setAt: clock.toISOString() });
  });

  it("signs in with the password, with growing lockouts, and a cookie only /admin gets", async () => {
    await onLaptop("/api/organiser", "PUT", { password: PASSWORD });
    for (let i = 0; i < 4; i++) expect((await onPhone("/api/session", { method: "POST", body: { password: "no es esta" } })).status).toBe(401);
    const locked = await onPhone("/api/session", { method: "POST", body: { password: "no es esta" } });
    expect(locked.status).toBe(429);
    expect(((await locked.json()) as any).error).toMatch(/15 min/);
    expect((await onPhone("/api/session", { method: "POST", body: { password: PASSWORD } })).status).toBe(429);
    clock = new Date(clock.getTime() + 16 * 60_000);

    const res = await onPhone("/api/session", { method: "POST", body: { password: PASSWORD } });
    expect(res.status).toBe(200);
    const setCookie = res.headers.get("set-cookie")!;
    expect(setCookie).toMatch(/^wl_admin=/);
    expect(setCookie).toMatch(/HttpOnly/);
    expect(setCookie).toMatch(/Path=\/admin/);
    expect(setCookie).toMatch(/SameSite=Strict/);
    const cookie = setCookie.split(";")[0]!;
    expect((await onPhone("/api/session", { cookie })).status).toBe(200);
    // A friend's session isn't the organiser's.
    expect((await onPhone("/api/plans", { cookie: "wl_session=x" })).status).toBe(401);

    // Changing the password signs every device out.
    await onLaptop("/api/organiser", "PUT", { password: "otra contraseña larga" });
    expect((await onPhone("/api/plans", { cookie })).status).toBe(401);
  });

  it("refuses writes from other sites and forms", async () => {
    const cookie = await signIn();
    expect((await onPhone("/api/plans", { method: "POST", cookie, body: {}, headers: { origin: "https://evil.test" } })).status).toBe(403);
    const form = await site.request("/admin/api/plans", { method: "POST", headers: { cookie, origin: ORIGIN, "content-type": "application/x-www-form-urlencoded" }, body: "a=1" });
    expect(form.status).toBe(415);
  });

  it("shares trips with the laptop both ways, and says when AI is needed", async () => {
    const cookie = await signIn();
    await onLaptop("/api/plans/noviembre", "PUT", plan("noviembre", "Noviembre 2026"));
    // The phone sees what the laptop made, and renames it.
    const status = (await (await onPhone("/api/status", { cookie })).json()) as any;
    expect(status).toMatchObject({ hosted: true, research: "none", store: "site" });
    expect(((await (await onPhone("/api/plans", { cookie })).json()) as any[]).map((p) => p.name)).toEqual(["Noviembre 2026"]);
    expect((await onPhone("/api/plans/noviembre", { method: "PUT", cookie, body: plan("noviembre", "Puente de noviembre") })).status).toBe(200);
    expect((await onLaptop("/api/plans/noviembre")).data.plan.name).toBe("Puente de noviembre");

    // Research needs Claude, which the site doesn't have.
    const research = await onPhone("/api/plans/noviembre/generate", {
      method: "POST",
      cookie,
      body: { source: "claude", scope: { kind: "europe" }, stops: "direct", estimateStays: false, suggestThings: false },
    });
    expect(research.status).toBe(409);
    expect(((await research.json()) as any).error).toMatch(/panel de tu ordenador/);

    // Deleting from the phone deletes it for the laptop too.
    expect((await onPhone("/api/plans/noviembre", { method: "DELETE", cookie })).status).toBe(200);
    expect((await onLaptop("/api/plans/noviembre")).status).toBe(404);
    expect(await store.panelVersions()).toEqual({});
  });

  it("uses an AI key set on the site to read screenshots, but leaves searching to the laptop", async () => {
    site = createApp({ store, adminToken: ADMIN, rp: { name: "Wanderlot", origin: ORIGIN }, now: () => clock, ai: { OPENAI_API_KEY: "sk-test" } });
    const client = siteClient(ORIGIN, ADMIN, async (input, init) => site.request(String(input), init));
    laptop = createPanel({ store: new PanelStore(sitePanelBackend(client)), flights: {} as FlightProvider, research: {} as ResearchProvider, site: client, siteUrl: ORIGIN, now: () => clock });
    const cookie = await signIn();
    await onLaptop("/api/plans/noviembre", "PUT", plan("noviembre", "Noviembre 2026"));

    expect(await (await onPhone("/api/status", { cookie })).json()).toMatchObject({ hosted: true, research: "openai-api", ai: { name: "OpenAI", search: true } });
    const ai = (await (await onPhone("/api/ai", { cookie })).json()) as any;
    expect(ai).toMatchObject({ active: "openai-api", canChoose: false });
    expect(ai.options.find((o: any) => o.id === "anthropic-api").setup).toMatch(/wrangler secret put ANTHROPIC_API_KEY/);
    // Keys never reach the browser.
    expect(JSON.stringify(ai)).not.toContain("sk-test");
    expect((await onPhone("/api/ai", { method: "PUT", cookie, body: { id: "openai-api" } })).status).toBe(409);

    const research = await onPhone("/api/plans/noviembre/generate", {
      method: "POST",
      cookie,
      body: { source: "claude", scope: { kind: "europe" }, stops: "direct", estimateStays: false, suggestThings: false },
    });
    expect(research.status).toBe(409);
    expect(((await research.json()) as any).error).toMatch(/panel de tu ordenador/);
  });

  it("keeps invite links sealed in the database, and both panels can copy them", async () => {
    const cookie = await signIn();
    await onLaptop("/api/members", "PUT", [{ id: "ana", name: "Ana" }]);
    const url = (await onLaptop("/api/members/ana/invite", "POST")).data.url as string;
    const token = url.split("/i/")[1]!;
    const [row] = await store.panelInvites();
    expect(row!.sealed).not.toContain(token);
    const members = (await (await onPhone("/api/members", { cookie })).json()) as any[];
    expect(members.find((m) => m.id === "ana").inviteUrl).toBe(url);
  });

  it("won't let two devices overwrite each other's changes to a trip", async () => {
    await onLaptop("/api/plans/noviembre", "PUT", plan("noviembre", "Noviembre 2026"));
    const [v] = Object.values(await store.panelVersions());
    const save = (name: string) =>
      site.request("/api/admin/panel/plans/noviembre", {
        method: "PUT",
        headers: { authorization: `Bearer ${ADMIN}`, "content-type": "application/json" },
        body: JSON.stringify({ entry: { plan: plan("noviembre", name), proposals: [], editorial: {} }, version: v }),
      });
    expect((await save("Desde el móvil")).status).toBe(200);
    expect((await save("Desde el portátil, sin recargar")).status).toBe(409);
    expect((await onLaptop("/api/plans/noviembre")).data.plan.name).toBe("Desde el móvil");
  });

  it("moves the laptop's data/panel.json to the site once, keeping a backup", async () => {
    const dir = mkdtempSync(join(tmpdir(), "wanderlot-move-"));
    const file = join(dir, "panel.json");
    writeFileSync(
      file,
      JSON.stringify({
        plans: { semana: { plan: plan("semana", "Semana Santa"), proposals: [], editorial: {} } },
        invites: { ana: { token: "tok", expiresAt: "2026-10-15T00:00:00Z" } },
      }),
    );
    const client = siteClient(ORIGIN, ADMIN, async (input, init) => site.request(String(input), init));
    expect(await moveFileToSite(file, sitePanelBackend(client))).toBe(1);
    expect(existsSync(file)).toBe(false);
    expect(existsSync(`${file}.moved-to-site`)).toBe(true);
    expect((await onLaptop("/api/plans/semana")).data.plan.name).toBe("Semana Santa");
    expect(await client.panelInvites()).toEqual({ ana: { token: "tok", expiresAt: "2026-10-15T00:00:00Z" } });
    // Nothing left to move the second time.
    expect(await moveFileToSite(file, sitePanelBackend(client))).toBe(0);
  });
});
