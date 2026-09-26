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
  step("Checking your Cloudflare login");
  // whoami succeeds even when logged out, so read what it says.
  const who = wrangler(["whoami"], { quiet: true });
  if (!who.ok || /not authenticated/i.test(who.out)) fail("You're not logged in to Cloudflare. Run `npx wrangler login` and try again.");

  step("D1 database");
  let config = readFileSync(CONFIG, "utf8");
  if (config.includes(PLACEHOLDER)) {
    const list = wrangler(["d1", "list", "--json"], { quiet: true });
    let id = list.ok ? JSON.parse(list.out.slice(list.out.indexOf("["))).find((d) => d.name === "wanderlot") : undefined;
    id = id?.uuid ?? id?.database_id ?? id?.id;
    if (!id) {
      const created = wrangler(["d1", "create", "wanderlot"], { quiet: true });
      id = /"?database_id"?\s*[:=]\s*"([0-9a-f-]{36})"/.exec(created.out)?.[1];
      if (!id) fail(`Couldn't create the database:\n${created.out}`);
    }
    config = config.replace(PLACEHOLDER, id);
    writeFileSync(CONFIG, config);
    console.log(`  wanderlot · ${id} (saved in apps/site/wrangler.jsonc)`);
  } else {
    console.log("  already set up");
  }

  step("Building the web UI");
  const build = spawnSync("npx", ["vite", "build"], { cwd: SITE, stdio: "inherit", env: process.env });
  if (build.status !== 0) fail("The build failed.");

  step("Applying migrations");
  if (!wrangler(["d1", "migrations", "apply", "wanderlot", "--remote"], { input: "y\n" }).ok) fail("The migrations failed.");

  step("Deploying the Worker");
  const deployed = wrangler(["deploy"]);
  if (!deployed.ok) fail("The deploy failed.");
  const url = /https:\/\/[\w.-]+\.workers\.dev/.exec(deployed.out)?.[0];

  step("ADMIN_TOKEN secret");
  const secrets = wrangler(["secret", "list", "--format", "json"], { quiet: true });
  const has = secrets.ok && secrets.out.includes('"ADMIN_TOKEN"');
  if (has) {
    console.log("  already set");
  } else {
    const token = readEnv().WANDERLOT_ADMIN_TOKEN ?? randomToken();
    if (!wrangler(["secret", "put", "ADMIN_TOKEN"], { input: token, quiet: true }).ok) fail("Couldn't save the secret.");
    writeEnv({ WANDERLOT_ADMIN_TOKEN: token });
    console.log("  saved to Cloudflare and .env");
  }

  step("PIN_SECRET secret");
  // Keys the PIN hashes, so a copy of the database alone can't be used to
  // test PINs. Set once: changing it means everyone needs a new invite.
  if (secrets.ok && secrets.out.includes('"PIN_SECRET"')) {
    console.log("  already set");
  } else {
    if (!wrangler(["secret", "put", "PIN_SECRET"], { input: randomToken(), quiet: true }).ok) fail("Couldn't save the secret.");
    console.log("  saved to Cloudflare");
  }

  step("Public address (ORIGIN)");
  // Passkeys are tied to one address, so the Worker needs it fixed rather
  // than trusting each request's hostname. WANDERLOT_ORIGIN in .env wins
  // (for a custom domain); otherwise the workers.dev address.
  const hasOrigin = secrets.ok && secrets.out.includes('"ORIGIN"');
  const origin = readEnv().WANDERLOT_ORIGIN ?? url;
  if (hasOrigin && !readEnv().WANDERLOT_ORIGIN) {
    console.log("  already set up");
  } else if (!origin) {
    fail("Don't know the site's address. Add WANDERLOT_ORIGIN=https://… to .env and run this again.");
  } else {
    if (!wrangler(["secret", "put", "ORIGIN"], { input: origin, quiet: true }).ok) fail("Couldn't save ORIGIN.");
    console.log(`  ${origin}`);
  }

  console.log(`\n✓ Site deployed${url ? `: ${url}` : ""}`);
  console.log("  Passkeys are tied to this address: if you'll use your own domain, set it up before inviting anyone.");
  return url;
}

if (import.meta.url === `file://${process.argv[1]}`) await deploySite();
