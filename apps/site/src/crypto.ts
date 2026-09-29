// Tokens and hashes on the Web Crypto API, which both Node and Cloudflare
// Workers provide, so the site runs unchanged on either.

export function base64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromBase64url(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

// 32 random bytes, base64url: invite links, session cookies, flow ids.
export function randomToken(bytes = 32): string {
  return base64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Constant-time comparison for the admin token.
export function safeEqual(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

// PINs are four digits: too few to survive a leaked database on their own,
// however slow the hash. So each is an HMAC keyed by a server-side secret
// (PIN_SECRET), with a per-member salt; the database alone can't test guesses,
// and online guesses are capped by the lockout in app.ts.
export async function pinHasher(secret: string) {
  const raw = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`wanderlot-pin:${secret}`));
  const key = await crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return async (memberId: string, salt: string, pin: string): Promise<string> => {
    const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${salt}:${memberId}:${pin}`));
    return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  };
}

// The /admin password (ROADMAP 3.1), like a PIN: an HMAC keyed by a
// server-side secret, with a per-password salt. The database alone can't
// test guesses, and it stays within a free Worker's few milliseconds of CPU
// (a slow hash like PBKDF2 at a useful cost doesn't).
export async function passwordHasher(secret: string) {
  const raw = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`wanderlot-organiser:${secret}`));
  const key = await crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return async (salt: string, password: string): Promise<string> =>
    base64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${salt}:${password}`))));
}

// Invite links the panel keeps to copy again: sealed with a key from the
// admin token (AES-GCM), so the database alone doesn't hold working links.
export async function sealer(secret: string) {
  const raw = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`wanderlot-panel-invites:${secret}`));
  const key = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
  return {
    async seal(text: string): Promise<string> {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const box = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(text)));
      return `${base64url(iv)}.${base64url(box)}`;
    },
    // null when it doesn't open (another key, or tampered with).
    async open(sealed: string): Promise<string | null> {
      const [iv, box] = sealed.split(".");
      try {
        return new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64url(iv ?? "") }, key, fromBase64url(box ?? "")));
      } catch {
        return null;
      }
    },
  };
}
