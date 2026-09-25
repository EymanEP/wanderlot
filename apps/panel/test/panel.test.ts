import { beforeEach, describe, expect, it } from "vitest";
import type { Proposal } from "@wanderlot/core";
import { createPanel } from "../src/app.ts";
import { siteClient } from "../src/publish.ts";
import { PanelStore } from "../src/store.ts";
import type { FlightProvider, ResearchProvider } from "../src/providers/types.ts";
import { createApp } from "../../site/src/app.ts";
import { SiteDb } from "../../site/src/db.ts";
import { proposal } from "../../../packages/core/test/fixtures.ts";

const ADMIN = "t".repeat(40);
const SITE = "https://wanderlot.test";
const PLAN = "noviembre-2026";
const FRIENDS = ["ana", "bea", "carlos", "dani", "eva", "fer"].map((id) => ({ id, name: id }));

const strip = ({ review: _r, ...p }: Proposal) => p;
const claudeSources = { kind: "claude" as const, sources: [{ label: "x", url: "https://x.test" }] };

let clock: Date;
let panel: ReturnType<typeof createPanel>;
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
  site = createApp({ db: new SiteDb(), adminToken: ADMIN, now: () => clock });

  const research: ResearchProvider = {
    async *research() {
      yield strip(proposal("lis", "Lisboa", "LIS", { provenance: claudeSources }));
      yield strip(proposal("nap", "Nápoles", "NAP", { provenance: claudeSources }));
      yield strip(proposal("edi", "Edimburgo", "EDI", { provenance: claudeSources }));
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

  panel = createPanel({
    store: new PanelStore(null),
    flights,
    research,
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

    // Links first, then the vote.
    expect((await json(`/api/plans/${PLAN}/open-vote`, "POST", { deadline: "2026-10-20T20:00:00Z" })).status).toBe(409);
    await json("/api/members/links", "POST", FRIENDS);
    const opened = await json(`/api/plans/${PLAN}/open-vote`, "POST", { deadline: "2026-10-20T20:00:00Z" });
    expect(opened.status).toBe(200);
    expect(opened.data.message).toContain("Abierta la votación de Noviembre 2026");
    const anaLink = (opened.data.message as string).split("\n").find((l) => l.startsWith("• ana:"))!.slice(7);

    // The site now shows exactly the approved pair, and Ana's link works.
    const visit = await site.request(anaLink.replace(SITE, ""));
    const cookie = visit.headers.get("set-cookie")!.split(";")[0]!;
    const view = (await (await site.request(`/api/plans/${PLAN}`, { headers: { cookie } })).json()) as any;
    expect(view.plan.status).toBe("voting");
    expect(view.destinations.map((d: any) => d.id)).toEqual(["lis", "nap"]);
    expect(view.destinations[0].totalPerPersonCents).toBe(10000 + 23800);
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
    await json("/api/members/links", "POST", FRIENDS);
    clock = new Date(clock.getTime() + 73 * 3_600_000);
    const r = await json(`/api/plans/${PLAN}/open-vote`, "POST", { deadline: "2026-10-20T20:00:00Z" });
    expect(r.status).toBe(409);
    expect(r.data.stale).toHaveLength(2);
  });
});
