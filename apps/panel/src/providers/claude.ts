// Research through the local `claude` binary, run headless with a JSON schema
// so every proposal comes back structured and with its sources.
import { spawn } from "node:child_process";
import { z } from "zod";
import { Category, FlightLeg, Place, Source, Stay, Thing, type Proposal } from "@wanderlot/core";
import type { ResearchProvider, SearchRequest } from "./types.ts";

const ClaudeProposal = z.object({
  place: Place,
  category: Category,
  outbound: FlightLeg,
  inbound: FlightLeg,
  stays: z.array(Stay).max(2),
  todo: z.array(Thing),
  see: z.array(Thing),
  sources: z.array(Source).min(1),
});
const ClaudeOutput = z.object({ proposals: z.array(ClaudeProposal) });

export const outputSchema = z.toJSONSchema(ClaudeOutput);

export function buildPrompt(req: SearchRequest): string {
  const scope =
    req.scope.kind === "anywhere" ? "cualquier destino" : req.scope.kind === "europe" ? "Europa" : `el aeropuerto ${req.scope.iata}`;
  const stops = { direct: "solo vuelos directos", one: "máximo 1 escala", any: "escalas indiferentes" }[req.stops];
  return [
    `Busca ${req.count} propuestas de viaje de grupo saliendo de ${req.origin} hacia ${scope}.`,
    `Salida el ${req.dateFrom} (±${req.flexDays} días), ${req.nights} noches, ${req.partySize} personas.`,
    `Tope de ${(req.maxPriceCents / 100).toFixed(0)} € por persona en total. ${stops}.`,
    req.estimateStays ? "Estima dos opciones de alojamiento para todo el grupo (precio por noche, grupo entero) y marca una como recomendada." : "No incluyas alojamiento (stays vacío).",
    req.suggestThings ? "Añade cosas concretas que hacer y que ver, cada una con un título y un detalle práctico (no un itinerario por días)." : "Deja todo y see vacíos.",
    "Clasifica cada destino como ciudad, escapada, playa o naturaleza. Todos los precios en céntimos de euro, por persona para los vuelos. Fechas ISO 8601 con zona horaria.",
    "Cada propuesta debe citar las páginas de donde salen los números en sources. No inventes vuelos: si no encuentras uno real, omite la propuesta.",
  ].join("\n");
}

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
      const { proposals } = ClaudeOutput.parse(payload);
      for (const [i, p] of proposals.entries()) {
        const { sources, ...rest } = p;
        const proposal: Omit<Proposal, "review"> = {
          ...rest,
          id: `${p.place.iata.toLowerCase()}-${i + 1}`,
          planId: req.planId,
          provenance: { kind: "claude", sources },
        };
        yield proposal;
      }
    },
  };
}
