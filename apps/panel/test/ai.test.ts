// Other AIs (ROADMAP 3.3): OpenAI and OpenAI-compatible endpoints, choosing
// among the ones set up, and adding destinations by hand without any.
import { beforeEach, describe, expect, it } from "vitest";
import { Provenance, flightDetailsKnown, researchLabel, trustLabel, trustState } from "@wanderlot/core";
import { createPanel } from "../src/app.ts";
import { siteClient } from "../src/publish.ts";
import { PanelStore } from "../src/store.ts";
import { AiChoice, apiEntries, type AiEntry } from "../src/providers/ai.ts";
import { openaiProvider, parseJson } from "../src/providers/openai.ts";
import type { FlightProvider, ResearchProvider, SearchRequest } from "../src/providers/types.ts";
import { createApp } from "../../site/src/app.ts";
import { SqliteStore } from "../../site/src/sqlite.ts";

const REQ: SearchRequest = {
  planId: "noviembre",
  origin: "MAD",
  scope: { kind: "europe" },
  dateFrom: "2026-11-07",
  nights: 7,
  flexDays: 0,
  partySize: 6,
  maxPriceCents: null,
  stops: "direct",
  estimateStays: true,
  suggestThings: false,
  nearbyAirports: false,
  count: 1,
};

const leg = (from: string, to: string, day: string) => ({
  from,
  to,
  departAt: `${day}T07:20:00+01:00`,
  arriveAt: `${day}T09:40:00+00:00`,
  carrier: "TAP",
  flightNumber: "TP1017",
  stops: 0,
  priceCents: 6000,
});
const lisbon = (sources: { label: string; url: string }[]) => ({
  proposals: [
    {
      place: { city: "Lisboa", country: "Portugal", iata: "LIS" },
      category: "ciudad",
      outbound: leg("MAD", "LIS", "2026-11-07"),
      inbound: leg("LIS", "MAD", "2026-11-14"),
      stays: [],
      todo: [],
      see: [],
      sources,
      pros: ["Vuelo corto"],
      cons: [],
      weather: "17 °C",
      photoSubjects: ["Alfama"],
    },
  ],
});

// A streamed answer, as server-sent events.
const sse = (events: unknown[]) =>
  new Response(events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("") + "data: [DONE]\n\n", { headers: { "content-type": "text/event-stream" } });

type Sent = { url: string; body: any };

function fakeFetch(answer: (sent: Sent) => Response): { fetch: typeof fetch; sent: Sent[] } {
  const sent: Sent[] = [];
  return {
    sent,
    fetch: (async (url: string, init: RequestInit) => {
      const s = { url: String(url), body: JSON.parse(String(init.body)) };
      sent.push(s);
      return answer(s);
    }) as typeof fetch,
  };
}

async function all<T>(it: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const x of it) out.push(x);
  return out;
}

describe("OpenAI", () => {
  it("searches the web through the Responses API, relaying each search, and cites its sources", async () => {
    const answer = lisbon([{ label: "TAP", url: "https://www.flytap.com" }]);
    const f = fakeFetch(() =>
      sse([
        { type: "response.output_item.done", item: { type: "web_search_call", action: { type: "search", query: "vuelos Madrid Lisboa" } } },
        { type: "response.output_item.done", item: { type: "web_search_call", action: { type: "open_page", url: "https://www.flytap.com/es" } } },
        { type: "response.completed", response: { status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(answer) }] }] } },
      ]),
    );
    const ai = openaiProvider({ apiKey: "k", model: "gpt-5", api: "responses", name: "OpenAI", fetch: f.fetch });
    const steps: unknown[] = [];
    const [result] = await all(ai.research(REQ, undefined, (p) => steps.push(p)));

    expect(f.sent[0]!.url).toBe("https://api.openai.com/v1/responses");
    expect(f.sent[0]!.body).toMatchObject({ model: "gpt-5", stream: true, tools: [{ type: "web_search" }], text: { format: { type: "json_schema", strict: false } } });
    expect(steps).toEqual([
      { kind: "search", query: "vuelos Madrid Lisboa" },
      { kind: "read", host: "flytap.com", url: "https://www.flytap.com/es" },
    ]);
    expect(result!.proposal.provenance).toEqual({ kind: "claude", sources: answer.proposals[0]!.sources, by: "OpenAI" });
    expect(researchLabel(result!.proposal.provenance)).toBe("Lo escribió OpenAI");
  });

  it("reads screenshots as images, and says when the answer was cut short", async () => {
    const f = fakeFetch(() =>
      sse([{ type: "response.completed", response: { status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: '```json\n{"name":"Piso","description":null,"totalEuros":900,"nights":7}\n```' }] }] } }]),
    );
    const ai = openaiProvider({ apiKey: "k", model: "gpt-5", api: "responses", name: "OpenAI", fetch: f.fetch });
    const read = await ai.extract({
      kind: "stay",
      images: [{ mediaType: "image/png", data: "iVBOR" }],
      context: { origin: "MAD", city: "Lisboa", iata: "LIS", dateFrom: "2026-11-07", dateTo: "2026-11-14", nights: 7, partySize: 6 },
    });
    expect(read).toEqual({ name: "Piso", description: null, totalEuros: 900, nights: 7 });
    expect(f.sent[0]!.body.input[0].content[1]).toEqual({ type: "input_image", image_url: "data:image/png;base64,iVBOR" });
    expect(f.sent[0]!.body.tools).toBeUndefined();

    const cut = openaiProvider({
      apiKey: "k",
      model: "gpt-5",
      api: "responses",
      name: "OpenAI",
      fetch: fakeFetch(() => sse([{ type: "response.incomplete", response: { status: "incomplete", incomplete_details: { reason: "max_output_tokens" } } }])).fetch,
    });
    await expect(all(cut.research(REQ))).rejects.toThrow(/se cortó/);
  });

  it("names a bad key", async () => {
    const ai = openaiProvider({ apiKey: "mal", model: "gpt-5", api: "responses", name: "OpenAI", fetch: fakeFetch(() => Response.json({ error: { message: "Incorrect API key" } }, { status: 401 })).fetch });
    await expect(all(ai.research(REQ))).rejects.toThrow("OpenAI no acepta la clave");
  });
});

describe("an OpenAI-compatible endpoint", () => {
  it("answers without searching: estimates with no sources, even from endpoints that refuse a schema", async () => {
    const answer = lisbon([]);
    const text = JSON.stringify(answer);
    const f = fakeFetch((s) =>
      s.body.response_format
        ? Response.json({ error: { message: "response_format not supported" } }, { status: 400 })
        : sse([{ choices: [{ delta: { content: text.slice(0, 40) } }] }, { choices: [{ delta: { content: text.slice(40) }, finish_reason: "stop" }] }]),
    );
    const ai = openaiProvider({ apiKey: "k", model: "mistral-large", baseUrl: "https://api.mistral.ai/v1", api: "chat", name: "Mistral", fetch: f.fetch });
    const [result] = await all(ai.research(REQ));

    expect(f.sent.map((s) => s.url)).toEqual(["https://api.mistral.ai/v1/chat/completions", "https://api.mistral.ai/v1/chat/completions"]);
    expect(f.sent[1]!.body.messages[1].content).toMatch(/No puedes buscar en la web/);
    expect(f.sent[1]!.body.messages[1].content).toMatch(/Responde solo con un objeto JSON/);
    const prov = result!.proposal.provenance;
    expect(prov).toEqual({ kind: "claude", sources: [], by: "Mistral", estimate: true });
    expect(trustLabel(trustState(prov, new Date()))).toBe("Estimado por Mistral");
  });

  it("finds the JSON in a chatty answer", () => {
    expect(parseJson('Aquí tienes:\n{"a": {"b": 1}}\nEspero que sirva')).toEqual({ a: { b: 1 } });
    expect(() => parseJson("No sé")).toThrow(/no respondió con datos/);
  });
});

describe("choosing the AI", () => {
  const stub = (name: string): ResearchProvider => ({ who: { by: name }, extract: async () => ({}), research: async function* () {} });
  const entry = (id: AiEntry["option"]["id"], ready: boolean): AiEntry => ({
    option: { id, name: id, model: null, ready, setup: `configura ${id}`, search: true, images: true, background: false },
    make: () => stub(id),
  });

  it("uses the chosen one if it's set up, else the first that is, and keeps the choice", () => {
    const saved: string[] = [];
    const choice = new AiChoice([entry("claude-cli", false), entry("anthropic-api", true), entry("openai-api", true)], "claude-cli", (id) => saved.push(id));
    expect(choice.active?.option.id).toBe("anthropic-api");
    choice.choose("openai-api");
    expect(choice.provider()?.who?.by).toBe("openai-api");
    expect(saved).toEqual(["openai-api"]);
    expect(() => choice.choose("claude-cli")).toThrow(/no está configurada/);
    expect(new AiChoice([entry("openai-api", true)]).view()).toMatchObject({ active: "openai-api", canChoose: false });
  });

  it("builds the API ones from the environment, saying where each key goes", () => {
    const anthropic = () => stub("anthropic");
    const local = apiEntries({ OPENAI_API_KEY: "k", AI_BASE_URL: "https://openrouter.ai/api/v1", AI_API_KEY: "k2", AI_MODEL: "meta/llama" }, anthropic, "local");
    expect(local.map((e) => [e.option.id, e.option.ready, e.option.name, e.option.model])).toEqual([
      ["anthropic-api", false, "Claude (API de Anthropic)", null],
      ["openai-api", true, "OpenAI", "gpt-5"],
      ["compatible-api", true, "openrouter.ai", "meta/llama"],
    ]);
    expect(local[0]!.option.setup).toMatch(/\.env/);
    expect(local[2]!.make().who).toEqual({ by: "openrouter.ai", estimate: true });
    expect(apiEntries({}, anthropic, "site")[1]!.option.setup).toMatch(/wrangler secret put OPENAI_API_KEY/);
  });
});

describe("the panel with other AIs", () => {
  const ADMIN = "a".repeat(40);
  const ORIGIN = "https://wanderlot.test";
  let panel: ReturnType<typeof createPanel>;
  let saved: string[];

  const json = async (path: string, method = "GET", body?: unknown) => {
    const res = await panel.request(path, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: res.status, data: (await res.json()) as any };
  };

  beforeEach(async () => {
    const site = createApp({ store: new SqliteStore(), adminToken: ADMIN, rp: { name: "Wanderlot", origin: ORIGIN }, now: () => new Date("2026-10-10T12:00:00Z") });
    const estimates: ResearchProvider = {
      who: { by: "Mistral", estimate: true },
      extract: async () => ({}),
      async *research(req) {
        const { sources: _s, pros: _p, cons: _c, weather: _w, photoSubjects: _ph, ...p } = lisbon([]).proposals[0]!;
        yield { proposal: { ...p, category: "ciudad", id: "lis-1", planId: req.planId, provenance: { kind: "claude", sources: [], by: "Mistral", estimate: true } } };
      },
    };
    saved = [];
    panel = createPanel({
      store: new PanelStore(null),
      flights: {} as FlightProvider,
      ai: new AiChoice(
        [
          { option: { id: "claude-cli", name: "Claude (comando claude)", model: null, ready: false, setup: "Instala Claude Code", search: true, images: true, background: false }, make: () => estimates },
          { option: { id: "compatible-api", name: "Mistral", model: "mistral-large", ready: true, setup: "", search: false, images: true, background: false }, make: () => estimates },
        ],
        null,
        (id) => saved.push(id),
      ),
      site: siteClient(ORIGIN, ADMIN, async (input, init) => site.request(String(input), init)),
      siteUrl: ORIGIN,
      now: () => new Date("2026-10-10T12:00:00Z"),
    });
    await json("/api/plans/noviembre", "PUT", { name: "Noviembre", origin: "MAD", dateFrom: "2026-11-07", dateTo: "2026-11-14", nights: 7, flexDays: 0, partySize: 6, maxPriceCents: null, status: "draft" });
  });

  it("shows the AIs in Ajustes and says which is in use", async () => {
    const view = (await json("/api/ai")).data;
    expect(view).toMatchObject({ active: "compatible-api", canChoose: true });
    expect(view.options.map((o: any) => [o.id, o.ready])).toEqual([
      ["claude-cli", false],
      ["compatible-api", true],
    ]);
    expect((await json("/api/status")).data).toMatchObject({ research: "compatible-api", ai: { name: "Mistral", search: false, images: true } });
    expect((await json("/api/ai", "PUT", { id: "claude-cli" })).status).toBe(409);
    expect((await json("/api/ai", "PUT", { id: "compatible-api" })).status).toBe(200);
    expect(saved).toEqual(["compatible-api"]);
  });

  it("publishes estimates, labelled as such", async () => {
    await panel.request("/api/plans/noviembre/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ source: "claude", scope: { kind: "europe" }, stops: "direct", estimateStays: false, suggestThings: false }),
    });
    const id = (await json("/api/plans/noviembre")).data.proposals[0].id;
    await json(`/api/plans/noviembre/proposals/${id}/review`, "POST", { review: "approved" });
    // Unchecked: publishing asks first, then the site takes it without sources.
    expect((await json("/api/plans/noviembre/publish", "POST", {})).data.warnings).toEqual([{ destinationId: id, city: "Lisboa", reason: "unverified" }]);
    expect((await json("/api/plans/noviembre/publish", "POST", { confirm: true })).status).toBe(200);
  });

  it("adds a destination by hand, approved and checked, with its price but no made-up times", async () => {
    expect((await json("/api/plans/noviembre/proposals", "POST", { place: { city: "Oporto", country: "Portugal", iata: "opo" }, category: "ciudad", flightCents: 9000 })).status).toBe(400);
    const added = await json("/api/plans/noviembre/proposals", "POST", {
      place: { city: "Oporto", country: "Portugal", iata: "OPO" },
      category: "ciudad",
      flightCents: 9000,
      stayCents: 105000,
      stay: { name: "Piso en Ribeira", url: "https://www.airbnb.es/rooms/1" },
    });
    expect(added.status).toBe(201);
    const p = added.data;
    expect(p).toMatchObject({ id: "oporto", review: "approved", place: { iata: "OPO" }, outbound: { from: "MAD", to: "OPO" }, inbound: { from: "OPO", to: "MAD" } });
    expect(p.outbound.priceCents + p.inbound.priceCents).toBe(9000);
    expect(p.stays).toEqual([{ kind: "Alojamiento", name: "Piso en Ribeira", url: "https://www.airbnb.es/rooms/1", nightlyCents: 15000, recommended: true }]);
    expect(p.provenance).toEqual({ kind: "organiser", checkedAt: "2026-10-10T12:00:00.000Z", sources: [] });
    expect(flightDetailsKnown(p)).toBe(false);
    // A second one of the same city gets its own id; Comparativa gets a photo search.
    expect((await json("/api/plans/noviembre/proposals", "POST", { place: { city: "Oporto", country: "Portugal", iata: "OPO" }, category: "ciudad", flightCents: 9500 })).data.id).toBe("oporto-2");
    expect((await json("/api/plans/noviembre")).data.editorial.oporto).toEqual({ photoQueries: ["Oporto"] });

    // It publishes like any checked proposal: nothing to confirm.
    const published = await json("/api/plans/noviembre/publish", "POST", {});
    expect(published).toMatchObject({ status: 200, data: { published: 2, warnings: [] } });
  });
});

describe("the model", () => {
  it("lets research go without sources only as an estimate", () => {
    const base = { kind: "claude" as const, sources: [] };
    const check = (provenance: unknown) => Provenance.safeParse(provenance).success;
    expect(check(base)).toBe(false);
    expect(check({ ...base, estimate: true, by: "Mistral" })).toBe(true);
    expect(check({ kind: "claude", sources: [{ label: "x", url: "https://x.test" }] })).toBe(true);
  });
});

describe("Claude in the background", () => {
  // A stand-in for the Message Batches API: each batch ends with the next
  // queued answer.
  function fakeBatches(answers: { stop_reason: string; content: unknown[] }[]) {
    const created: any[] = [];
    let n = 0;
    let retrieved = 0;
    const api = {
      create: async (body: any) => {
        created.push(body);
        return { id: `batch_${++n}` };
      },
      // Still processing the first time it's asked about, ended after.
      retrieve: async () => ({ processing_status: retrieved++ === 0 ? "in_progress" : "ended" }),
      results: async (id: string) =>
        (async function* () {
          const a = answers[Number(id.split("_")[1]) - 1]!;
          yield { custom_id: "wanderlot", result: { type: "succeeded", message: a } };
        })(),
      cancel: async () => ({}),
    };
    return { api, created };
  }

  it("runs research as a batch, resumes a paused search once, and reads the answer", async () => {
    const { anthropicProvider } = await import("../src/providers/anthropic.ts");
    const answer = lisbon([{ label: "TAP", url: "https://www.flytap.com" }]);
    const { api, created } = fakeBatches([
      { stop_reason: "pause_turn", content: [{ type: "text", text: "Sigo buscando" }] },
      { stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(answer) }] },
    ]);
    const ai = anthropicProvider({ stream: (() => { throw new Error("unused"); }) as any, batches: api as any });
    const task = { kind: "research" as const, req: REQ };
    const id = await ai.background!.start(task);
    expect(created[0].requests[0].params).toMatchObject({ tools: [{ type: "web_search_20260209" }], output_config: { format: { type: "json_schema" } } });
    // No refusal fallback: the Batches API doesn't take it.
    expect(created[0].requests[0].params.fallbacks).toBeUndefined();
    expect(await ai.background!.check(id, task)).toEqual({ state: "running" });
    const resumed = await ai.background!.check(id, task);
    expect(resumed).toEqual({ state: "running", id: "batch_2#resumed" });
    expect(created[1].requests[0].params.messages.map((m: any) => m.role)).toEqual(["user", "assistant"]);
    expect(await ai.background!.check("batch_2#resumed", task)).toEqual({ state: "done", raw: answer });
  });

  it("fails the job on a refusal, or a second pause", async () => {
    const { anthropicProvider } = await import("../src/providers/anthropic.ts");
    const task = { kind: "research" as const, req: REQ };
    const refused = fakeBatches([{ stop_reason: "refusal", content: [] }]);
    await refused.api.retrieve();
    const a = anthropicProvider({ stream: (() => { throw new Error("unused"); }) as any, batches: refused.api as any });
    expect(await a.background!.check("batch_1", task)).toMatchObject({ state: "failed", error: /no ha querido/ });
    const paused = fakeBatches([{ stop_reason: "pause_turn", content: [] }, { stop_reason: "pause_turn", content: [] }]);
    await paused.api.retrieve();
    const b = anthropicProvider({ stream: (() => { throw new Error("unused"); }) as any, batches: paused.api as any });
    expect(await b.background!.check("batch_2#resumed", task)).toMatchObject({ state: "failed", error: /tardó demasiado/ });
  });
});
