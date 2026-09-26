// Research through the Anthropic API, for organisers with an API key instead
// of the `claude` command: web search on Anthropic's side, the answer
// constrained to the same schema the command uses.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { ResearchOutput, buildPrompt, toResults } from "./research.ts";
import type { ResearchProvider } from "./types.ts";

export const MODEL = "claude-opus-5";

// A long search can pause server-side; resume it at most this many times.
const MAX_CONTINUATIONS = 5;

const SYSTEM =
  "Planificas viajes para un grupo de amigos. Buscas en la web vuelos, alojamientos y precios reales y citas las páginas de donde salen. " +
  "Respondes en español de España.";

// Only what research needs from the client, so tests can pass a fake.
export type MessagesClient = Pick<Anthropic["beta"]["messages"], "stream">;

export function anthropicProvider(client: MessagesClient = new Anthropic().beta.messages, model = MODEL): ResearchProvider {
  return {
    async *research(req, signal) {
      const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: buildPrompt(req) }];
      let message: Anthropic.Beta.BetaMessage | undefined;
      for (let turn = 0; turn <= MAX_CONTINUATIONS; turn++) {
        message = await client
          .stream(
            {
              model,
              max_tokens: 64000,
              system: SYSTEM,
              thinking: { type: "adaptive" },
              output_config: { effort: "high", format: zodOutputFormat(ResearchOutput) },
              tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 12 }],
              // If a safety classifier declines, retry on the model it picks.
              betas: ["server-side-fallback-2026-07-01"],
              fallbacks: "default",
              messages,
            },
            { signal },
          )
          .finalMessage();
        if (message.stop_reason !== "pause_turn") break;
        // Hand the paused turn back; the server carries on from there.
        messages.push({ role: "assistant", content: message.content });
      }
      if (!message) throw new Error("Claude no respondió");
      if (message.stop_reason === "refusal") throw new Error("Claude no ha querido hacer esta búsqueda");
      if (message.stop_reason === "pause_turn") throw new Error("La búsqueda tardó demasiado; prueba con menos propuestas");
      if (message.stop_reason === "max_tokens") throw new Error("La respuesta de Claude se cortó; prueba con menos propuestas");
      const text = message.content
        .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");
      yield* toResults(req, ResearchOutput.parse(JSON.parse(text)));
    },
  };
}
