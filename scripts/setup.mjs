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

// 4. The AI (ROADMAP 3.3): the local claude command, or API keys. The panel's
// Ajustes page picks among the ones set up.
const claude = spawnSync(env.CLAUDE_BIN ?? "claude", ["--version"], { encoding: "utf8" });
console.log(
  claude.status === 0
    ? `\n✓ Found Claude Code (${claude.stdout.trim()}): research will use your Claude plan.`
    : "\n! Can't find the `claude` command. Install Claude Code, or enter an API key below. Without any, add destinations by hand.",
);
const anthropic = await ask("Anthropic API key (optional, pay per use)", env.ANTHROPIC_API_KEY ?? "");
const openai = await ask("OpenAI API key (optional, pay per use)", env.OPENAI_API_KEY ?? "");
let compatible = { AI_BASE_URL: env.AI_BASE_URL, AI_API_KEY: env.AI_API_KEY, AI_MODEL: env.AI_MODEL };
if (await yes("Use another OpenAI-compatible endpoint (OpenRouter, a local model…)? It can't search the web, so its prices are estimates", !!env.AI_BASE_URL)) {
  compatible = {
    AI_BASE_URL: await ask("  Base URL (e.g. https://openrouter.ai/api/v1)", env.AI_BASE_URL ?? ""),
    AI_API_KEY: await ask("  API key", env.AI_API_KEY ?? ""),
    AI_MODEL: await ask("  Model name", env.AI_MODEL ?? ""),
  };
}
// The panel at /admin can read screenshots with the same keys, stored as
// secrets on Cloudflare; npm run deploy:site copies them there.
const apiKeys = anthropic || openai || compatible.AI_API_KEY;
const siteAi = apiKeys ? await yes("Also let the panel on your site (/admin) use these keys (to read screenshots, and with Anthropic or OpenAI to search from your phone)? They're stored as Cloudflare secrets", env.WANDERLOT_SITE_AI === "1") : false;

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
  OPENAI_API_KEY: openai,
  ...compatible,
  WANDERLOT_SITE_AI: siteAi ? "1" : "",
  DUFFEL_API_KEY: duffel,
  UNSPLASH_ACCESS_KEY: unsplash,
  PEXELS_API_KEY: pexels,
});
console.log(`\n✓ Saved to ${ENV_PATH}`);
if (siteAi) console.log("  Run npm run deploy:site to give the keys to the site's panel.");
console.log("  Next: npm run panel  →  http://127.0.0.1:5151  →  Personas (add your friends)");
