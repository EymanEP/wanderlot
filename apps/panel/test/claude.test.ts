import { describe, expect, it } from "vitest";
import { buildPrompt, claudeProvider, outputSchema } from "../src/providers/claude.ts";
import type { SearchRequest } from "../src/providers/types.ts";
import { proposal } from "../../../packages/core/test/fixtures.ts";

const req: SearchRequest = {
  planId: "noviembre-2026",
  origin: "MAD",
  scope: { kind: "europe" },
  dateFrom: "2026-11-07",
  nights: 7,
  flexDays: 1,
  partySize: 6,
  maxPriceCents: 42000,
  stops: "direct",
  estimateStays: true,
  suggestThings: true,
  count: 12,
};

const { id: _i, planId: _p, review: _r, provenance: _v, ...lisbon } = proposal("lis", "Lisboa", "LIS");
const sources = [{ label: "TAP · horarios", url: "https://www.flytap.com/es-es" }];

describe("claude research provider", () => {
  it("asks for structured output and always yields claude provenance", async () => {
    let args: string[] = [];
    const provider = claudeProvider(async (a) => {
      args = a;
      return JSON.stringify({ structured_output: { proposals: [{ ...lisbon, sources }] } });
    });
    const out = [];
    for await (const p of provider.research(req)) out.push(p);

    expect(args).toContain("--json-schema");
    expect(args[args.indexOf("--json-schema") + 1]).toBe(JSON.stringify(outputSchema));
    expect(out).toHaveLength(1);
    expect(out[0]!.proposal.provenance).toEqual({ kind: "claude", sources });
    expect(out[0]!.proposal.id).toBe("lis-1");
    // Older answers without notes still parse.
    expect(out[0]!.notes).toEqual({ pros: [], cons: [], weather: "", photoSubjects: [] });
  });

  it("passes Comparativa notes and photo subjects through", async () => {
    const notes = { pros: ["Vuelo corto"], cons: ["Llueve"], weather: "17 °C · lluvioso", photoSubjects: ["Alfama Lisboa"] };
    const provider = claudeProvider(async () => JSON.stringify({ structured_output: { proposals: [{ ...lisbon, sources, ...notes }] } }));
    const out = [];
    for await (const p of provider.research(req)) out.push(p);
    expect(out[0]!.notes).toEqual(notes);
    expect(out[0]!.proposal).not.toHaveProperty("pros");
  });

  it("rejects proposals without sources", async () => {
    const provider = claudeProvider(async () => JSON.stringify({ structured_output: { proposals: [{ ...lisbon, sources: [] }] } }));
    await expect(async () => {
      for await (const _ of provider.research(req)) void _;
    }).rejects.toThrow();
  });

  it("builds a Spanish prompt from the search", () => {
    const prompt = buildPrompt(req);
    expect(prompt).toContain("MAD hacia Europa");
    expect(prompt).toContain("solo vuelos directos");
    expect(prompt).toContain("420 €");
  });
});
