// Research through the Anthropic API, for organisers with an API key instead
// of the `claude` command: web search on Anthropic's side, the answer
// constrained to the same schema the command uses.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { extractPrompt, extractSchemas } from "./extract.ts";
import { GuideOutput, guidePrompt } from "./guide.ts";
import { ResearchOutput, SYSTEM, buildPrompt, toResults } from "./research.ts";
import type { BackgroundAi, BackgroundTask, ResearchProvider } from "./types.ts";

export const MODEL = "claude-opus-5";

// A long search can pause server-side; resume it at most this many times.
const MAX_CONTINUATIONS = 5;


// Only what research needs from the client, so tests can pass a fake.
// Batches: for the background jobs of the panel at /admin.
export type MessagesClient = Pick<Anthropic["beta"]["messages"], "stream"> & Partial<Pick<Anthropic["beta"]["messages"], "batches">>;

export function anthropicProvider(client: MessagesClient = new Anthropic().beta.messages, model = MODEL): ResearchProvider {
  return {
    async extract(req, signal) {
      const message = await client
        .stream(
          {
            model,
            max_tokens: 4000,
            output_config: { format: zodOutputFormat(extractSchemas[req.kind]) },
            messages: [
              {
                role: "user",
                content: [
                  ...req.images.map((img) => ({ type: "image" as const, source: { type: "base64" as const, media_type: img.mediaType, data: img.data } })),
                  { type: "text" as const, text: extractPrompt(req) },
                ],
              },
            ],
          },
          { signal },
        )
        .finalMessage();
      if (message.stop_reason === "refusal") throw new Error("Claude no ha querido leer esta captura");
      const text = message.content
        .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");
      return JSON.parse(text);
    },
    async *research(req, signal) {
      const text = await searchAndAnswer(client, model, buildPrompt(req), zodOutputFormat(ResearchOutput), signal, "prueba con menos propuestas");
      yield* toResults(req, ResearchOutput.parse(JSON.parse(text)));
    },
    async guide(req, signal) {
      return JSON.parse(await searchAndAnswer(client, model, guidePrompt(req), zodOutputFormat(GuideOutput), signal, "vuelve a probar"));
    },
    ...(client.batches ? { background: batches(client.batches, model) } : {}),
  };
}

const CUSTOM_ID = "wanderlot";
// A job that paused and was resumed in a second batch carries this mark.
const RESUMED = "#resumed";

// The same search as a one-request Message Batch (ROADMAP 3.3): Anthropic
// runs it on its side and the panel at /admin checks on it with quick
// requests, since a Worker can't wait minutes. Batches don't take the
// refusal fallback, so a refusal fails the job.
function batches(api: NonNullable<MessagesClient["batches"]>, model: string): BackgroundAi {
  const prompt = (task: BackgroundTask) => (task.kind === "research" ? buildPrompt(task.req) : guidePrompt(task.req));
  const format = (task: BackgroundTask) => (task.kind === "research" ? zodOutputFormat(ResearchOutput) : zodOutputFormat(GuideOutput));
  const create = async (task: BackgroundTask, messages: Anthropic.Beta.BetaMessageParam[]) =>
    (
      await api.create({
        requests: [
          {
            custom_id: CUSTOM_ID,
            params: {
              model,
              max_tokens: 64000,
              system: SYSTEM,
              thinking: { type: "adaptive" },
              output_config: { effort: "high", format: format(task) },
              tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 12 }],
              messages,
            },
          },
        ],
      })
    ).id;
  return {
    start: (task) => create(task, [{ role: "user", content: prompt(task) }]),
    async check(jobId, task) {
      const resumed = jobId.endsWith(RESUMED);
      const id = resumed ? jobId.slice(0, -RESUMED.length) : jobId;
      if ((await api.retrieve(id)).processing_status !== "ended") return { state: "running" };
      for await (const r of await api.results(id)) {
        if (r.custom_id !== CUSTOM_ID) continue;
        if (r.result.type !== "succeeded") return { state: "failed", error: r.result.type === "expired" ? "La búsqueda caducó sin terminar; vuelve a probar" : r.result.type === "canceled" ? "Búsqueda cancelada" : "Claude no pudo hacer esta búsqueda" };
        const message = r.result.message;
        if (message.stop_reason === "refusal") return { state: "failed", error: "Claude no ha querido hacer esta búsqueda" };
        if (message.stop_reason === "max_tokens") return { state: "failed", error: "La respuesta de Claude se cortó; prueba con menos propuestas" };
        if (message.stop_reason === "pause_turn") {
          // Once: a second pause would need both turns sent back, and a
          // search that long should be made smaller.
          if (resumed) return { state: "failed", error: "La búsqueda tardó demasiado; prueba con menos propuestas" };
          const next = await create(task, [
            { role: "user", content: prompt(task) },
            { role: "assistant", content: message.content },
          ]);
          return { state: "running", id: `${next}${RESUMED}` };
        }
        const text = message.content
          .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
          .map((b) => b.text)
          .join("");
        try {
          return { state: "done", raw: JSON.parse(text) };
        } catch {
          return { state: "failed", error: "Claude respondió con datos que no se pueden leer" };
        }
      }
      return { state: "failed", error: "Claude no devolvió resultado" };
    },
    async cancel(jobId) {
      await api.cancel(jobId.replace(RESUMED, "")).catch(() => {});
    },
  };
}

// A web-search turn constrained to a schema: resumes paused turns, and turns
// the ways it can stop short into messages for the organiser.
async function searchAndAnswer(
  client: MessagesClient,
  model: string,
  prompt: string,
  format: ReturnType<typeof zodOutputFormat>,
  signal: AbortSignal | undefined,
  retryHint: string,
): Promise<string> {
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: prompt }];
  let message: Anthropic.Beta.BetaMessage | undefined;
  for (let turn = 0; turn <= MAX_CONTINUATIONS; turn++) {
    message = await client
      .stream(
        {
          model,
          max_tokens: 64000,
          system: SYSTEM,
          thinking: { type: "adaptive" },
          output_config: { effort: "high", format },
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
  if (message.stop_reason === "pause_turn") throw new Error(`La búsqueda tardó demasiado; ${retryHint}`);
  if (message.stop_reason === "max_tokens") throw new Error(`La respuesta de Claude se cortó; ${retryHint}`);
  return message.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}
