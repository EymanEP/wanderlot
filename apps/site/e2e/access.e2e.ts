// End-to-end: the real site and UI in Chromium. Friends join with a PIN and
// sign in from any device; the browser's virtual authenticator stands in for
// Face ID on the optional passkey path. Runs against the Node server
// (npm run test:e2e) or the Cloudflare Worker in wrangler dev with a local D1
// (npm run test:e2e:worker). Both build the UI first.
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { strict as assert } from "node:assert";
import { chromium } from "playwright";
import { destination, snapshot } from "../../../packages/core/test/fixtures.ts";

const worker = process.argv.includes("--worker");
const PORT = worker ? 8912 : 8911;
const ORIGIN = `http://localhost:${PORT}`;
const ADMIN = "e2e-".padEnd(40, "x");

const server = worker
  ? spawn(
      "npx",
      ["wrangler", "dev", "--port", String(PORT), "--var", `ADMIN_TOKEN:${ADMIN}`, "--var", `ORIGIN:${ORIGIN}`, "--persist-to", mkdtempSync(join(tmpdir(), "wanderlot-d1-"))],
      { stdio: ["ignore", "pipe", "inherit"], detached: true },
    )
  : spawn(process.execPath, ["--import", "tsx", "src/server.ts"], {
      env: { ...process.env, PORT: String(PORT), WANDERLOT_ADMIN_TOKEN: ADMIN, WANDERLOT_DB: ":memory:", WANDERLOT_ORIGIN: ORIGIN },
      stdio: ["ignore", "pipe", "inherit"],
    });
const stop = () => (worker ? process.kill(-server.pid!) : server.kill());

if (worker) {
  // A fresh local D1 needs the schema before the Worker can use it.
  await new Promise<void>((resolve, reject) => {
    const persist = (server.spawnargs.at(-1) as string);
    const m = spawn("npx", ["wrangler", "d1", "migrations", "apply", "wanderlot", "--local", "--persist-to", persist], { stdio: "ignore" });
    m.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`migrations exited ${code}`))));
  });
}
await new Promise<void>((resolve, reject) => {
  const ready = worker ? "Ready on" : "Wanderlot site";
  server.stdout!.on("data", (d) => String(d).includes(ready) && resolve());
  server.on("exit", (code) => reject(new Error(`server exited ${code}`)));
});
console.log(`— ${worker ? "Cloudflare Worker (wrangler dev, local D1)" : "Node server (node:sqlite)"}`);

const admin = async (path: string, method: string, body?: unknown) => {
  const res = await fetch(`${ORIGIN}/api/admin${path}`, {
    method,
    headers: { authorization: `Bearer ${ADMIN}`, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  assert.ok(res.ok, `${method} ${path}: ${res.status}`);
  return res.json() as Promise<any>;
};

const browser = await chromium.launch();
try {
  // The organiser names the group, adds Ana and Bea, and publishes two trips:
  // Noviembre for both, Puente for Bea only.
  await admin("/settings", "PUT", { groupName: "Grupo E2E", organiserName: "Eyman" });
  await admin("/members", "PUT", [{ id: "ana", name: "Ana María" }, { id: "bea", name: "Bea" }]);
  await admin("/plans/noviembre-2026", "PUT", snapshot([destination("lis"), destination("nap"), destination("opo")]));
  const puente = snapshot([destination("rak"), destination("bud")]);
  await admin("/plans/puente", "PUT", { ...puente, plan: { ...puente.plan, id: "puente", name: "Puente" } });
  await admin("/plans/noviembre-2026/members", "PUT", ["ana", "bea"]);
  await admin("/plans/puente/members", "PUT", ["bea"]);
  await admin("/plans/noviembre-2026/open-vote", "POST", { deadline: "2099-01-01T00:00:00Z" });
  const { token } = await admin("/members/ana/invite", "POST");

  // 1. Ana, on her phone: the invite, opened twice, then a PIN.
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await phone.newPage();
  await page.goto(`${ORIGIN}/i/${token}`);
  await page.reload();
  await page.getByText("Eyman te ha invitado a Grupo E2E").waitFor();
  await page.getByRole("heading", { name: "¿Eres Ana María?" }).waitFor();
  await page.getByLabel("Tu PIN").fill("4801");
  await page.getByLabel("Repítelo").fill("4801");
  await page.getByRole("button", { name: "Guardar PIN y entrar" }).click();
  await page.getByRole("heading", { level: 1, name: "Tus viajes" }).waitFor();
  await page.getByRole("link", { name: /Noviembre 2026/ }).click();
  await page.waitForURL(`${ORIGIN}/p/noviembre-2026`);
  assert.deepEqual(await (await page.request.get(`${ORIGIN}/api/session`)).json(), { member: { id: "ana", name: "Ana María" } });
  console.log("✓ invite → PIN → signed in");

  // 2. The trip, in the real UI: vote, comment, like. Only her trips exist.
  await page.getByRole("heading", { level: 1, name: "Noviembre 2026" }).waitFor();
  await page.getByText("0 de 2 habéis votado").waitFor();
  await page.getByRole("link", { name: "Repartir mis puntos" }).click();
  for (const points of [3, 2, 1]) await page.getByRole("button", { name: `Darle ${points} ${points === 1 ? "punto" : "puntos"}` }).first().click();
  await page.getByRole("button", { name: "Votar" }).click();
  await page.getByText("Reparto guardado").waitFor();
  const view = await (await page.request.get(`${ORIGIN}/api/plans/noviembre-2026`)).json();
  assert.equal(view.myRanking.length, 3);
  assert.deepEqual(view.participation.map((p: { id: string }) => p.id), ["ana", "bea"]);
  await page.goto(`${ORIGIN}/p/noviembre-2026/destinos/nap`);
  await page.getByPlaceholder("Escribe un comentario…").fill("Pompeya sí o sí");
  await page.getByRole("button", { name: "Comentar" }).click();
  await page.getByText("Pompeya sí o sí").waitFor();
  await page.getByRole("button", { name: "Me gusta · 0" }).click();
  await page.getByRole("button", { name: "Me gusta · 1" }).waitFor();
  assert.equal((await page.request.get(`${ORIGIN}/api/plans/noviembre-2026/results`)).status(), 403);
  const trips = (await (await page.request.get(`${ORIGIN}/api/plans`)).json()) as { id: string }[];
  assert.deepEqual(trips.map((t) => t.id), ["noviembre-2026"]);
  assert.equal((await page.request.get(`${ORIGIN}/api/plans/puente`)).status(), 404);
  console.log("✓ her trip only; voted, commented and liked in the UI");

  // 3. The invite is spent.
  await page.goto(`${ORIGIN}/i/${token}`);
  await page.getByRole("heading", { name: "Esta invitación ya se usó" }).waitFor();
  console.log("✓ used invite is refused");

  // 4. Her laptop: no passkey anywhere, just her name and PIN.
  const laptop = await (await browser.newContext()).newPage();
  await laptop.goto(`${ORIGIN}/p/noviembre-2026/votacion`);
  await laptop.getByRole("heading", { name: "Entra en Grupo E2E" }).waitFor();
  await laptop.getByLabel("Tu nombre").fill("ana maria");
  await laptop.getByLabel("PIN", { exact: true }).fill("1352");
  await laptop.getByRole("button", { name: "Entrar", exact: true }).click();
  await laptop.getByText("Nombre o PIN incorrectos").waitFor();
  await laptop.getByLabel("PIN", { exact: true }).fill("4801");
  await laptop.getByRole("button", { name: "Entrar", exact: true }).click();
  await laptop.waitForURL(`${ORIGIN}/p/noviembre-2026/votacion`);
  await laptop.getByRole("heading", { level: 1, name: "Votación" }).waitFor();
  console.log("✓ laptop: name + PIN, back to where she was going");

  // 5. Bea prefers a passkey: she creates one from her invite and signs in with it.
  const beaContext = await browser.newContext();
  const bea = await beaContext.newPage();
  const cdp = await beaContext.newCDPSession(bea);
  await cdp.send("WebAuthn.enable");
  await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: { protocol: "ctap2", transport: "internal", hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
  });
  const beaInvite = (await admin("/members/bea/invite", "POST")).token;
  await bea.goto(`${ORIGIN}/i/${beaInvite}`);
  await bea.getByRole("button", { name: "Prefiero Face ID o huella en este dispositivo" }).click();
  // Her two trips, to pick one.
  await bea.getByRole("heading", { level: 1, name: "Tus viajes" }).waitFor();
  assert.equal(await bea.getByRole("article").count(), 2);
  await bea.getByRole("link", { name: /Puente/ }).click();
  await bea.waitForURL(/\/p\/puente/);
  await bea.getByRole("button", { name: "Tu cuenta" }).click();
  await bea.getByRole("button", { name: "Cerrar sesión en este dispositivo" }).click();
  await bea.getByRole("heading", { name: "Entra en Grupo E2E" }).waitFor();
  await bea.getByRole("button", { name: "Entrar con passkey (Face ID o huella)" }).click();
  // Back to the trip she was on when she signed out.
  await bea.waitForURL(/\/p\/puente/);
  const beaTrips = (await (await bea.request.get(`${ORIGIN}/api/plans`)).json()) as { id: string }[];
  assert.deepEqual(beaTrips.map((t) => t.id).sort(), ["noviembre-2026", "puente"]);
  console.log("✓ passkey still works for whoever wants it; Bea sees both her trips");

  // 6. A fresh browser lands on Entrar, not the plan.
  const stranger = await (await browser.newContext()).newPage();
  await stranger.goto(`${ORIGIN}/p/noviembre-2026`);
  await stranger.getByRole("heading", { name: "Entra en Grupo E2E" }).waitFor();
  console.log("✓ no session, no plan");

  // 7. Removing Ana's access signs her out everywhere and her PIN stops working.
  const members = await admin("/members", "GET");
  assert.ok(members.find((m: { id: string }) => m.id === "ana").pin);
  await admin("/members/ana/revoke", "POST");
  await laptop.reload();
  await laptop.getByRole("heading", { name: "Entra en Grupo E2E" }).waitFor();
  await laptop.getByLabel("Tu nombre").fill("Ana María");
  await laptop.getByLabel("PIN", { exact: true }).fill("4801");
  await laptop.getByRole("button", { name: "Entrar", exact: true }).click();
  await laptop.getByText("Nombre o PIN incorrectos").waitFor();
  console.log("✓ removed access: PIN refused");
} finally {
  await browser.close();
  stop();
}
