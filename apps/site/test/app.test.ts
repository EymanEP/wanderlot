import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.ts";
import { SiteDb } from "../src/db.ts";
import { destination, snapshot } from "../../../packages/core/test/fixtures.ts";

const ADMIN = "a".repeat(40);
const PLAN = "noviembre-2026";
const FRIENDS = ["ana", "bea", "carlos", "dani", "eva", "fer"];

let clock: Date;
let app: ReturnType<typeof createApp>;
let tokens: Record<string, string>;

const admin = (path: string, method: string, body?: unknown) =>
  app.request(`/api/admin${path}`, {
    method,
    headers: { authorization: `Bearer ${ADMIN}`, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

async function as(member: string, path: string, method = "GET", body?: unknown) {
  // Visit the private link once to get the cookie, as a browser would.
  const visit = await app.request(`/p/${PLAN}?k=${tokens[member]}`);
  const cookie = visit.headers.get("set-cookie")!.split(";")[0]!;
  return app.request(`/api${path}`, {
    method,
    headers: { cookie, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const four = () => [destination("lis"), destination("nap"), destination("opo"), destination("bud", { inVote: false })];

beforeEach(async () => {
  clock = new Date("2026-10-10T12:00:00Z");
  app = createApp({ db: new SiteDb(), adminToken: ADMIN, now: () => clock });
  const issued = (await (await admin("/members", "POST", FRIENDS.map((id) => ({ id, name: id })))).json()) as {
    id: string;
    token: string;
  }[];
  tokens = Object.fromEntries(issued.map((m) => [m.id, m.token]));
  expect((await admin(`/plans/${PLAN}`, "PUT", snapshot(four()))).status).toBe(200);
});

describe("access", () => {
  it("rejects the admin API without the token", async () => {
    const res = await app.request(`/api/admin/plans/${PLAN}`, { method: "PUT", body: "{}" });
    expect(res.status).toBe(401);
  });

  it("shows nothing without a valid member link", async () => {
    expect((await app.request(`/api/plans/${PLAN}`)).status).toBe(401);
    expect((await app.request(`/p/${PLAN}?k=nope`)).status).toBe(403);
  });

  it("exchanges the link for an http-only cookie and a clean URL", async () => {
    const res = await app.request(`/p/${PLAN}?k=${tokens.ana}`);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(`/p/${PLAN}`);
    expect(res.headers.get("set-cookie")).toMatch(/HttpOnly/);
  });

  it("revokes the old link when a member's token is reissued", async () => {
    const old = tokens.ana;
    await admin("/members", "POST", [{ id: "ana", name: "Ana" }]);
    expect((await app.request(`/p/${PLAN}?k=${old}`)).status).toBe(403);
  });
});

describe("publishing", () => {
  it("rejects an invalid snapshot", async () => {
    const bad = snapshot([destination("lis", { totalPerPersonCents: -1 })]);
    expect((await admin(`/plans/${PLAN}`, "PUT", bad)).status).toBe(400);
  });

  it("freezes the vote set after the first ballot but allows content edits", async () => {
    await admin(`/plans/${PLAN}/open-vote`, "POST", { deadline: "2026-10-20T20:00:00Z" });
    await as("ana", `/plans/${PLAN}/ballot`, "PUT", { ranking: ["lis", "nap", "opo"] });

    const edited = four().map((d) => ({ ...d, weather: "Soleado" }));
    expect((await admin(`/plans/${PLAN}`, "PUT", snapshot(edited))).status).toBe(200);

    const dropped = four().slice(1);
    expect((await admin(`/plans/${PLAN}`, "PUT", snapshot(dropped))).status).toBe(409);
  });

  it("refuses ballots before the vote opens", async () => {
    expect((await as("ana", `/plans/${PLAN}/ballot`, "PUT", { ranking: ["lis", "nap", "opo"] })).status).toBe(409);
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
    expect((await as("ana", `/plans/${PLAN}/ballot`, "PUT", { ranking: ["lis", "nap"] })).status).toBe(400);
    expect((await as("ana", `/plans/${PLAN}/ballot`, "PUT", { ranking: ["lis", "nap", "bud"] })).status).toBe(400);
  });

  it("hides the tally but shows participation while voting", async () => {
    await as("ana", `/plans/${PLAN}/ballot`, "PUT", { ranking: ["lis", "nap", "opo"] });
    expect((await as("ana", `/plans/${PLAN}/results`)).status).toBe(403);

    const view = (await (await as("bea", `/plans/${PLAN}`)).json()) as any;
    expect(view.plan.status).toBe("voting");
    expect(view.myRanking).toBeNull();
    expect(view.participation.find((p: any) => p.id === "ana").voted).toBe(true);
    expect(view.participation.find((p: any) => p.id === "bea").voted).toBe(false);
    expect(JSON.stringify(view)).not.toMatch(/points/);
  });

  it("lets a member change their ballot while open", async () => {
    await as("ana", `/plans/${PLAN}/ballot`, "PUT", { ranking: ["lis", "nap", "opo"] });
    await as("ana", `/plans/${PLAN}/ballot`, "PUT", { ranking: ["opo", "nap", "lis"] });
    const view = (await (await as("ana", `/plans/${PLAN}`)).json()) as any;
    expect(view.myRanking).toEqual(["opo", "nap", "lis"]);
  });

  it("closes on the sixth ballot, reveals the scoreboard and locks ballots", async () => {
    for (const f of FRIENDS.slice(0, 5)) {
      await as(f, `/plans/${PLAN}/ballot`, "PUT", { ranking: ["nap", "lis", "opo"] });
    }
    const last = (await (await as("fer", `/plans/${PLAN}/ballot`, "PUT", { ranking: ["lis", "nap", "opo"] })).json()) as any;
    expect(last.status).toBe("closed");

    const results = (await (await as("ana", `/plans/${PLAN}/results`)).json()) as any;
    expect(results.winnerId).toBe("nap");
    expect(results.rows.map((r: any) => [r.id, r.points])).toEqual([
      ["nap", 17],
      ["lis", 13],
      ["opo", 6],
    ]);
    expect(results.ballots).toHaveLength(6);
    expect((await as("ana", `/plans/${PLAN}/ballot`, "PUT", { ranking: ["lis", "nap", "opo"] })).status).toBe(409);
  });

  it("closes at the deadline with whoever voted", async () => {
    await as("ana", `/plans/${PLAN}/ballot`, "PUT", { ranking: ["opo", "lis", "nap"] });
    clock = new Date("2026-10-20T20:00:00Z");
    const results = (await (await as("ana", `/plans/${PLAN}/results`)).json()) as any;
    expect(results.winnerId).toBe("opo");
  });
});

describe("comments", () => {
  it("threads one level deep and lists the three most recent across the plan", async () => {
    const post = async (member: string, body: unknown) =>
      (await (await as(member, `/plans/${PLAN}/comments`, "POST", body)).json()) as any;

    const root = await post("ana", { destinationId: "lis", body: "¿Alguien ha ido en noviembre?" });
    clock = new Date(clock.getTime() + 1000);
    const reply = await post("bea", { destinationId: "lis", body: "Yo, llueve poco", parentId: root.id });
    expect(reply.parentId).toBe(root.id);

    const nested = await as("carlos", `/plans/${PLAN}/comments`, "POST", {
      destinationId: "lis",
      body: "x",
      parentId: reply.id,
    });
    expect(nested.status).toBe(400);
    const crossPlace = await as("carlos", `/plans/${PLAN}/comments`, "POST", {
      destinationId: "nap",
      body: "x",
      parentId: root.id,
    });
    expect(crossPlace.status).toBe(400);

    for (const [i, d] of ["nap", "opo"].entries()) {
      clock = new Date(clock.getTime() + (i + 1) * 1000);
      await post("dani", { destinationId: d, body: `Me gusta ${d}` });
    }
    const recent = (await (await as("eva", `/plans/${PLAN}/comments`)).json()) as any[];
    expect(recent.map((c) => c.destinationId)).toEqual(["opo", "nap", "lis"]);
    expect(recent[2].body).toBe("Yo, llueve poco");
  });
});
