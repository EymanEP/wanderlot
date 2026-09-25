import { describe, expect, it } from "vitest";
import { Proposal, Snapshot, euros, legDuration, tally } from "@wanderlot/core";
import { ballots, destinations, lateBallots, plan, proposals } from "../src/index.ts";

describe("mock dataset", () => {
  it("validates against the core schemas", () => {
    for (const p of proposals) Proposal.parse(p);
    const { status: _s, winnerDestinationId: _w, ...planFields } = plan;
    Snapshot.parse({ plan: planFields, destinations, publishedAt: "2026-09-24T18:30:00Z" });
  });

  it("has the design's twelve proposals and review counts", () => {
    expect(proposals).toHaveLength(12);
    const count = (r: string) => proposals.filter((p) => p.review === r).length;
    expect([count("approved"), count("discarded"), count("pending")]).toEqual([4, 2, 6]);
  });

  it("reproduces the design's totals per person", () => {
    const totals = Object.fromEntries(destinations.map((d) => [d.id, euros(d.totalPerPersonCents)]));
    expect(totals).toEqual({ lis: "412 €", nap: "388 €", rak: "356 €", bud: "402 €" });
    expect(legDuration(destinations.find((d) => d.id === "lis")!.outbound)).toBe("1 h 20 m");
  });

  it("has four ballots open and a Nápoles win once all six are in", () => {
    expect(ballots).toHaveLength(4);
    const options = destinations.map((d) => ({ id: d.id, totalPerPersonCents: d.totalPerPersonCents }));
    const result = tally(options, [...ballots, ...lateBallots].map((b) => b.ranking));
    expect(result.winnerId).toBe("nap");
    expect(result.rows.reduce((s, r) => s + r.points, 0)).toBe(36);
  });
});
