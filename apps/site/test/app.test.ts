import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.ts";
import { SqliteStore } from "../src/sqlite.ts";
import { destination, snapshot } from "../../../packages/core/test/fixtures.ts";
import { SoftAuthenticator } from "./authenticator.ts";

const ADMIN = "a".repeat(40);
const ORIGIN = "http://localhost:8787";
const PLAN = "noviembre-2026";
const FRIENDS = ["ana", "bea", "carlos", "dani", "eva", "fer"];
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

let clock: Date;
let app: ReturnType<typeof createApp>;

const HEADERS = { "content-type": "application/json", "user-agent": UA };

async function admin(path: string, method: string, body?: unknown) {
  return app.request(`/api/admin${path}`, {
    method,
    headers: { authorization: `Bearer ${ADMIN}`, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function call(path: string, opts: { method?: string; body?: unknown; cookie?: string } = {}) {
  return app.request(path, {
    method: opts.method ?? "GET",
    headers: { ...HEADERS, ...(opts.cookie ? { cookie: opts.cookie } : {}) },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
}

const cookieOf = (res: Response) => res.headers.get("set-cookie")?.split(";")[0] ?? "";

async function invite(memberId: string): Promise<string> {
  const res = await admin(`/members/${memberId}/invite`, "POST");
  expect(res.status).toBe(200);
  return ((await res.json()) as { token: string }).token;
}

// Accepts an invite with a passkey; returns the session cookie.
async function accept(token: string, device: SoftAuthenticator): Promise<Response> {
  const opts = (await (await call(`/api/invites/${token}/passkey/options`, { method: "POST" })).json()) as any;
  return call(`/api/invites/${token}/passkey/verify`, { method: "POST", body: { flowId: opts.flowId, response: device.register(opts.options) } });
}

async function signIn(device: SoftAuthenticator): Promise<Response> {
  const opts = (await (await call("/api/session/options", { method: "POST" })).json()) as any;
  return call("/api/session/verify", { method: "POST", body: { flowId: opts.flowId, response: device.login(opts.options) } });
}

const devices: Record<string, SoftAuthenticator> = {};
const cookies: Record<string, string> = {};

async function join(memberId: string): Promise<string> {
  devices[memberId] = new SoftAuthenticator(ORIGIN);
  const res = await accept(await invite(memberId), devices[memberId]);
  expect(res.status).toBe(200);
  return (cookies[memberId] = cookieOf(res));
}

beforeEach(async () => {
  clock = new Date("2026-10-10T12:00:00Z");
  app = createApp({ store: new SqliteStore(), adminToken: ADMIN, rp: { name: "Wanderlot", origin: ORIGIN }, now: () => clock, indexHtml: "<p>ui</p>" });
  expect((await admin("/members", "PUT", FRIENDS.map((id) => ({ id, name: id[0]!.toUpperCase() + id.slice(1) })))).status).toBe(200);
});

describe("access", () => {
  it("rejects the admin API without the token", async () => {
    expect((await app.request("/api/admin/members")).status).toBe(401);
    expect((await app.request("/api/admin/members", { headers: { authorization: "Bearer nope" } })).status).toBe(401);
  });

  it("serves the UI to anyone but the API only with a session", async () => {
    for (const path of ["/", "/entrar", "/i/whatever", `/p/${PLAN}/votacion`]) {
      expect(await (await app.request(path)).text()).toBe("<p>ui</p>");
    }
    expect((await call(`/api/plans/${PLAN}`)).status).toBe(401);
    expect((await call("/api/session")).status).toBe(401);
  });
});

describe("invites", () => {
  it("shows who it's for without using it up", async () => {
    const token = await invite("ana");
    for (let i = 0; i < 2; i++) {
      // A WhatsApp preview and the real tap: both leave it valid.
      await app.request(`/i/${token}`);
      expect(await (await call(`/api/invites/${token}`)).json()).toEqual({ member: { name: "Ana" }, status: "valid" });
    }
  });

  it("signs the person in with a new passkey and then stops working", async () => {
    const token = await invite("ana");
    const ana = new SoftAuthenticator(ORIGIN);
    const res = await accept(token, ana);
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toMatch(/wl_session=.*HttpOnly.*SameSite=Lax/);
    const me = await (await call("/api/session", { cookie: cookieOf(res) })).json();
    expect(me).toEqual({ member: { id: "ana", name: "Ana" } });

    expect(((await (await call(`/api/invites/${token}`)).json()) as any).status).toBe("used");
    expect((await call(`/api/invites/${token}/passkey/options`, { method: "POST" })).status).toBe(410);
  });

  it("is useless to whoever gets a forwarded copy after it's used", async () => {
    const token = await invite("ana");
    await accept(token, new SoftAuthenticator(ORIGIN));
    const stranger = await call(`/api/invites/${token}/passkey/options`, { method: "POST" });
    expect(stranger.status).toBe(410);
    expect(await stranger.json()).toMatchObject({ status: "used" });
  });

  it("lets only one of two racing tabs use it", async () => {
    const token = await invite("ana");
    const a = (await (await call(`/api/invites/${token}/passkey/options`, { method: "POST" })).json()) as any;
    const b = (await (await call(`/api/invites/${token}/passkey/options`, { method: "POST" })).json()) as any;
    const first = await call(`/api/invites/${token}/passkey/verify`, { method: "POST", body: { flowId: a.flowId, response: new SoftAuthenticator(ORIGIN).register(a.options) } });
    const second = await call(`/api/invites/${token}/passkey/verify`, { method: "POST", body: { flowId: b.flowId, response: new SoftAuthenticator(ORIGIN).register(b.options) } });
    expect([first.status, second.status]).toEqual([200, 410]);
  });

  it("expires after seven days", async () => {
    const token = await invite("ana");
    clock = new Date(clock.getTime() + 7 * 86_400_000 + 1000);
    expect(((await (await call(`/api/invites/${token}`)).json()) as any).status).toBe("expired");
    expect((await call(`/api/invites/${token}/passkey/options`, { method: "POST" })).status).toBe(410);
  });

  it("is cancelled by a newer invite for the same person", async () => {
    const old = await invite("ana");
    const fresh = await invite("ana");
    expect(((await (await call(`/api/invites/${old}`)).json()) as any).status).toBe("cancelled");
    expect(((await (await call(`/api/invites/${fresh}`)).json()) as any).status).toBe("valid");
  });

  it("rejects unknown tokens, reused flows and passkeys for another site", async () => {
    expect((await call("/api/invites/nope")).status).toBe(404);
    const token = await invite("ana");
    const opts = (await (await call(`/api/invites/${token}/passkey/options`, { method: "POST" })).json()) as any;

    const phishing = new SoftAuthenticator("https://evil.example", "evil.example");
    const bad = await call(`/api/invites/${token}/passkey/verify`, { method: "POST", body: { flowId: opts.flowId, response: phishing.register(opts.options) } });
    expect(bad.status).toBe(400);
    // That attempt used the flow up; the invite itself is still fine.
    const reuse = await call(`/api/invites/${token}/passkey/verify`, { method: "POST", body: { flowId: opts.flowId, response: new SoftAuthenticator(ORIGIN).register(opts.options) } });
    expect(reuse.status).toBe(400);
    expect(((await (await call(`/api/invites/${token}`)).json()) as any).status).toBe("valid");
  });
});

describe("signing in", () => {
  it("works with just the passkey on a new session", async () => {
    await join("ana");
    const res = await signIn(devices.ana!);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ member: { id: "ana", name: "Ana" } });
    expect((await call("/api/session", { cookie: cookieOf(res) })).status).toBe(200);
  });

  it("signs out one device", async () => {
    const cookie = await join("ana");
    expect((await call("/api/session", { method: "DELETE", cookie })).status).toBe(200);
    expect((await call("/api/session", { cookie })).status).toBe(401);
  });

  it("keeps a used session alive and ends an idle one after 180 days", async () => {
    const cookie = await join("ana");
    clock = new Date(clock.getTime() + 100 * 86_400_000);
    expect((await call("/api/session", { cookie })).status).toBe(200); // slides the expiry
    clock = new Date(clock.getTime() + 179 * 86_400_000);
    expect((await call("/api/session", { cookie })).status).toBe(200);
    clock = new Date(clock.getTime() + 181 * 86_400_000);
    expect((await call("/api/session", { cookie })).status).toBe(401);
  });
});

describe("organiser controls", () => {
  it("reports each person's state without secrets", async () => {
    await join("ana");
    await invite("bea");
    const list = (await (await admin("/members", "GET")).json()) as any[];
    const ana = list.find((m) => m.id === "ana");
    const bea = list.find((m) => m.id === "bea");
    const carlos = list.find((m) => m.id === "carlos");
    expect(ana.invite.status).toBe("used");
    expect(ana.passkeys).toEqual([{ device: "Safari en iPhone", createdAt: clock.toISOString(), lastUsedAt: clock.toISOString() }]);
    expect(ana.sessions).toHaveLength(1);
    expect(bea.invite.status).toBe("valid");
    expect(bea.passkeys).toEqual([]);
    expect(carlos.invite).toBeNull();
    expect(JSON.stringify(list)).not.toMatch(/token|hash|public/i);
  });

  it("closing sessions signs someone out but their passkey still works", async () => {
    const cookie = await join("ana");
    await admin("/members/ana/sessions", "DELETE");
    expect((await call("/api/session", { cookie })).status).toBe(401);
    expect((await signIn(devices.ana!)).status).toBe(200);
  });

  it("removing access kills passkeys, sessions and pending invites", async () => {
    const cookie = await join("ana");
    const pending = await invite("ana");
    await admin("/members/ana/revoke", "POST");
    expect((await call("/api/session", { cookie })).status).toBe(401);
    expect((await signIn(devices.ana!)).status).toBe(401);
    expect(((await (await call(`/api/invites/${pending}`)).json()) as any).status).toBe("cancelled");
    // A new invite brings her back.
    expect((await accept(await invite("ana"), new SoftAuthenticator(ORIGIN))).status).toBe(200);
  });
});

// --- plans, votes and comments (SPEC §2, §4) ---------------------------------

const four = () => [destination("lis"), destination("nap"), destination("opo"), destination("bud", { inVote: false })];

const as = (member: string, path: string, method = "GET", body?: unknown) =>
  call(`/api/plans${path}`, { method, body, cookie: cookies[member] });

describe("with everyone signed in", () => {
  beforeEach(async () => {
    for (const f of FRIENDS) await join(f);
    expect((await admin(`/plans/${PLAN}`, "PUT", snapshot(four()))).status).toBe(200);
    expect((await admin(`/plans/${PLAN}/members`, "PUT", FRIENDS)).status).toBe(200);
  });

  describe("the group", () => {
    it("shows its name publicly and lets the panel change it", async () => {
      expect(await (await call("/api/site")).json()).toEqual({ groupName: "Wanderlot", organiserName: "quien organiza" });
      expect((await admin("/settings", "PUT", { groupName: "Grupo 51", organiserName: "Eyman", defaultOrigin: "MAD" })).status).toBe(200);
      expect(await (await call("/api/site")).json()).toEqual({ groupName: "Grupo 51", organiserName: "Eyman" });
      expect(await (await admin("/settings", "GET")).json()).toMatchObject({ defaultOrigin: "MAD" });
      expect((await admin("/settings", "PUT", { groupName: "" })).status).toBe(400);
    });

    it("lists plans with their state and winner", async () => {
      await admin(`/plans/${PLAN}/open-vote`, "POST", { deadline: "2026-10-20T20:00:00Z" });
      for (const f of FRIENDS) await as(f, `/${PLAN}/ballot`, "PUT", { ranking: ["nap", "lis", "opo"] });
      const list = (await (await as("ana", "")).json()) as any[];
      expect(list).toEqual([
        { id: PLAN, name: "Noviembre 2026", status: "closed", dateFrom: "2026-11-07", dateTo: "2026-11-14", partySize: 6, winnerCity: "nap" },
      ]);
      const view = (await (await as("ana", `/${PLAN}`)).json()) as any;
      expect(view.myBallot).toEqual({ ranking: ["nap", "lis", "opo"], updatedAt: clock.toISOString() });
    });
  });

  describe("publishing", () => {
    it("rejects an invalid snapshot", async () => {
      expect((await admin(`/plans/${PLAN}`, "PUT", snapshot([destination("lis", { totalPerPersonCents: -1 })]))).status).toBe(400);
    });

    it("freezes the vote set after the first ballot but allows content edits", async () => {
      await admin(`/plans/${PLAN}/open-vote`, "POST", { deadline: "2026-10-20T20:00:00Z" });
      await as("ana", `/${PLAN}/ballot`, "PUT", { ranking: ["lis", "nap", "opo"] });
      expect((await admin(`/plans/${PLAN}`, "PUT", snapshot(four().map((d) => ({ ...d, weather: "Soleado" }))))).status).toBe(200);
      expect((await admin(`/plans/${PLAN}`, "PUT", snapshot(four().slice(1)))).status).toBe(409);
    });

    it("refuses ballots before the vote opens", async () => {
      expect((await as("ana", `/${PLAN}/ballot`, "PUT", { ranking: ["lis", "nap", "opo"] })).status).toBe(409);
    });

    it("needs two in-vote destinations to open a vote", async () => {
      await admin(`/plans/${PLAN}`, "PUT", snapshot([destination("lis"), destination("nap", { inVote: false })]));
      expect((await admin(`/plans/${PLAN}/open-vote`, "POST", { deadline: "2026-10-20T20:00:00Z" })).status).toBe(409);
    });
  });

  describe("voting", () => {
    beforeEach(async () => {
      await admin(`/plans/${PLAN}/open-vote`, "POST", { deadline: "2026-10-20T20:00:00Z" });
    });

    it("refuses invalid rankings", async () => {
      expect((await as("ana", `/${PLAN}/ballot`, "PUT", { ranking: ["lis", "nap"] })).status).toBe(400);
      expect((await as("ana", `/${PLAN}/ballot`, "PUT", { ranking: ["lis", "nap", "bud"] })).status).toBe(400);
    });

    it("hides the tally but shows participation while voting", async () => {
      await as("ana", `/${PLAN}/ballot`, "PUT", { ranking: ["lis", "nap", "opo"] });
      expect((await as("ana", `/${PLAN}/results`)).status).toBe(403);
      const view = (await (await as("bea", `/${PLAN}`)).json()) as any;
      expect(view.plan.status).toBe("voting");
      expect(view.myRanking).toBeNull();
      expect(view.participation.find((p: any) => p.id === "ana").voted).toBe(true);
      expect(view.participation.find((p: any) => p.id === "bea").voted).toBe(false);
      expect(JSON.stringify(view)).not.toMatch(/points/);
    });

    it("lets a member change their ballot while open", async () => {
      await as("ana", `/${PLAN}/ballot`, "PUT", { ranking: ["lis", "nap", "opo"] });
      await as("ana", `/${PLAN}/ballot`, "PUT", { ranking: ["opo", "nap", "lis"] });
      expect(((await (await as("ana", `/${PLAN}`)).json()) as any).myRanking).toEqual(["opo", "nap", "lis"]);
    });

    it("closes on the last ballot, reveals the scoreboard and locks ballots", async () => {
      for (const f of FRIENDS.slice(0, 5)) await as(f, `/${PLAN}/ballot`, "PUT", { ranking: ["nap", "lis", "opo"] });
      const last = (await (await as("fer", `/${PLAN}/ballot`, "PUT", { ranking: ["lis", "nap", "opo"] })).json()) as any;
      expect(last.status).toBe("closed");
      const results = (await (await as("ana", `/${PLAN}/results`)).json()) as any;
      expect(results.winnerId).toBe("nap");
      expect(results.rows.map((r: any) => [r.id, r.points])).toEqual([
        ["nap", 17],
        ["lis", 13],
        ["opo", 6],
      ]);
      expect(results.ballots).toHaveLength(6);
      expect((await as("ana", `/${PLAN}/ballot`, "PUT", { ranking: ["lis", "nap", "opo"] })).status).toBe(409);
    });

    it("closes at the deadline with whoever voted", async () => {
      await as("ana", `/${PLAN}/ballot`, "PUT", { ranking: ["opo", "lis", "nap"] });
      clock = new Date("2026-10-20T20:00:00Z");
      expect(((await (await as("ana", `/${PLAN}/results`)).json()) as any).winnerId).toBe("opo");
    });

    it("shows the organiser the count and every ballot live, but not the friends", async () => {
      await as("ana", `/${PLAN}/ballot`, "PUT", { ranking: ["opo", "lis", "nap"] });
      clock = new Date(clock.getTime() + 60_000);
      await as("bea", `/${PLAN}/ballot`, "PUT", { ranking: ["lis", "opo", "nap"] });
      const open = (await (await admin(`/plans/${PLAN}/vote`, "GET")).json()) as any;
      expect(open).toMatchObject({ status: "voting", voteDeadline: "2026-10-20T20:00:00Z", partySize: 6, result: null });
      expect(open.voted.sort()).toEqual(["ana", "bea"]);
      // Most recent first.
      expect(open.ballots.map((b: any) => [b.memberId, b.ranking])).toEqual([
        ["bea", ["lis", "opo", "nap"]],
        ["ana", ["opo", "lis", "nap"]],
      ]);
      expect(open.tally.rows.map((r: any) => [r.id, r.points])).toEqual([
        ["lis", 5],
        ["opo", 5],
        ["nap", 2],
      ]);
      // The friends still can't see it.
      expect((await as("ana", `/${PLAN}/results`)).status).toBe(403);
      expect(JSON.stringify(await (await as("carlos", `/${PLAN}`)).json())).not.toMatch(/ranking":\["/);
    });

    it("closes early on the organiser's word, not before anyone votes", async () => {
      expect((await admin(`/plans/${PLAN}/close`, "POST")).status).toBe(409);
      await as("ana", `/${PLAN}/ballot`, "PUT", { ranking: ["opo", "lis", "nap"] });
      await as("bea", `/${PLAN}/ballot`, "PUT", { ranking: ["opo", "nap", "lis"] });
      const closed = (await (await admin(`/plans/${PLAN}/close`, "POST")).json()) as any;
      expect(closed.status).toBe("closed");
      expect(closed.result.winnerId).toBe("opo");
      expect((await as("carlos", `/${PLAN}/ballot`, "PUT", { ranking: ["lis", "nap", "opo"] })).status).toBe(409);
      expect(((await (await as("carlos", `/${PLAN}/results`)).json()) as any).winnerId).toBe("opo");
      expect((await admin(`/plans/${PLAN}/close`, "POST")).status).toBe(409);
    });

    it("lets the organiser break a tie for first, and only then", async () => {
      await as("ana", `/${PLAN}/ballot`, "PUT", { ranking: ["lis", "nap", "opo"] });
      await as("bea", `/${PLAN}/ballot`, "PUT", { ranking: ["nap", "lis", "opo"] });
      expect((await admin(`/plans/${PLAN}/winner`, "PUT", { destinationId: "lis" })).status).toBe(409);
      const tied = (await (await admin(`/plans/${PLAN}/close`, "POST")).json()) as any;
      expect(tied.result.winnerId).toBeNull();
      expect(tied.result.tiedForFirst.sort()).toEqual(["lis", "nap"]);
      expect((await admin(`/plans/${PLAN}/winner`, "PUT", { destinationId: "opo" })).status).toBe(409);
      const picked = (await (await admin(`/plans/${PLAN}/winner`, "PUT", { destinationId: "nap" })).json()) as any;
      expect(picked.result.winnerId).toBe("nap");
      expect(((await (await as("ana", `/${PLAN}/results`)).json()) as any).winnerId).toBe("nap");
      expect(((await (await as("ana", "")).json()) as any[])[0].winnerCity).toBe("nap");
    });
  });

  describe("comments", () => {
    it("threads one level deep and lists the three most recent across the plan", async () => {
      const post = async (member: string, body: unknown) => (await (await as(member, `/${PLAN}/comments`, "POST", body)).json()) as any;
      const root = await post("ana", { destinationId: "lis", body: "¿Alguien ha ido en noviembre?" });
      clock = new Date(clock.getTime() + 1000);
      const reply = await post("bea", { destinationId: "lis", body: "Yo, llueve poco", parentId: root.id });
      expect(reply.parentId).toBe(root.id);
      expect((await as("carlos", `/${PLAN}/comments`, "POST", { destinationId: "lis", body: "x", parentId: reply.id })).status).toBe(400);
      expect((await as("carlos", `/${PLAN}/comments`, "POST", { destinationId: "nap", body: "x", parentId: root.id })).status).toBe(400);
      for (const [i, d] of ["nap", "opo"].entries()) {
        clock = new Date(clock.getTime() + (i + 1) * 1000);
        await post("dani", { destinationId: d, body: `Me gusta ${d}` });
      }
      const recent = (await (await as("eva", `/${PLAN}/comments?limit=3`)).json()) as any[];
      expect(recent.map((c) => c.destinationId)).toEqual(["opo", "nap", "lis"]);
      expect(recent[2].body).toBe("Yo, llueve poco");
      expect(((await (await as("eva", `/${PLAN}/comments`)).json()) as any[]).length).toBe(4);
      expect(((await (await as("eva", `/${PLAN}/comments?destinationId=lis`)).json()) as any[]).length).toBe(2);
    });

    it("counts likes per person and shows mine", async () => {
      const root = (await (await as("ana", `/${PLAN}/comments`, "POST", { destinationId: "lis", body: "¿Lisboa?" })).json()) as any;
      expect(root).toMatchObject({ likes: 0, likedByMe: false });
      for (const m of ["bea", "carlos", "bea"]) await as(m, `/${PLAN}/comments/${root.id}/like`, "PUT", { on: true });
      const forBea = (await (await as("bea", `/${PLAN}/comments`)).json()) as any[];
      expect(forBea[0]).toMatchObject({ likes: 2, likedByMe: true });
      await as("bea", `/${PLAN}/comments/${root.id}/like`, "PUT", { on: false });
      const forAna = (await (await as("ana", `/${PLAN}/comments`)).json()) as any[];
      expect(forAna[0]).toMatchObject({ likes: 1, likedByMe: false });
      expect((await as("ana", `/${PLAN}/comments/nope/like`, "PUT", { on: true })).status).toBe(404);
    });
  });
});
