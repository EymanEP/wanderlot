// Deploys the site to Cloudflare Workers + D1 (SPEC §11). Safe to re-run:
// creates the D1 database the first time, applies new migrations, deploys,
// and sets the ADMIN_TOKEN and ORIGIN secrets if the Worker lacks them.
// Needs a Cloudflare account: run `npx wrangler login` once first.
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { randomToken, readEnv, writeEnv } from "./lib/env.mjs";

const SITE = fileURLToPath(new URL("../apps/site/", import.meta.url));
const CONFIG = `${SITE}wrangler.jsonc`;
const PLACEHOLDER = "00000000-0000-0000-0000-000000000000";

function wrangler(args, { input, quiet } = {}) {
  const r = spawnSync("npx", ["wrangler", ...args], { cwd: SITE, encoding: "utf8", input, stdio: [input ? "pipe" : "inherit", "pipe", "pipe"] });
  if (!quiet) process.stdout.write(r.stdout ?? "");
  return { ok: r.status === 0, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

function step(msg) {
  console.log(`\n▸ ${msg}`);
}

function fail(msg) {
  console.error(`\n✗ ${msg}`);
  process.exit(1);
}

export async function deploySite() {
  step("Comprobando la sesión de Cloudflare");
  // whoami succeeds even when logged out, so read what it says.
  const who = wrangler(["whoami"], { quiet: true });
  if (!who.ok || /not authenticated/i.test(who.out)) fail("No has iniciado sesión en Cloudflare. Ejecuta `npx wrangler login` y vuelve a probar.");

  step("Base de datos D1");
  let config = readFileSync(CONFIG, "utf8");
  if (config.includes(PLACEHOLDER)) {
    const list = wrangler(["d1", "list", "--json"], { quiet: true });
    let id = list.ok ? JSON.parse(list.out.slice(list.out.indexOf("["))).find((d) => d.name === "wanderlot") : undefined;
    id = id?.uuid ?? id?.database_id ?? id?.id;
    if (!id) {
      const created = wrangler(["d1", "create", "wanderlot"], { quiet: true });
      id = /"?database_id"?\s*[:=]\s*"([0-9a-f-]{36})"/.exec(created.out)?.[1];
      if (!id) fail(`No se pudo crear la base de datos:\n${created.out}`);
    }
    config = config.replace(PLACEHOLDER, id);
    writeFileSync(CONFIG, config);
    console.log(`  wanderlot · ${id} (guardado en apps/site/wrangler.jsonc)`);
  } else {
    console.log("  ya configurada");
  }

  step("Compilando la web");
  const build = spawnSync("npx", ["vite", "build"], { cwd: SITE, stdio: "inherit", env: process.env });
  if (build.status !== 0) fail("La compilación falló.");

  step("Aplicando migraciones");
  if (!wrangler(["d1", "migrations", "apply", "wanderlot", "--remote"], { input: "y\n" }).ok) fail("Las migraciones fallaron.");

  step("Desplegando el Worker");
  const deployed = wrangler(["deploy"]);
  if (!deployed.ok) fail("El despliegue falló.");
  const url = /https:\/\/[\w.-]+\.workers\.dev/.exec(deployed.out)?.[0];

  step("Secreto ADMIN_TOKEN");
  const secrets = wrangler(["secret", "list", "--format", "json"], { quiet: true });
  const has = secrets.ok && secrets.out.includes('"ADMIN_TOKEN"');
  if (has) {
    console.log("  ya configurado");
  } else {
    const token = readEnv().WANDERLOT_ADMIN_TOKEN ?? randomToken();
    if (!wrangler(["secret", "put", "ADMIN_TOKEN"], { input: token, quiet: true }).ok) fail("No se pudo guardar el secreto.");
    writeEnv({ WANDERLOT_ADMIN_TOKEN: token });
    console.log("  guardado en Cloudflare y en .env");
  }

  step("Dirección pública (ORIGIN)");
  // Passkeys are tied to one address, so the Worker needs it fixed rather
  // than trusting each request's hostname. WANDERLOT_ORIGIN in .env wins
  // (for a custom domain); otherwise the workers.dev address.
  const hasOrigin = secrets.ok && secrets.out.includes('"ORIGIN"');
  const origin = readEnv().WANDERLOT_ORIGIN ?? url;
  if (hasOrigin && !readEnv().WANDERLOT_ORIGIN) {
    console.log("  ya configurada");
  } else if (!origin) {
    fail("No sé la dirección del sitio. Añade WANDERLOT_ORIGIN=https://… a .env y vuelve a ejecutar.");
  } else {
    if (!wrangler(["secret", "put", "ORIGIN"], { input: origin, quiet: true }).ok) fail("No se pudo guardar ORIGIN.");
    console.log(`  ${origin}`);
  }

  console.log(`\n✓ Sitio desplegado${url ? `: ${url}` : ""}`);
  console.log("  Las passkeys quedan ligadas a esta dirección: si vas a usar un dominio propio, ponlo antes de invitar a nadie.");
  return url;
}

if (import.meta.url === `file://${process.argv[1]}`) await deploySite();
