import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { ResearchProgress } from "../src/providers/types.ts";
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

// The last line of `claude --output-format stream-json`.
const resultLine = (structured_output: unknown) => JSON.stringify({ type: "result", subtype: "success", is_error: false, structured_output });

describe("claude reading screenshots", () => {
  it("hands claude the files in a folder of their own, read-only, and cleans up", async () => {
    let args: string[] = [];
    let seen: string[] = [];
    const provider = claudeProvider(async (a, onLine) => {
      args = a;
      const dir = a[a.indexOf("--add-dir") + 1]!;
      seen = readdirSync(dir).map((f) => `${f}:${readFileSync(join(dir, f), "utf8")}`);
      onLine(resultLine({ name: "Piso en Alfama", description: null, totalEuros: 900, nights: 7 }));
    });
    const got = await provider.extract({
      kind: "stay",
      images: [
        { mediaType: "image/png", data: Buffer.from("uno").toString("base64") },
        { mediaType: "image/jpeg", data: Buffer.from("dos").toString("base64") },
      ],
      context: { origin: "MAD", city: "Lisboa", iata: "LIS", dateFrom: "2026-11-07", dateTo: "2026-11-14", nights: 7, partySize: 6 },
    });
    expect(got).toEqual({ name: "Piso en Alfama", description: null, totalEuros: 900, nights: 7 });
    expect(seen).toEqual(["captura-1.png:uno", "captura-2.jpg:dos"]);
    // Only Read, only there: no web, no shell, nothing else on disk.
    expect(args[args.indexOf("--tools") + 1]).toBe("Read");
    expect(args[args.indexOf("--allowedTools") + 1]).toBe("Read");
    const dir = args[args.indexOf("--add-dir") + 1]!;
    expect(args[1]).toContain(join(dir, "captura-1.png"));
    expect(args[1]).toContain("6 personas, de MAD a Lisboa (LIS)");
    expect(JSON.parse(args[args.indexOf("--json-schema") + 1]!).$schema).toBe("http://json-schema.org/draft-07/schema#");
    expect(existsSync(dir)).toBe(false);
  });
});

describe("claude research provider", () => {
  it("reports each step of a real recorded run, then its proposals", async () => {
    const recorded = readFileSync(new URL("./fixtures/claude-stream.ndjson", import.meta.url), "utf8").trim().split("\n");
    const provider = claudeProvider(async (_a, onLine) => recorded.forEach(onLine));
    const steps: ResearchProgress[] = [];
    const out = [];
    for await (const p of provider.research(req, undefined, (s) => steps.push(s))) out.push(p);
    expect(steps[0]).toMatchObject({ kind: "note" });
    expect(steps.filter((s) => s.kind === "search").length).toBeGreaterThan(3);
    expect(steps.find((s) => s.kind === "read")).toMatchObject({ host: "google.com" });
    expect(out.map((r) => r.proposal.place.city)).toEqual(["Lisboa"]);
  });

  it("fails with what went wrong when claude gives up or says nothing", async () => {
    const empty = claudeProvider(async () => {});
    await expect(async () => {
      for await (const _ of empty.research(req)) void _;
    }).rejects.toThrow(/sin dar resultado/);
    const failed = claudeProvider(async (_a, onLine) => onLine(JSON.stringify({ type: "result", subtype: "error_max_turns", is_error: true })));
    await expect(async () => {
      for await (const _ of failed.research(req)) void _;
    }).rejects.toThrow(/no pudo terminar/);
  });

  it("asks for structured output and always yields claude provenance", async () => {
    let args: string[] = [];
    const provider = claudeProvider(async (a, onLine) => {
      args = a;
      onLine(resultLine({ proposals: [{ ...lisbon, sources }] }));
    });
    const out = [];
    for await (const p of provider.research(req)) out.push(p);

    expect(args).toContain("--json-schema");
    expect(args[args.indexOf("--output-format") + 1]).toBe("stream-json");
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
    const provider = claudeProvider(async (_a, onLine) => onLine(resultLine({ proposals: [{ ...lisbon, sources, ...notes }] })));
    const out = [];
    for await (const p of provider.research(req)) out.push(p);
    expect(out[0]!.notes).toEqual(notes);
    expect(out[0]!.proposal).not.toHaveProperty("pros");
  });

  it("rejects proposals without sources", async () => {
    const provider = claudeProvider(async (_a, onLine) => onLine(resultLine({ proposals: [{ ...lisbon, sources: [] }] })));
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

  it("researches one place the organiser typed, without calling it anyone's idea", () => {
    const typed = buildPrompt({ ...req, scope: { kind: "named", name: "Oporto" }, count: 1 });
    expect(typed).toContain("Busca una propuesta de viaje de grupo saliendo de MAD hacia «Oporto».");
    expect(typed).not.toContain("Es una idea de");
    const idea = buildPrompt({ ...req, scope: { kind: "named", name: "Azores", by: "Iván", note: "ballenas" }, count: 1 });
    expect(idea).toContain("Es una idea de Iván, que dice: «ballenas».");
  });

  it("asks for no price cap, or nearby airports, when chosen", () => {
    const prompt = buildPrompt({ ...req, maxPriceCents: null, nearbyAirports: true });
    expect(prompt).toContain("Sin tope de precio");
    expect(prompt).not.toContain("€ por persona en total");
    expect(prompt).toContain("otro aeropuerto a unas 2 horas de MAD");
  });

  it("names what's already proposed so a new search looks elsewhere", () => {
    expect(buildPrompt(req)).not.toContain("Ya tenemos");
    expect(buildPrompt({ ...req, exclude: ["Lisboa (LIS)", "Oporto (OPO)"] })).toContain("Ya tenemos propuestas para: Lisboa (LIS), Oporto (OPO)");
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
