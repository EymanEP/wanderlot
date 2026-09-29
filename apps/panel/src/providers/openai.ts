// Research through OpenAI's API, with web search on OpenAI's side, or through
// any endpoint that speaks OpenAI's chat API (OpenRouter, a local model and
// the like), which can't search: what it finds is marked as an estimate
// (ROADMAP 3.3). Plain fetch and no SDK, so it also runs on the Worker.
import { z } from "zod";
import { extractPrompt, extractSchemas, type ExtractImage } from "./extract.ts";
import { GuideEstimate, GuideOutput, guidePrompt } from "./guide.ts";
import { EstimateOutput, ResearchOutput, SYSTEM, SYSTEM_ESTIMATE, buildPrompt, toResults, type Researcher } from "./research.ts";
import type { ResearchProgress, ResearchProvider } from "./types.ts";

export const OPENAI_URL = "https://api.openai.com/v1";

export interface OpenAiConfig {
  apiKey: string;
  model: string;
  // Without a trailing slash; OpenAI's own by default.
  baseUrl?: string;
  // "responses": OpenAI itself, which searches the web. "chat": any
  // OpenAI-compatible endpoint, answering from what the model knows.
  api: "responses" | "chat";
  // As friends see it on the site: "OpenAI", "Mistral".
  name: string;
  fetch?: typeof fetch;
}

interface Ask {
  prompt: string;
  schema: z.ZodType;
  images?: ExtractImage[];
  search?: boolean;
  signal?: AbortSignal | undefined;
  onProgress?: ((p: ResearchProgress) => void) | undefined;
}

export function openaiProvider(cfg: OpenAiConfig): ResearchProvider {
  const estimate = cfg.api === "chat";
  const who: Researcher = { by: cfg.name, ...(estimate ? { estimate: true } : {}) };
  const ask = async (a: Ask): Promise<unknown> => {
    const text = cfg.api === "responses" ? await responses(cfg, a) : await chat(cfg, a);
    return a.schema.parse(parseJson(text, cfg.name));
  };
  return {
    who,
    extract: (req, signal) => ask({ prompt: extractPrompt(req), schema: extractSchemas[req.kind], images: req.images, signal }),
    async *research(req, signal, onProgress) {
      const schema = estimate ? EstimateOutput : ResearchOutput;
      const out = (await ask({ prompt: buildPrompt(req, who), schema, search: !estimate, signal, onProgress })) as z.infer<typeof EstimateOutput>;
      yield* toResults(req, out, who);
    },
    guide: (req, signal, onProgress) => ask({ prompt: guidePrompt(req, estimate), schema: estimate ? GuideEstimate : GuideOutput, search: !estimate, signal, onProgress }),
  };
}

// The schema as OpenAI takes it: not strict, since strict mode wants every
// field required and research's schema has optional ones.
function jsonSchema(schema: z.ZodType) {
  const { $schema: _drop, ...rest } = z.toJSONSchema(schema, { target: "draft-7", io: "input" }) as Record<string, unknown>;
  return rest;
}

const dataUrl = (img: ExtractImage) => `data:${img.mediaType};base64,${img.data}`;

async function post(cfg: OpenAiConfig, path: string, body: unknown, signal?: AbortSignal): Promise<Response> {
  const res = await (cfg.fetch ?? fetch)(`${cfg.baseUrl ?? OPENAI_URL}${path}`, {
    method: "POST",
    headers: { authorization: `Bearer ${cfg.apiKey}`, "content-type": "application/json" },
    body: JSON.stringify(body),
    ...(signal ? { signal } : {}),
  });
  if (res.ok) return res;
  const detail = ((await res.json().catch(() => null)) as { error?: { message?: string } } | null)?.error?.message ?? res.statusText;
  if (res.status === 401) throw new Error(`${cfg.name} no acepta la clave: revísala en .env`);
  throw new HttpError(res.status, `${cfg.name} respondió ${res.status}: ${detail}`);
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

// OpenAI's Responses API, streamed so Generar sees each search as it happens
// and a long search doesn't sit on one silent connection.
async function responses(cfg: OpenAiConfig, a: Ask): Promise<string> {
  const content = [{ type: "input_text", text: a.prompt }, ...(a.images ?? []).map((img) => ({ type: "input_image", image_url: dataUrl(img) }))];
  const res = await post(
    cfg,
    "/responses",
    {
      model: cfg.model,
      instructions: SYSTEM,
      input: [{ role: "user", content }],
      ...(a.search ? { tools: [{ type: "web_search" }] } : {}),
      text: { format: { type: "json_schema", name: "respuesta", schema: jsonSchema(a.schema), strict: false } },
      stream: true,
    },
    a.signal,
  );
  type Item = { type: string; action?: { type?: string; query?: string; url?: string }; content?: { type: string; text?: string }[] };
  type Final = { status?: string; output?: Item[]; incomplete_details?: { reason?: string }; error?: { message?: string } };
  let final: Final | undefined;
  for await (const e of events(res)) {
    const event = e as { type?: string; item?: Item; response?: Final; message?: string };
    if (event.type === "response.output_item.done" && event.item?.type === "web_search_call") {
      const action = event.item.action;
      if (action?.type === "search" && action.query) a.onProgress?.({ kind: "search", query: action.query });
      if (action?.type === "open_page" && action.url) {
        try {
          a.onProgress?.({ kind: "read", host: new URL(action.url).hostname.replace(/^www\./, ""), url: action.url });
        } catch {}
      }
    } else if (event.type === "response.completed" || event.type === "response.incomplete" || event.type === "response.failed") {
      final = event.response;
    } else if (event.type === "error") {
      throw new Error(`${cfg.name} falló: ${event.message ?? "error"}`);
    }
  }
  if (!final) throw new Error(`${cfg.name} no terminó de responder`);
  if (final.status === "failed") throw new Error(`${cfg.name} falló: ${final.error?.message ?? "error"}`);
  if (final.status === "incomplete") throw new Error(`La respuesta de ${cfg.name} se cortó (${final.incomplete_details?.reason ?? "incompleta"}); prueba con menos propuestas`);
  return (final.output ?? [])
    .filter((i) => i.type === "message")
    .flatMap((i) => i.content ?? [])
    .filter((c) => c.type === "output_text")
    .map((c) => c.text ?? "")
    .join("");
}

// Chat completions, as every OpenAI-compatible endpoint has them. The schema
// also goes in the prompt, for endpoints that ignore response_format.
async function chat(cfg: OpenAiConfig, a: Ask): Promise<string> {
  const schema = jsonSchema(a.schema);
  const text = `${a.prompt}\n\nResponde solo con un objeto JSON que cumpla este esquema, sin nada más:\n${JSON.stringify(schema)}`;
  const body = {
    model: cfg.model,
    stream: true,
    messages: [
      { role: "system", content: SYSTEM_ESTIMATE },
      { role: "user", content: a.images?.length ? [{ type: "text", text }, ...a.images.map((img) => ({ type: "image_url", image_url: { url: dataUrl(img) } }))] : text },
    ],
  };
  let res: Response;
  try {
    res = await post(cfg, "/chat/completions", { ...body, response_format: { type: "json_schema", json_schema: { name: "respuesta", schema, strict: false } } }, a.signal);
  } catch (e) {
    // Some endpoints don't take a schema: ask again without it.
    if (!(e instanceof HttpError) || e.status !== 400) throw e;
    res = await post(cfg, "/chat/completions", body, a.signal);
  }
  a.onProgress?.({ kind: "note", text: `${cfg.name} está escribiendo la respuesta` });
  let out = "";
  let finish: string | null = null;
  for await (const e of events(res)) {
    const choice = (e as { choices?: { delta?: { content?: string | null }; finish_reason?: string | null }[] }).choices?.[0];
    out += choice?.delta?.content ?? "";
    finish = choice?.finish_reason ?? finish;
  }
  if (finish === "length") throw new Error(`La respuesta de ${cfg.name} se cortó; prueba con menos propuestas`);
  return out;
}

// Server-sent events → their JSON payloads.
async function* events(res: Response): AsyncIterable<unknown> {
  if (!res.body) return;
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (value) buf += value.replace(/\r/g, "");
    // The last event may end without a blank line.
    if (done) buf += "\n\n";
    let end: number;
    while ((end = buf.indexOf("\n\n")) >= 0) {
      const block = buf.slice(0, end);
      buf = buf.slice(end + 2);
      const data = block
        .split("\n")
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trimStart())
        .join("\n");
      if (!data || data === "[DONE]") continue;
      try {
        yield JSON.parse(data);
      } catch {}
    }
    if (done) return;
  }
}

// The JSON in a model's answer, even wrapped in a code fence or a sentence.
export function parseJson(text: string, name = "La IA"): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error(`${name} no respondió con datos`);
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new Error(`${name} respondió con datos que no se pueden leer`);
  }
}
