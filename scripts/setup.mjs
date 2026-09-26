// Sets up the panel on this computer (SPEC §11): where the site is, the admin
// token, and optional provider keys. Writes .env; run again to change anything.
import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline";
import { deploySite } from "./deploy-site.mjs";
import { ENV_PATH, randomToken, readEnv, writeEnv } from "./lib/env.mjs";

// Answers are queued as lines arrive, so piped input works as well as typing.
const rl = createInterface({ input: process.stdin, terminal: false });
const lines = [];
const waiting = [];
rl.on("line", (l) => (waiting.length ? waiting.shift()(l) : lines.push(l)));
rl.on("close", () => waiting.splice(0).forEach((w) => w("")));
function line(prompt) {
  process.stdout.write(prompt);
  return lines.length ? Promise.resolve(lines.shift()) : new Promise((r) => waiting.push(r));
}
const env = readEnv();

async function ask(question, fallback = "") {
  const hint = fallback ? ` [${fallback.length > 24 ? fallback.slice(0, 20) + "…" : fallback}]` : "";
  const answer = (await line(`${question}${hint}: `)).trim();
  return answer || fallback;
}

async function yes(question, fallback = true) {
  const answer = (await line(`${question} ${fallback ? "[S/n]" : "[s/N]"}: `)).trim().toLowerCase();
  return answer ? answer.startsWith("s") || answer.startsWith("y") : fallback;
}

console.log("Wanderlot · configuración del panel\n");

// 1. The site.
let siteUrl = env.WANDERLOT_SITE_URL;
if (!siteUrl || (await yes(`Sitio actual: ${siteUrl}. ¿Cambiarlo?`, false))) {
  if (await yes("¿Desplegar ahora el sitio en Cloudflare (gratis)?", true)) {
    siteUrl = (await deploySite()) ?? (await ask("Dirección del sitio (la que dio Cloudflare)"));
  } else {
    siteUrl = await ask("Dirección del sitio (p. ej. https://wanderlot-grupo51.workers.dev)", siteUrl);
  }
}
siteUrl = siteUrl.replace(/\/+$/, "");

// 2. The admin token: the same value as the site's ADMIN_TOKEN secret.
let token = readEnv().WANDERLOT_ADMIN_TOKEN ?? env.WANDERLOT_ADMIN_TOKEN;
if (!token) {
  token = await ask("Token de administración del sitio (vacío = generar uno nuevo)");
  if (!token) {
    token = randomToken();
    console.log("  Token nuevo generado. Guárdalo también en el sitio:");
    console.log("  Cloudflare: npx wrangler secret put ADMIN_TOKEN   (en apps/site)");
    console.log("  Servidor Node: WANDERLOT_ADMIN_TOKEN en su entorno");
  }
}

// 3. Check the panel can reach the site as admin.
try {
  const res = await fetch(`${siteUrl}/api/admin/members`, { headers: { authorization: `Bearer ${token}` } });
  if (res.ok) console.log(`✓ Conectado a ${siteUrl}`);
  else console.log(`! El sitio respondió ${res.status}: ${res.status === 401 ? "el token no coincide con el del sitio" : "revisa la dirección"}. Puedes seguir y arreglarlo luego.`);
} catch (e) {
  console.log(`! No se pudo conectar con ${siteUrl} (${e.message}). Puedes seguir y arreglarlo luego.`);
}

// 4. Research: the local claude command, or an API key.
const claude = spawnSync(env.CLAUDE_BIN ?? "claude", ["--version"], { encoding: "utf8" });
console.log(
  claude.status === 0
    ? `\n✓ Claude Code encontrado (${claude.stdout.trim()}): la investigación usará tu suscripción.`
    : "\n! No encuentro el comando `claude`. Instala Claude Code o pon una clave de la API de Anthropic.",
);
const anthropic = await ask("Clave de la API de Anthropic (opcional, de pago por uso)", env.ANTHROPIC_API_KEY ?? "");

// 5. Optional providers.
console.log("\nOpcionales: sin ellos todo funciona, pero los precios quedan como «Lo escribió Claude» y las fotos solo salen de Wikimedia.");
const duffel = await ask("Clave de Duffel (vuelos verificados)", env.DUFFEL_API_KEY ?? "");
const unsplash = await ask("Access key de Unsplash (fotos)", env.UNSPLASH_ACCESS_KEY ?? "");
const pexels = await ask("Clave de Pexels (fotos)", env.PEXELS_API_KEY ?? "");
rl.close();

writeEnv({
  WANDERLOT_SITE_URL: siteUrl,
  WANDERLOT_ADMIN_TOKEN: token,
  ANTHROPIC_API_KEY: anthropic,
  DUFFEL_API_KEY: duffel,
  UNSPLASH_ACCESS_KEY: unsplash,
  PEXELS_API_KEY: pexels,
});
console.log(`\n✓ Guardado en ${ENV_PATH}`);
console.log("  Siguiente: npm run panel  →  http://127.0.0.1:5151  →  Personas");
