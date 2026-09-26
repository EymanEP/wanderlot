// End-to-end: the real site and UI in Chromium, with the browser's virtual
// authenticator standing in for Face ID. Runs against the Node server
// (npm run test:e2e) or the Cloudflare Worker in wrangler dev with a local D1
// (npm run test:e2e:worker). Both need the UI built with VITE_AUTH=http.
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
      ["wrangler", "dev", "--port", String(PORT), "--var", `ADMIN_TOKEN:${ADMIN}`, "--persist-to", mkdtempSync(join(tmpdir(), "wanderlot-d1-"))],
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
  await admin("/members", "PUT", [{ id: "ana", name: "Ana" }]);
  const { token } = await admin("/members/ana/invite", "POST");

  const context = await browser.newContext();
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: { protocol: "ctap2", transport: "internal", hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
  });

  // 1. The invite: opening it twice changes nothing; creating the passkey signs her in.
  await page.goto(`${ORIGIN}/i/${token}`);
  await page.reload();
  await page.getByRole("heading", { name: "¿Eres Ana?" }).waitFor();
  await page.getByRole("button", { name: "Crear mi passkey" }).click();
  await page.waitForURL(`${ORIGIN}/p/noviembre-2026`);
  const me = await (await page.request.get(`${ORIGIN}/api/session`)).json();
  assert.deepEqual(me, { member: { id: "ana", name: "Ana" } });
  console.log("✓ invite → passkey → signed in");

  // 2. Publishing, voting and commenting run through the same storage.
  await admin("/plans/noviembre-2026", "PUT", snapshot([destination("lis"), destination("nap"), destination("opo")]));
  await admin("/plans/noviembre-2026/open-vote", "POST", { deadline: "2099-01-01T00:00:00Z" });
  const ballot = await page.request.put(`${ORIGIN}/api/plans/noviembre-2026/ballot`, { data: { ranking: ["nap", "lis", "opo"] } });
  assert.equal(ballot.status(), 200);
  const comment = await page.request.post(`${ORIGIN}/api/plans/noviembre-2026/comments`, { data: { destinationId: "nap", body: "Pompeya sí o sí" } });
  assert.equal(comment.status(), 201);
  const view = await (await page.request.get(`${ORIGIN}/api/plans/noviembre-2026`)).json();
  assert.deepEqual(view.myRanking, ["nap", "lis", "opo"]);
  assert.equal(view.participation.find((p: { id: string }) => p.id === "ana").voted, true);
  const comments = await (await page.request.get(`${ORIGIN}/api/plans/noviembre-2026/comments`)).json();
  assert.equal(comments[0].body, "Pompeya sí o sí");
  assert.equal((await page.request.get(`${ORIGIN}/api/plans/noviembre-2026/results`)).status(), 403);
  console.log("✓ publish, vote and comment");

  // 3. The invite is spent.
  await page.goto(`${ORIGIN}/i/${token}`);
  await page.getByRole("heading", { name: "Esta invitación ya se usó" }).waitFor();
  console.log("✓ used invite is refused");

  // 4. Sign out, then back in with just the passkey.
  await page.goto(`${ORIGIN}/p/noviembre-2026`);
  await page.getByRole("button", { name: "Tu cuenta" }).click();
  await page.getByRole("button", { name: "Cerrar sesión en este dispositivo" }).click();
  await page.getByRole("heading", { name: "Entra con tu passkey" }).waitFor();
  assert.equal((await page.request.get(`${ORIGIN}/api/session`)).status(), 401);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(`${ORIGIN}/p/noviembre-2026`);
  assert.equal((await page.request.get(`${ORIGIN}/api/session`)).status(), 200);
  console.log("✓ signed out and back in with the passkey");

  // 5. A fresh browser without the passkey lands on Entrar, not the plan.
  const stranger = await (await browser.newContext()).newPage();
  await stranger.goto(`${ORIGIN}/p/noviembre-2026/votacion`);
  await stranger.getByRole("heading", { name: "Entra con tu passkey" }).waitFor();
  console.log("✓ no session, no plan");

  // 6. The organiser sees her passkey; removing access locks her out.
  const [ana] = await admin("/members", "GET");
  assert.equal(ana.passkeys.length, 1);
  await admin("/members/ana/revoke", "POST");
  await page.reload();
  await page.getByRole("heading", { name: "Entra con tu passkey" }).waitFor();
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.getByText("Esta passkey ya no vale aquí").waitFor();
  console.log("✓ removed access: passkey refused");
} finally {
  await browser.close();
  stop();
}
