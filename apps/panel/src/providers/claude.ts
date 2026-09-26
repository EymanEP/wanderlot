// Research through the local `claude` binary, run headless with a JSON schema
// so every proposal comes back structured and with its sources.
import { spawn } from "node:child_process";
import { ResearchOutput, buildPrompt, outputSchema, toResults } from "./research.ts";
import type { ResearchProvider } from "./types.ts";

export { buildPrompt, outputSchema };

export type Runner = (args: string[], signal?: AbortSignal) => Promise<string>;

const runClaude: Runner = (args, signal) =>
  new Promise((resolve, reject) => {
    const child = spawn(process.env.CLAUDE_BIN ?? "claude", args, { signal, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error(`claude salió con ${code}: ${err.trim()}`))));
  });

export function claudeProvider(run: Runner = runClaude): ResearchProvider {
  return {
    async *research(req, signal) {
      const raw = await run(
        ["-p", buildPrompt(req), "--output-format", "json", "--json-schema", JSON.stringify(outputSchema)],
        signal,
      );
      const envelope = JSON.parse(raw) as { structured_output?: unknown; result?: unknown };
      const payload = envelope.structured_output ?? (typeof envelope.result === "string" ? JSON.parse(envelope.result) : envelope.result);
      yield* toResults(req, ResearchOutput.parse(payload));
    },
  };
}
