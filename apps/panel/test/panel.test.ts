import { beforeEach, describe, expect, it } from "vitest";
import type { Proposal } from "@wanderlot/core";
import { createPanel } from "../src/app.ts";
import { siteClient } from "../src/publish.ts";
import { PanelStore } from "../src/store.ts";
import type { FlightProvider, ResearchProvider } from "../src/providers/types.ts";
import type { PhotoSource } from "../src/providers/photos.ts";
import { createApp } from "../../site/src/app.ts";
import { SqliteStore } from "../../site/src/sqlite.ts";
import { SoftAuthenticator } from "../../site/test/authenticator.ts";
import { proposal } from "../../../packages/core/test/fixtures.ts";

const ADMIN = "t".repeat(40);
const SITE = "https://wanderlot.test";
const PLAN = "noviembre-2026";
const FRIENDS = ["ana", "bea", "carlos", "dani", "eva", "fer"].map((id) => ({ id, name: id }));

const strip = ({ review: _r, ...p }: Proposal) => p;
const claudeSources = { kind: "claude" as const, sources: [{ label: "x", url: "https://x.test" }] };

let clock: Date;
let panel: ReturnType<typeof createPanel>;
let picked: string[] = [];
let site: ReturnType<typeof createApp>;

const call = async (path: string, method = "GET", body?: unknown) => {
  const res = await panel.request(path, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: (await res.text()) as string };
};
const json = async (path: string, method = "GET", body?: unknown) => {
  const r = await call(path, method, body);
  return { status: r.status, data: JSON.parse(r.body) as any };
};

beforeEach(async () => {
  clock = new Date("2026-10-10T12:00:00Z");
  site = createApp({ store: new SqliteStore(), adminToken: ADMIN, rp: { name: "Wanderlot", origin: SITE }, now: () => clock });

  const research: ResearchProvider = {
    async *research() {
      yield {
        proposal: strip(proposal("lis", "Lisboa", "LIS", { provenance: claudeSources })),
        notes: { pros: ["Vuelo corto"], cons: ["Llueve"], weather: "17 °C", photoSubjects: ["Alfama Lisboa"] },
      };
      yield { proposal: strip(proposal("nap", "Nápoles", "NAP", { provenance: claudeSources })) };
      yield { proposal: strip(proposal("edi", "Edimburgo", "EDI", { provenance: claudeSources })) };
    },
  };
  const flights: FlightProvider = {
    name: "duffel",
    search: () => {
      throw new Error("unused");
    },
    verify: async (route) => {
      if (route.destination === "EDI") return null;
      const { outbound, inbound } = proposal("x", "x", route.destination);
      return { outbound: { ...outbound, priceCents: 5000 }, inbound: { ...inbound, priceCents: 5000 } };
    },
  };

  picked = [];
  const unsplashStub: PhotoSource = {
    name: "unsplash",
    search: async (q) => [
      { url: "https://images.unsplash.com/a", source: "unsplash", author: "Rui", license: "Unsplash License", sourceUrl: "https://unsplash.com/photos/a", alt: q, downloadLocation: "https://api.unsplash.com/photos/a/download" },
    ],
    picked: async (p) => void picked.push(p.url),
  };
  panel = createPanel({
    store: new PanelStore(null),
    flights,
    research,
    photos: [unsplashStub],
    site: siteClient(SITE, ADMIN, async (input, init) => site.request(String(input), init)),
    siteUrl: SITE,
    now: () => clock,
  });

  await json(`/api/plans/${PLAN}`, "PUT", {
    name: "Noviembre 2026",
    origin: "MAD",
    dateFrom: "2026-11-07",
    dateTo: "2026-11-14",
    nights: 7,
    flexDays: 1,
    partySize: 6,
    maxPriceCents: 42000,
    status: "draft",
  });
});

describe("panel → site", () => {
  it("streams generated proposals and stores them as pending", async () => {
    const r = await call(`/api/plans/${PLAN}/generate`, "POST", {
      source: "claude",
      scope: { kind: "europe" },
      stops: "direct",
      estimateStays: true,
      suggestThings: true,
    });
    const lines = r.body.trim().split("\n").map((l) => JSON.parse(l));
    expect(lines.map((l) => l.proposal?.id ?? "done")).toEqual(["lis", "nap", "edi", "done"]);
    const { data } = await json(`/api/plans/${PLAN}`);
    expect(data.proposals.every((p: Proposal) => p.review === "pending")).toBe(true);
    // Research's notes seed Comparativa and the photo picker.
    expect(data.editorial.lis).toEqual({ pros: ["Vuelo corto"], cons: ["Llueve"], weather: "17 °C", photoQueries: ["Alfama Lisboa"] });
  });

  it("publishes only what was approved, confirming unverified ones, then opens the vote", async () => {
    await call(`/api/plans/${PLAN}/generate`, "POST", {
      source: "claude",
      scope: { kind: "europe" },
      stops: "direct",
      estimateStays: true,
      suggestThings: true,
    });
    for (const id of ["lis", "nap", "edi"]) {
      await json(`/api/plans/${PLAN}/proposals/${id}/review`, "POST", { review: id === "edi" ? "discarded" : "approved" });
    }

    // Unverified proposals need an explicit confirmation.
    const first = await json(`/api/plans/${PLAN}/publish`, "POST", {});
    expect(first.status).toBe(409);
    expect(first.data.warnings.map((w: any) => w.destinationId)).toEqual(["lis", "nap"]);

    // Verifying Lisbon turns it green; Edinburgh has no match and stays amber.
    const v = await json(`/api/plans/${PLAN}/proposals/lis/verify`, "POST");
    expect(v.data.proposal.provenance).toEqual({ kind: "api", provider: "duffel", checkedAt: clock.toISOString() });
    expect((await json(`/api/plans/${PLAN}/proposals/edi/verify`, "POST")).data.verified).toBe(false);

    const pub = await json(`/api/plans/${PLAN}/publish`, "POST", { confirm: true });
    expect(pub.data).toMatchObject({ ok: true, published: 2 });

    // People first, then the vote.
    expect((await json(`/api/plans/${PLAN}/open-vote`, "POST", { deadline: "2026-10-20T20:00:00Z" })).status).toBe(409);
    await json("/api/members", "PUT", FRIENDS);
    const opened = await json(`/api/plans/${PLAN}/open-vote`, "POST", { deadline: "2026-10-20T20:00:00Z" });
    expect(opened.status).toBe(200);
    const message = opened.data.message as string;
    expect(message).toContain("Abierta la votación de Noviembre 2026");
    expect(message).toContain(`Entrad en ${SITE}/p/${PLAN}`);
    const anaInvite = message.split("\n").find((l) => l.startsWith("• ana:"))!.slice(7);
    expect(anaInvite).toMatch(new RegExp(`^${SITE}/i/`));

    // Ana accepts her invite with a passkey and sees exactly the approved pair.
    const token = anaInvite.split("/i/")[1]!;
    const phone = new SoftAuthenticator(SITE);
    const opts = (await (await site.request(`/api/invites/${token}/passkey/options`, { method: "POST" })).json()) as any;
    const joined = await site.request(`/api/invites/${token}/passkey/verify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ flowId: opts.flowId, response: phone.register(opts.options) }),
    });
    expect(joined.status).toBe(200);
    const cookie = joined.headers.get("set-cookie")!.split(";")[0]!;
    const view = (await (await site.request(`/api/plans/${PLAN}`, { headers: { cookie } })).json()) as any;
    expect(view.plan.status).toBe("voting");
    expect(view.destinations.map((d: any) => d.id)).toEqual(["lis", "nap"]);
    expect(view.destinations[0].totalPerPersonCents).toBe(10000 + 23800);

    // The panel now sees her inside, and her invite link is gone.
    const people = (await json("/api/members")).data as any[];
    const ana = people.find((p) => p.id === "ana");
    expect(ana.passkeys).toHaveLength(1);
    expect(ana.inviteUrl).toBeNull();
    expect(people.find((p) => p.id === "bea").inviteUrl).toMatch(/\/i\//);

    // She votes; the panel sees who's in, and a reminder names the rest.
    const voted = await site.request(`/api/plans/${PLAN}/ballot`, {
      method: "PUT",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ ranking: ["nap", "lis"] }),
    });
    expect(voted.status).toBe(200);
    const following = (await json(`/api/plans/${PLAN}/vote`)).data;
    expect(following.status).toBe("voting");
    expect(following.result).toBeNull();
    expect(following.people.filter((p: any) => p.voted).map((p: any) => p.id)).toEqual(["ana"]);
    expect(following.reminder).toContain("Faltan bea, carlos, dani, eva y fer por votar Noviembre 2026");
    expect(following.reminder).toContain(`${SITE}/p/${PLAN}/votacion`);
    expect(following.announcement).toBeNull();

    // Closing early counts what's in and writes the announcement.
    const closed = (await json(`/api/plans/${PLAN}/close`, "POST")).data;
    expect(closed.result.winnerId).toBe("nap");
    expect(closed.reminder).toBeNull();
    expect(closed.announcement).toContain("nos vamos a Nápoles");
    expect((await json(`/api/plans/${PLAN}`)).data.plan).toMatchObject({ status: "closed", winnerDestinationId: "nap" });
    // The site's refusal comes through with its reason.
    expect(await json(`/api/plans/${PLAN}/close`, "POST")).toMatchObject({ status: 409, data: { error: "plan is closed" } });
  });

  it("issues, reissues and revokes invites", async () => {
    await json("/api/members", "PUT", FRIENDS);
    const first = (await json("/api/members/bea/invite", "POST")).data.url as string;
    const second = (await json("/api/members/bea/invite", "POST")).data.url as string;
    expect(second).not.toBe(first);
    const oldStatus = (await (await site.request(`/api/invites/${first.split("/i/")[1]}`)).json()) as any;
    expect(oldStatus.status).toBe("cancelled");
    await json("/api/members/bea/revoke", "POST");
    const bea = ((await json("/api/members")).data as any[]).find((p) => p.id === "bea");
    expect(bea.invite.status).toBe("cancelled");
    expect(bea.inviteUrl).toBeNull();
  });

  it("refuses to open a vote on stale verified prices", async () => {
    await call(`/api/plans/${PLAN}/generate`, "POST", {
      source: "claude",
      scope: { kind: "europe" },
      stops: "direct",
      estimateStays: false,
      suggestThings: false,
    });
    for (const id of ["lis", "nap"]) {
      await json(`/api/plans/${PLAN}/proposals/${id}/review`, "POST", { review: "approved" });
      await json(`/api/plans/${PLAN}/proposals/${id}/verify`, "POST");
    }
    await json("/api/members", "PUT", FRIENDS);
    clock = new Date(clock.getTime() + 73 * 3_600_000);
    const r = await json(`/api/plans/${PLAN}/open-vote`, "POST", { deadline: "2026-10-20T20:00:00Z" });
    expect(r.status).toBe(409);
    expect(r.data.stale).toHaveLength(2);
  });
});

describe("plans and settings", () => {
  it("creates draft plans with unique ids and newest first", async () => {
    const input = { name: "Semana Santa 2027", origin: "MAD", dateFrom: "2027-03-23", nights: 5, flexDays: 1, partySize: 6, maxPriceCents: 45000 };
    const a = await json("/api/plans", "POST", input);
    expect(a.status).toBe(201);
    expect(a.data).toMatchObject({ id: "semana-santa-2027", dateTo: "2027-03-28", status: "draft" });
    const b = await json("/api/plans", "POST", input);
    expect(b.data.id).toBe("semana-santa-2027-2");
    const list = (await json("/api/plans")).data as any[];
    expect(list.map((p) => p.id).slice(0, 2)).toEqual(["semana-santa-2027-2", "semana-santa-2027"]);
    // Any stay from 1 to 30 nights, as picked on the calendar.
    expect((await json("/api/plans", "POST", { ...input, nights: 0 })).status).toBe(400);
    expect((await json("/api/plans", "POST", { ...input, nights: 31 })).status).toBe(400);
    expect((await json("/api/plans", "POST", { ...input, name: "Puente", nights: 4 })).status).toBe(201);
  });

  it("passes group settings through to the site and reports status", async () => {
    const saved = await json("/api/settings", "PUT", { groupName: "Grupo 51", organiserName: "Eyman", defaultOrigin: "MAD" });
    expect(saved.data).toEqual({ groupName: "Grupo 51", organiserName: "Eyman", defaultOrigin: "MAD" });
    expect(await (await site.request("/api/site")).json()).toEqual({ groupName: "Grupo 51", organiserName: "Eyman" });
    const status = (await json("/api/status")).data;
    expect(status.site).toEqual({ url: SITE, reachable: true });
  });

  it("searches photos and counts a download only when a new one is kept", async () => {
    expect((await call("/api/photos")).status).toBe(400);
    const { data } = await json("/api/photos?q=Alfama");
    expect(data.photos).toHaveLength(1);
    expect(data.photos[0].alt).toBe("Alfama");

    await call(`/api/plans/${PLAN}/generate`, "POST", { source: "claude", scope: { kind: "europe" }, stops: "direct", estimateStays: true, suggestThings: true });
    const save = () => json(`/api/plans/${PLAN}/proposals/lis/editorial`, "PATCH", { photos: data.photos });
    expect((await save()).status).toBe(200);
    await save();
    expect(picked).toEqual(["https://images.unsplash.com/a"]);
    const { data: entry } = await json(`/api/plans/${PLAN}`);
    expect(entry.editorial.lis.photos[0].author).toBe("Rui");
  });
});
