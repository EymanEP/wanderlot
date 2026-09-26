import { beforeEach, describe, expect, it } from "vitest";
import { PIN_LOCK_MS, createApp, nameKey, pinProblem } from "../src/app.ts";
import { SqliteStore } from "../src/sqlite.ts";
import { destination, snapshot } from "../../../packages/core/test/fixtures.ts";

const ADMIN = "a".repeat(40);
const ORIGIN = "http://localhost:8787";
let clock: Date;
let store: SqliteStore;
let app: ReturnType<typeof createApp>;

const req = (path: string, method = "GET", body?: unknown, headers: Record<string, string> = {}) =>
  Promise.resolve(
    app.request(path, { method, headers: { "content-type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) }),
  );
const admin = (path: string, method = "GET", body?: unknown) => req(`/api/admin${path}`, method, body, { authorization: `Bearer ${ADMIN}` });
const cookieOf = (res: Response) => res.headers.get("set-cookie")?.split(";")[0] ?? "";

async function inviteToken(id: string): Promise<string> {
  return ((await (await admin(`/members/${id}/invite`, "POST")).json()) as { token: string }).token;
}
async function joinWithPin(id: string, pin: string): Promise<string> {
  const res = await req(`/api/invites/${await inviteToken(id)}/pin`, "POST", { pin });
  expect(res.status).toBe(200);
  return cookieOf(res);
}
const signIn = (name: string, pin: string) => req("/api/session/pin", "POST", { name, pin });

beforeEach(async () => {
  clock = new Date("2026-10-10T12:00:00Z");
  store = new SqliteStore();
  app = createApp({ store, adminToken: ADMIN, rp: { name: "Wanderlot", origin: ORIGIN }, now: () => clock });
  await admin("/members", "PUT", [
    { id: "ana", name: "Ana María" },
    { id: "bea", name: "Bea" },
    { id: "carlos", name: "Carlos" },
  ]);
});

describe("PINs", () => {
  it("rejects easy ones", () => {
    for (const pin of ["12345", "1234567", "abcdef", "111111", "123456", "987654", "121212", "123123"]) expect(pinProblem(pin)).not.toBeNull();
    for (const pin of ["480193", "205817"]) expect(pinProblem(pin)).toBeNull();
  });

  it("accepts an invite with a PIN, then signs in by name on another device", async () => {
    const cookie = await joinWithPin("ana", "480193");
    expect(((await (await req("/api/session", "GET", undefined, { cookie })).json()) as any).member.id).toBe("ana");

    // The laptop: accents, case and spaces don't matter; the id works too.
    for (const name of ["ana maria", "  ANA  MARÍA ", "ana"]) {
      const res = await signIn(name, "480193");
      expect(res.status).toBe(200);
      expect(cookieOf(res)).toMatch(/^wl_session=/);
    }
    const members = (await (await admin("/members")).json()) as any[];
    expect(members.find((m) => m.id === "ana").pin).toEqual({ setAt: clock.toISOString(), locked: false });
    // Stored as a keyed hash, never the PIN.
    const stored = (await store.pin("ana"))!;
    expect(stored.hash).not.toContain("480193");
    expect(stored.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("won't reuse the invite, and refuses a weak PIN without spending it", async () => {
    const token = await inviteToken("bea");
    expect((await req(`/api/invites/${token}/pin`, "POST", { pin: "123456" })).status).toBe(400);
    expect((await req(`/api/invites/${token}/pin`, "POST", { pin: "205817" })).status).toBe(200);
    expect((await req(`/api/invites/${token}/pin`, "POST", { pin: "205817" })).status).toBe(410);
  });

  it("says the same for an unknown name and a wrong PIN", async () => {
    await joinWithPin("ana", "480193");
    const a = await signIn("nadie", "480193");
    const b = await signIn("ana", "480194");
    expect([a.status, b.status]).toEqual([401, 401]);
    expect(await a.json()).toEqual(await b.json());
  });

  it("locks someone out after five wrong PINs, then lets them back in", async () => {
    await joinWithPin("ana", "480193");
    for (let i = 0; i < 4; i++) expect((await signIn("ana", "000001")).status).toBe(401);
    expect((await signIn("ana", "000001")).status).toBe(429);
    // Even the right PIN waits.
    expect((await signIn("ana", "480193")).status).toBe(429);
    expect(((await (await admin("/members")).json()) as any[]).find((m) => m.id === "ana").pin.locked).toBe(true);
    clock = new Date(clock.getTime() + PIN_LOCK_MS + 1000);
    expect((await signIn("ana", "480193")).status).toBe(200);
  });

  it("goes away with removed access; a new invite sets a new one", async () => {
    await joinWithPin("ana", "480193");
    await admin("/members/ana/revoke", "POST");
    expect((await signIn("ana", "480193")).status).toBe(401);
    await joinWithPin("ana", "730461");
    expect((await signIn("ana", "730461")).status).toBe(200);
  });

  it("keeps names unique, since they sign in with them", async () => {
    expect((await admin("/members", "PUT", [{ id: "ana-2", name: "ANA MARIA" }])).status).toBe(409);
    expect((await admin("/members", "PUT", [{ id: "ana", name: "Ana Mª" }])).status).toBe(200);
    expect(nameKey(" Ána  María ")).toBe("ana maria");
  });
});

describe("trips", () => {
  let cookies: Record<string, string>;
  beforeEach(async () => {
    cookies = { ana: await joinWithPin("ana", "480193"), bea: await joinWithPin("bea", "205817"), carlos: await joinWithPin("carlos", "730461") };
    const trip = (id: string, name: string, ids: string[]) => {
      const s = snapshot(ids.map((d) => destination(d)));
      return { ...s, plan: { ...s.plan, id, name } };
    };
    expect((await admin("/plans/verano", "PUT", trip("verano", "Verano", ["lis", "nap"]))).status).toBe(200);
    expect((await admin("/plans/puente", "PUT", trip("puente", "Puente", ["opo", "rak"]))).status).toBe(200);
    await admin("/plans/verano/members", "PUT", ["ana", "bea"]);
    await admin("/plans/puente/members", "PUT", ["carlos", "ana"]);
  });
  const as = (who: string, path: string, method = "GET", body?: unknown) => req(`/api/plans${path}`, method, body, { cookie: cookies[who]! });

  it("shows each person only the trips they're on", async () => {
    const ids = async (who: string) => ((await (await as(who, "")).json()) as any[]).map((p) => p.id).sort();
    expect(await ids("ana")).toEqual(["puente", "verano"]);
    expect(await ids("bea")).toEqual(["verano"]);
    expect(await ids("carlos")).toEqual(["puente"]);
    expect((await as("bea", "/puente")).status).toBe(404);
    expect((await as("bea", "/puente/comments")).status).toBe(404);
    expect((await as("bea", "/puente/comments", "POST", { destinationId: "opo", body: "hola" })).status).toBe(404);
  });

  it("counts only the trip's people: the vote closes when they've all voted", async () => {
    await admin("/plans/verano/open-vote", "POST", { deadline: "2026-10-20T20:00:00Z" });
    const view = (await (await as("ana", "/verano")).json()) as any;
    expect(view.participation.map((p: any) => p.id)).toEqual(["ana", "bea"]);
    expect((await as("carlos", "/verano/ballot", "PUT", { ranking: ["lis", "nap"] })).status).toBe(404);
    await as("ana", "/verano/ballot", "PUT", { ranking: ["lis", "nap"] });
    const last = (await (await as("bea", "/verano/ballot", "PUT", { ranking: ["nap", "lis"] })).json()) as any;
    expect(last.status).toBe("closed");
    expect(((await (await admin("/plans/verano/vote")).json()) as any).partySize).toBe(2);
  });

  it("only takes people who exist", async () => {
    expect((await admin("/plans/verano/members", "PUT", ["ana", "nobody"])).status).toBe(400);
    expect(await (await admin("/plans/verano/members")).json()).toEqual(["ana", "bea"]);
  });
});

describe("migrations on Node", () => {
  it("run once per database, so the trip backfill doesn't repeat on restart", async () => {
    const { mkdtempSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const path = join(mkdtempSync(join(tmpdir(), "wl-")), "site.sqlite");
    const first = new SqliteStore(path);
    await first.upsertMembers([{ id: "ana", name: "Ana" }, { id: "bea", name: "Bea" }]);
    await first.upsertSnapshot(snapshot([destination("lis"), destination("nap")]));
    await first.setPlanMembers("noviembre-2026", ["ana"]);
    const again = new SqliteStore(path);
    expect(await again.planMembers("noviembre-2026")).toEqual(["ana"]);
  });
});
