// Security headers for every page and API response. On Cloudflare the built
// UI is served before the Worker runs, so web/public/_headers repeats these
// (a test keeps the two in step).
export const PHOTO_HOSTS = ["https://images.unsplash.com", "https://images.pexels.com", "https://upload.wikimedia.org"];

export const SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy": [
    "default-src 'self'",
    `img-src 'self' ${PHOTO_HOSTS.join(" ")}`,
    "style-src 'self' https://fonts.googleapis.com",
    "font-src https://fonts.gstatic.com",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; "),
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "same-origin",
  "X-Content-Type-Options": "nosniff",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

// The same headers in Cloudflare's _headers format.
export function headersFile(): string {
  return ["/*", ...Object.entries(SECURITY_HEADERS).map(([k, v]) => `  ${k}: ${v}`)].join("\n") + "\n";
}

// A fixed-window limiter for the Node server; the Worker uses Cloudflare's.
export function memoryLimiter(limit: number, periodMs: number, now = () => Date.now()) {
  const windows = new Map<string, { start: number; count: number }>();
  return async (key: string): Promise<boolean> => {
    const t = now();
    const w = windows.get(key);
    if (!w || t - w.start >= periodMs) {
      if (windows.size > 10_000) windows.clear();
      windows.set(key, { start: t, count: 1 });
      return true;
    }
    w.count++;
    return w.count <= limit;
  };
}
