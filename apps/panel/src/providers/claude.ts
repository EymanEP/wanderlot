// Research through the local `claude` binary, run headless with a JSON schema
// so every proposal comes back structured and with its sources. It streams
// its steps (stream-json), so Generar can show each search as it happens.
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { extractJsonSchema, extractPrompt } from "./extract.ts";
import { ResearchOutput, buildPrompt, outputSchema, toResults } from "./research.ts";
import type { ResearchProgress, ResearchProvider } from "./types.ts";

export { buildPrompt, outputSchema };

export const RESEARCH_TOOLS = "WebSearch,WebFetch";

// Runs `claude` with these arguments, handing each line of its output over as
// it arrives. Tests pass a fake.
export type Runner = (args: string[], onLine: (line: string) => void, signal?: AbortSignal) => Promise<void>;

const runClaude: Runner = (args, onLine, signal) =>
  new Promise((resolve, reject) => {
    const child = spawn(process.env.CLAUDE_BIN ?? "claude", args, { signal, stdio: ["ignore", "pipe", "pipe"] });
    let err = "";
    createInterface({ input: child.stdout }).on("line", onLine);
    child.stderr.on("data", (d) => (err += d));
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`claude salió con ${code}: ${err.trim()}`))));
  });

type Block = { type: string; text?: string; name?: string; input?: Record<string, unknown> };
type Event = {
  type?: string;
  subtype?: string;
  message?: { content?: Block[] };
  structured_output?: unknown;
  result?: unknown;
  is_error?: boolean;
};

// One line of stream-json → what the organiser sees happening, if anything.
export function progressOf(event: Event): ResearchProgress[] {
  if (event.type !== "assistant") return [];
  return (event.message?.content ?? []).flatMap((b): ResearchProgress[] => {
    if (b.type === "text" && b.text?.trim()) return [{ kind: "note", text: b.text.trim().split("\n")[0]!.slice(0, 200) }];
    if (b.type !== "tool_use") return [];
    if (b.name === "WebSearch" && typeof b.input?.query === "string") return [{ kind: "search", query: b.input.query }];
    if (b.name === "WebFetch" && typeof b.input?.url === "string") {
      try {
        return [{ kind: "read", host: new URL(b.input.url).hostname.replace(/^www\./, ""), url: b.input.url }];
      } catch {
        return [];
      }
    }
    return [];
  });
}

// Runs `claude` and returns its structured answer, relaying its steps.
async function answer(run: Runner, args: string[], signal?: AbortSignal, onProgress?: (p: ResearchProgress) => void): Promise<unknown> {
  let result: Event | undefined;
  await run(
    args,
    (line) => {
      let event: Event;
      try {
        event = JSON.parse(line) as Event;
      } catch {
        return;
      }
      if (event.type === "result") result = event;
      else for (const p of progressOf(event)) onProgress?.(p);
    },
    signal,
  );
  if (!result) throw new Error("claude terminó sin dar resultado");
  if (result.is_error) throw new Error(`claude no pudo terminar: ${String(result.result ?? result.subtype ?? "error")}`);
  return result.structured_output ?? (typeof result.result === "string" ? JSON.parse(result.result) : result.result);
}

const EXT = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" } as const;

export function claudeProvider(run: Runner = runClaude): ResearchProvider {
  return {
    async extract(req, signal) {
      // The screenshots go in a folder of their own, the only place this run
      // may read from.
      const dir = await mkdtemp(join(tmpdir(), "wanderlot-captura-"));
      try {
        const files = await Promise.all(
          req.images.map(async (img, i) => {
            const file = join(dir, `captura-${i + 1}.${EXT[img.mediaType]}`);
            await writeFile(file, Buffer.from(img.data, "base64"));
            return file;
          }),
        );
        return await answer(
          run,
          [
            "-p",
            extractPrompt(req, files),
            "--output-format",
            "stream-json",
            "--verbose",
            "--json-schema",
            JSON.stringify(extractJsonSchema(req.kind)),
            "--tools",
            "Read",
            "--allowedTools",
            "Read",
            "--add-dir",
            dir,
          ],
          signal,
        );
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    },
    async *research(req, signal, onProgress) {
      const payload = await answer(
        run,
        [
          "-p",
          buildPrompt(req),
          "--output-format",
          "stream-json",
          "--verbose",
          "--json-schema",
          JSON.stringify(outputSchema),
          // Headless runs can't ask permission, so research gets exactly these
          // two tools, pre-approved, and nothing else: no shell, no files.
          "--tools",
          RESEARCH_TOOLS,
          "--allowedTools",
          RESEARCH_TOOLS,
        ],
        signal,
        onProgress,
      );
      yield* toResults(req, ResearchOutput.parse(payload));
    },
  };
}
