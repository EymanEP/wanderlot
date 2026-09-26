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
  nearbyAirports: false,
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
    // Web search and fetch only, pre-approved: without this, headless runs are
    // denied every search and come back with no proposals.
    expect(args[args.indexOf("--tools") + 1]).toBe("WebSearch,WebFetch");
    expect(args[args.indexOf("--allowedTools") + 1]).toBe("WebSearch,WebFetch");
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
    expect(prompt).toContain("Sal siempre de MAD");
  });

  it("asks for no price cap, or nearby airports, when chosen", () => {
    const prompt = buildPrompt({ ...req, maxPriceCents: null, nearbyAirports: true });
    expect(prompt).toContain("Sin tope de precio");
    expect(prompt).not.toContain("€ por persona en total");
    expect(prompt).toContain("otro aeropuerto a unas 2 horas de MAD");
  });
});

describe("the schema handed to `claude --json-schema`", () => {
  it("is draft-07, which the command's validator accepts", async () => {
    const { Ajv } = await import("ajv");
    expect(outputSchema.$schema).toBe("http://json-schema.org/draft-07/schema#");
    // Ajv's default meta-schema is draft-07, like the CLI's; 2020-12 fails here
    // with the same "no schema with key or ref" error the organiser saw.
    const validate = new Ajv({ strict: false }).compile(outputSchema);
    expect(validate({ proposals: [] })).toBe(true);
    expect(validate({ proposals: [{ place: {} }] })).toBe(false);
  });
});
