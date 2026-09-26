import { describe, expect, it } from "vitest";
import { proposal } from "../../../packages/core/test/fixtures.ts";
import { anthropicProvider, type MessagesClient } from "../src/providers/anthropic.ts";
import type { SearchRequest } from "../src/providers/types.ts";

const req: SearchRequest = {
  planId: "noviembre-2026",
  origin: "MAD",
  scope: { kind: "europe" },
  dateFrom: "2026-11-12",
  nights: 5,
  flexDays: 1,
  partySize: 6,
  maxPriceCents: 42000,
  stops: "direct",
  estimateStays: true,
  suggestThings: true,
  nearbyAirports: false,
  count: 3,
};
const { id: _i, planId: _p, review: _r, provenance: _v, ...lisbon } = proposal("lis", "Lisboa", "LIS");
const answer = { proposals: [{ ...lisbon, sources: [{ label: "TAP", url: "https://www.flytap.com/" }], pros: ["Cerca"], cons: [], weather: "17 °C", photoSubjects: ["Belém"] }] };

// A stand-in for client.beta.messages that replays canned final messages.
function fake(replies: { stop_reason: string; text?: string }[]) {
  const calls: any[] = [];
  const client = {
    stream(params: any) {
      calls.push(structuredClone({ ...params, output_config: { ...params.output_config, format: undefined } }));
      const r = replies[calls.length - 1]!;
      return {
        finalMessage: async () => ({
          stop_reason: r.stop_reason,
          content: r.text === undefined ? [{ type: "server_tool_use", id: "s1", name: "web_search", input: {} }] : [{ type: "text", text: r.text }],
        }),
      };
    },
  } as unknown as MessagesClient;
  return { client, calls };
}

const collect = async (it: AsyncIterable<unknown>) => {
  const out = [];
  for await (const x of it) out.push(x);
  return out;
};

describe("anthropic research provider", () => {
  it("searches the web and parses the structured answer", async () => {
    const { client, calls } = fake([{ stop_reason: "end_turn", text: JSON.stringify(answer) }]);
    const out = (await collect(anthropicProvider(client).research(req))) as any[];
    expect(calls[0].model).toBe("claude-opus-5");
    expect(calls[0].tools[0]).toMatchObject({ type: "web_search_20260209", name: "web_search" });
    expect(calls[0].messages[0].content).toContain("MAD hacia Europa");
    expect(out[0].proposal.provenance.kind).toBe("claude");
    expect(out[0].notes.photoSubjects).toEqual(["Belém"]);
  });

  it("resumes a paused turn by sending it back", async () => {
    const { client, calls } = fake([{ stop_reason: "pause_turn" }, { stop_reason: "end_turn", text: JSON.stringify(answer) }]);
    const out = await collect(anthropicProvider(client).research(req));
    expect(out).toHaveLength(1);
    expect(calls).toHaveLength(2);
    expect(calls[1].messages.map((m: any) => m.role)).toEqual(["user", "assistant"]);
  });

  it("says so when Claude declines", async () => {
    const { client } = fake([{ stop_reason: "refusal", text: "" }]);
    await expect(collect(anthropicProvider(client).research(req))).rejects.toThrow(/no ha querido/);
  });
});
