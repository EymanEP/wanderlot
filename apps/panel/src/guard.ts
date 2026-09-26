// The panel listens on 127.0.0.1 only, but any web page the organiser opens
// can still send it requests, and with DNS rebinding even read the answers.
// So every request must name the panel itself as its Host, and changes must
// come from the panel's own page as JSON (which no cross-site form can send).
import type { MiddlewareHandler } from "hono";

export function localOnly(hosts: string[]): MiddlewareHandler {
  const allowed = new Set(hosts.map((h) => h.toLowerCase()));
  return async (c, next) => {
    const host = (c.req.header("host") ?? "").toLowerCase();
    if (!allowed.has(host)) return c.json({ error: "forbidden host" }, 403);
    if (c.req.method !== "GET" && c.req.method !== "HEAD") {
      const origin = c.req.header("origin");
      if (origin !== undefined && !allowed.has(origin.toLowerCase().replace(/^https?:\/\//, ""))) {
        return c.json({ error: "forbidden origin" }, 403);
      }
      const type = c.req.header("content-type") ?? "";
      if (!/^application\/json\b/i.test(type)) return c.json({ error: "expected application/json" }, 415);
    }
    await next();
  };
}

// The panel's own addresses: the server, and Vite's in development (which
// forwards the browser's Host and Origin unchanged).
export function panelHosts(ports: number[]): string[] {
  return ports.flatMap((p) => [`127.0.0.1:${p}`, `localhost:${p}`]);
}
