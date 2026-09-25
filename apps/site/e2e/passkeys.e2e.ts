// End-to-end: the real site server and UI in Chromium, with the browser's
// virtual authenticator standing in for Face ID. Run: npm run test:e2e -w @wanderlot/site
import { spawn } from "node:child_process";
import { strict as assert } from "node:assert";
import { chromium } from "playwright";

const PORT = 8911;
const ORIGIN = `http://localhost:${PORT}`;
const ADMIN = "e2e-".padEnd(40, "x");

const server = spawn(process.execPath, ["--import", "tsx", "src/server.ts"], {
  env: { ...process.env, PORT: String(PORT), WANDERLOT_ADMIN_TOKEN: ADMIN, WANDERLOT_DB: ":memory:", WANDERLOT_ORIGIN: ORIGIN },
  stdio: ["ignore", "pipe", "inherit"],
});
await new Promise<void>((resolve, reject) => {
  server.stdout!.on("data", (d) => String(d).includes("Wanderlot site") && resolve());
  server.on("exit", (code) => reject(new Error(`server exited ${code}`)));
});

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

  // 2. The invite is spent.
  await page.goto(`${ORIGIN}/i/${token}`);
  await page.getByRole("heading", { name: "Esta invitación ya se usó" }).waitFor();
  console.log("✓ used invite is refused");

  // 3. Sign out, then back in with just the passkey.
  await page.goto(`${ORIGIN}/p/noviembre-2026`);
  await page.getByRole("button", { name: "Tu cuenta" }).click();
  await page.getByRole("button", { name: "Cerrar sesión en este dispositivo" }).click();
  await page.getByRole("heading", { name: "Entra con tu passkey" }).waitFor();
  assert.equal((await page.request.get(`${ORIGIN}/api/session`)).status(), 401);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(`${ORIGIN}/p/noviembre-2026`);
  assert.equal((await page.request.get(`${ORIGIN}/api/session`)).status(), 200);
  console.log("✓ signed out and back in with the passkey");

  // 4. A fresh browser without the passkey lands on Entrar, not the plan.
  const stranger = await (await browser.newContext()).newPage();
  await stranger.goto(`${ORIGIN}/p/noviembre-2026/votacion`);
  await stranger.getByRole("heading", { name: "Entra con tu passkey" }).waitFor();
  console.log("✓ no session, no plan");

  // 5. The organiser sees her passkey; removing access locks her out.
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
  server.kill();
}
