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
  const answer = (await line(`${question} ${fallback ? "[Y/n]" : "[y/N]"}: `)).trim().toLowerCase();
  return answer ? answer.startsWith("y") : fallback;
}

console.log("Wanderlot · panel setup\n");

// 1. The site.
let siteUrl = env.WANDERLOT_SITE_URL;
if (!siteUrl || (await yes(`Current site: ${siteUrl}. Change it?`, false))) {
  if (await yes("Deploy the site to Cloudflare now (free)?", true)) {
    siteUrl = (await deploySite()) ?? (await ask("Site address (the one Cloudflare gave you)"));
  } else {
    siteUrl = await ask("Site address (e.g. https://wanderlot.your-name.workers.dev)", siteUrl);
  }
}
siteUrl = siteUrl.replace(/\/+$/, "");

// 2. The admin token: the same value as the site's ADMIN_TOKEN secret.
let token = readEnv().WANDERLOT_ADMIN_TOKEN ?? env.WANDERLOT_ADMIN_TOKEN;
if (!token) {
  token = await ask("Site admin token (leave empty to generate a new one)");
  if (!token) {
    token = randomToken();
    console.log("  Generated a new token. Save it on the site too:");
    console.log("  Cloudflare: npx wrangler secret put ADMIN_TOKEN   (in apps/site)");
    console.log("  Node server: WANDERLOT_ADMIN_TOKEN in its environment");
  }
}

// 3. Check the panel can reach the site as admin.
try {
  const res = await fetch(`${siteUrl}/api/admin/members`, { headers: { authorization: `Bearer ${token}` } });
  if (res.ok) console.log(`✓ Connected to ${siteUrl}`);
  else console.log(`! The site answered ${res.status}: ${res.status === 401 ? "the token doesn't match the site's" : "check the address"}. You can carry on and fix it later.`);
} catch (e) {
  console.log(`! Couldn't reach ${siteUrl} (${e.message}). You can carry on and fix it later.`);
}

// 4. Research: the local claude command, or an API key.
const claude = spawnSync(env.CLAUDE_BIN ?? "claude", ["--version"], { encoding: "utf8" });
console.log(
  claude.status === 0
    ? `\n✓ Found Claude Code (${claude.stdout.trim()}): research will use your Claude plan.`
    : "\n! Can't find the `claude` command. Install Claude Code or enter an Anthropic API key.",
);
const anthropic = await ask("Anthropic API key (optional, pay per use)", env.ANTHROPIC_API_KEY ?? "");

// 5. Optional providers.
console.log("\nOptional: everything works without these, but prices stay labelled as written by Claude and photos come from Wikimedia only.");
const duffel = await ask("Duffel key (verified flight prices)", env.DUFFEL_API_KEY ?? "");
const unsplash = await ask("Unsplash access key (photos)", env.UNSPLASH_ACCESS_KEY ?? "");
const pexels = await ask("Pexels key (photos)", env.PEXELS_API_KEY ?? "");
rl.close();

writeEnv({
  WANDERLOT_SITE_URL: siteUrl,
  WANDERLOT_ADMIN_TOKEN: token,
  ANTHROPIC_API_KEY: anthropic,
  DUFFEL_API_KEY: duffel,
  UNSPLASH_ACCESS_KEY: unsplash,
  PEXELS_API_KEY: pexels,
});
console.log(`\n✓ Saved to ${ENV_PATH}`);
console.log("  Next: npm run panel  →  http://127.0.0.1:5151  →  Personas (add your friends)");
