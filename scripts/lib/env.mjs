// Reads and writes the repo's .env (the panel's local secrets, SPEC §11).
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const ENV_PATH = fileURLToPath(new URL("../../.env", import.meta.url));

export function readEnv() {
  if (!existsSync(ENV_PATH)) return {};
  const out = {};
  for (const line of readFileSync(ENV_PATH, "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m) out[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
  }
  return out;
}

// Merges values into .env, keeping anything else already there.
export function writeEnv(values) {
  const merged = { ...readEnv(), ...values };
  const body = [
    "# Wanderlot panel settings. Written by `npm run setup`; keep this file private.",
    ...Object.entries(merged)
      .filter(([, v]) => v !== undefined && v !== "")
      .map(([k, v]) => `${k}=${v}`),
    "",
  ].join("\n");
  writeFileSync(ENV_PATH, body);
  try {
    chmodSync(ENV_PATH, 0o600);
  } catch {}
}

export function randomToken() {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
}
