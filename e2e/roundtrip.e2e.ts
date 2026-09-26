// The whole product in a real browser: the organiser uses the panel UI on its
// server to create a plan, name the group, add a friend, research (with a
// stand-in for the `claude` command), approve, publish and open the vote;
// the friend then accepts the invite with a passkey and sees the plan on the
// site UI. Run: npm run test:e2e (builds both UIs first).
import { spawn, type ChildProcess } from "node:child_process";
import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { strict as assert } from "node:assert";
import { chromium } from "playwright";
import { proposals } from "../packages/mocks/src/index.ts";

const SITE_PORT = 8931;
const PANEL_PORT = 5191;
const SITE = `http://localhost:${SITE_PORT}`;
const PANEL = `http://127.0.0.1:${PANEL_PORT}`;
const ADMIN = "roundtrip-".padEnd(40, "x");
const dir = mkdtempSync(join(tmpdir(), "wanderlot-e2e-"));

// A stand-in for `claude -p … --output-format stream-json`: a couple of research
// steps, then three canned proposals in the shape the real command returns.
const canned = {
  type: "result",
  subtype: "success",
  is_error: false,
  structured_output: {
    proposals: proposals
      .filter((p) => ["lis", "nap", "rak"].includes(p.id))
      .map(({ id: _i, planId: _p, review: _r, provenance: _v, ...p }) => ({
        ...p,
        sources: [{ label: `Fuente de ${p.place.city}`, url: "https://example.org/" }],
      })),
  },
};
const steps = [
  { type: "assistant", message: { content: [{ type: "text", text: "Busco destinos de sol para noviembre." }] } },
  { type: "assistant", message: { content: [{ type: "tool_use", name: "WebSearch", input: { query: "vuelos Madrid Lisboa noviembre" } }] } },
];
writeFileSync(join(dir, "steps.ndjson"), steps.map((l) => JSON.stringify(l)).join("\n") + "\n");
writeFileSync(join(dir, "result.ndjson"), JSON.stringify(canned) + "\n");
const fakeClaude = join(dir, "claude");
writeFileSync(
  fakeClaude,
  `#!/bin/sh\n[ "$1" = "--version" ] && { echo "0.0.0 (stand-in)"; exit 0; }\ncat "${join(dir, "steps.ndjson")}"\nsleep 1\ncat "${join(dir, "result.ndjson")}"\n`,
);
chmodSync(fakeClaude, 0o755);

function start(cmd: string[], cwd: string, env: Record<string, string>, ready: string): Promise<ChildProcess> {
  const child = spawn(process.execPath, ["--import", "tsx", ...cmd], { cwd, env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "inherit"] });
  return new Promise((resolve, reject) => {
    child.stdout!.on("data", (d) => String(d).includes(ready) && resolve(child));
    child.on("exit", (code) => reject(new Error(`${cmd.join(" ")} exited ${code}`)));
  });
}

const site = await start(["src/server.ts"], "apps/site", { PORT: String(SITE_PORT), WANDERLOT_ADMIN_TOKEN: ADMIN, WANDERLOT_DB: ":memory:", WANDERLOT_ORIGIN: SITE }, "Wanderlot site");
const panel = await start(
  ["src/server.ts"],
  "apps/panel",
  { PORT: String(PANEL_PORT), WANDERLOT_SITE_URL: SITE, WANDERLOT_ADMIN_TOKEN: ADMIN, WANDERLOT_PANEL_DATA: join(dir, "panel.json"), CLAUDE_BIN: fakeClaude, DUFFEL_API_KEY: "" },
  "Wanderlot panel",
);

const browser = await chromium.launch();
try {
  const org = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();

  // 1. First run: no plans yet.
  await org.goto(PANEL);
  await org.getByText("Todavía no hay ningún plan").waitFor();
  await org.getByRole("link", { name: "Crear el primero" }).click();
  await org.getByLabel("Nombre").fill("Noviembre 2026");
  // Two clicks on next month's calendar: leave on the 10th, back on the 15th.
  const next = new Date();
  next.setUTCDate(1);
  next.setUTCMonth(next.getUTCMonth() + 1);
  const day = (d: number) => `${next.toISOString().slice(0, 8)}${String(d).padStart(2, "0")}`;
  await org.getByRole("button", { name: "Mes siguiente" }).click();
  await org.getByRole("button", { name: day(10), exact: true }).click();
  await org.getByRole("button", { name: day(15), exact: true }).click();
  await org.getByText("5 noches").first().waitFor();
  await org.getByRole("button", { name: "Crear el plan" }).click();
  await org.getByText("Todavía no hay propuestas para Noviembre 2026").waitFor();
  await org.getByText("claude conectado").waitFor();
  console.log("✓ panel: plan created");

  // 2. The group and a friend.
  await org.getByRole("link", { name: "Personas" }).first().click();
  await org.getByLabel("Nombre del grupo").fill("Grupo 51");
  await org.getByLabel("Tu nombre").fill("Eyman");
  await org.getByRole("form", { name: "El grupo" }).getByRole("button", { name: "Guardar" }).click();
  await org.getByText("Guardado en el sitio").waitFor();
  for (const name of ["Ana", "Bea", "Carla"]) {
    await org.getByLabel("Añadir a alguien").fill(name);
    await org.getByRole("button", { name: "Añadir" }).click();
    await org.getByRole("listitem", { name }).getByText("Sin invitar").waitFor();
  }
  // Ana and Bea go on this trip; Carla doesn't.
  const trip = org.getByRole("form", { name: "Quién va a Noviembre 2026" });
  await trip.getByRole("checkbox", { name: "Ana" }).check();
  await trip.getByRole("checkbox", { name: "Bea" }).check();
  await trip.getByRole("button", { name: "Guardar" }).click();
  await org.getByText("Guardado: 2 personas van a Noviembre 2026").waitFor();
  console.log("✓ panel: group named; Ana and Bea on the trip, Carla not");

  // 3. Research with Claude (the stand-in), then approve and publish.
  await org.getByRole("link", { name: "Generar" }).first().click();
  await org.getByLabel("Claude").check();
  await org.getByRole("button", { name: "Generar 12 propuestas" }).click();
  await org.getByText("Buscando «vuelos Madrid Lisboa noviembre»").waitFor();
  await org.getByText("Búsqueda terminada").waitFor();
  assert.equal(await org.getByRole("article").count(), 3);
  console.log("✓ panel: 3 proposals researched");

  await org.getByRole("link", { name: "Revisar" }).first().click();
  for (const city of ["Lisboa", "Nápoles", "Marrakech"]) {
    await org.getByRole("article", { name: city }).getByRole("button", { name: "Aprobar sin verificar" }).click();
  }
  await org.getByRole("button", { name: "Publicar 3 aprobadas" }).click();
  await org.getByRole("button", { name: "Publicar igualmente" }).click();
  await org.getByText("3 destinos publicados en el sitio").waitFor();
  console.log("✓ panel: approved and published (unverified, confirmed)");

  // 4. Open the vote and take Ana's invite from the group-chat message.
  await org.getByRole("link", { name: "Comparativa" }).first().click();
  await org.getByRole("button", { name: "Enviar las 3 a votación" }).click();
  await org.getByRole("button", { name: "Abrir con 3 destinos" }).click();
  const message = await org.getByLabel("Mensaje para el grupo").inputValue();
  const invite = /• Ana: (\S+)/.exec(message)?.[1];
  assert.ok(invite?.startsWith(`${SITE}/i/`), message);
  assert.match(message, /• Bea: /);
  assert.doesNotMatch(message, /Carla/);
  console.log("✓ panel: vote opened, message has invites for Ana and Bea only");

  // 5. Ana, on her phone: invite → PIN → the plan.
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const ana = await phone.newPage();
  await ana.goto(invite!);
  await ana.getByText("Eyman te ha invitado a Grupo 51").waitFor();
  await ana.getByLabel("Tu PIN").fill("4801");
  await ana.getByLabel("Repítelo").fill("4801");
  await ana.getByRole("button", { name: "Guardar PIN y entrar" }).click();
  await ana.getByRole("heading", { level: 1, name: "Noviembre 2026" }).waitFor();
  for (const city of ["Lisboa", "Nápoles", "Marrakech"]) await ana.getByRole("link", { name: city }).first().waitFor();
  assert.equal(await ana.getByText("Lo escribió Claude").count(), 3);
  await ana.getByText("0 de 2 habéis votado").waitFor();
  console.log("✓ site: Ana joined and sees the published plan, labelled");

  // 6. Back in the panel, Ana shows as inside.
  await org.getByRole("button", { name: "Cerrar" }).click();
  await org.getByRole("link", { name: "Personas" }).first().click();
  await org.getByRole("listitem", { name: "Ana" }).getByText("Dentro").waitFor();
  console.log("✓ panel: Ana is inside");

  // 6b. Ana suggests a destination; the organiser researches it from Generar.
  await ana.getByRole("button", { name: "Proponer un destino" }).click();
  await ana.getByLabel("Destino", { exact: true }).fill("Azores");
  await ana.getByLabel("Por qué (opcional)").fill("Naturaleza a lo bestia");
  await ana.getByRole("button", { name: "Enviar idea" }).click();
  await ana.getByText("Idea enviada. Eyman la verá en el panel.").waitFor();
  await org.getByRole("link", { name: "Generar" }).first().click();
  const idea = org.getByRole("listitem", { name: "Azores" });
  await idea.getByText("«Naturaleza a lo bestia»").waitFor();
  await idea.getByRole("button", { name: "Investigar" }).click();
  await idea.getByText("Investigada").waitFor();
  await org.getByText("Idea de Ana").first().waitFor();
  console.log("✓ site → panel: Ana's idea researched and credited");

  // 7. Ana votes on her phone; the organiser follows it and closes early.
  await ana.getByRole("link", { name: "Repartir mis puntos" }).click();
  for (const points of [3, 2, 1]) await ana.getByRole("button", { name: `Darle ${points} ${points === 1 ? "punto" : "puntos"}` }).first().click();
  await ana.getByRole("button", { name: "Votar" }).click();
  await ana.getByText("Reparto guardado").waitFor();
  await org.getByRole("link", { name: "Votación" }).first().click();
  await org.getByText("1 de 2").waitFor();
  // The organiser sees her ballot and the running count before anyone else.
  await org.getByRole("table", { name: "Recuento provisional" }).waitFor();
  assert.match((await org.getByRole("listitem", { name: "Ana" }).textContent())!, /1\. \S+ · 2\. \S+ · 3\. /);
  await org.getByRole("button", { name: "Cerrar ya" }).click();
  await org.getByRole("button", { name: "Cerrar con 1 voto" }).click();
  await org.getByText("Ganó").waitFor();
  const winner = (await org.getByRole("heading", { level: 2 }).first().textContent())!.trim();
  await org.getByRole("button", { name: "Anunciar el resultado" }).click();
  assert.match(await org.getByLabel("Mensaje para el grupo").inputValue(), new RegExp(`nos vamos a ${winner}`));
  console.log(`✓ panel: vote closed early, ${winner} announced`);

  // 8. The site shows the same result to Ana.
  await ana.goto(`${SITE}/p/noviembre-2026`);
  await ana.getByText(`Votación cerrada · ganó ${winner}`).waitFor();
  console.log("✓ site: Ana sees the result");
} finally {
  await browser.close();
  site.kill();
  panel.kill();
}
