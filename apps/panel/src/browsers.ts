// The browsers "Comprobar vuelos" can open (ROADMAP 3.4): any Chromium on
// the laptop, found where each one installs itself. Playwright MCP starts it
// by its path, so it works with Brave or Edge as well as Chrome, without
// installing anything else.
import { existsSync } from "node:fs";
import { delimiter, join } from "node:path";

export const BROWSER_IDS = ["chrome", "brave", "edge", "chromium"] as const;
export type BrowserId = (typeof BROWSER_IDS)[number];

export const BROWSER_NAMES: Record<BrowserId, string> = { chrome: "Chrome", brave: "Brave", edge: "Edge", chromium: "Chromium" };

export interface FoundBrowser {
  id: BrowserId | "custom";
  name: string;
  path: string;
}

type Env = Record<string, string | undefined>;

// Where each one lives, per system, in order of preference.
function candidates(platform: NodeJS.Platform, env: Env): Record<BrowserId, string[]> {
  if (platform === "darwin") {
    const app = (name: string, bin: string) => [`/Applications/${name}.app/Contents/MacOS/${bin}`, ...(env.HOME ? [`${env.HOME}/Applications/${name}.app/Contents/MacOS/${bin}`] : [])];
    return {
      chrome: app("Google Chrome", "Google Chrome"),
      brave: app("Brave Browser", "Brave Browser"),
      edge: app("Microsoft Edge", "Microsoft Edge"),
      chromium: app("Chromium", "Chromium"),
    };
  }
  if (platform === "win32") {
    const roots = [env.PROGRAMFILES, env["PROGRAMFILES(X86)"], env.LOCALAPPDATA].filter((r): r is string => !!r);
    const under = (...rest: string[]) => roots.map((r) => join(r, ...rest));
    return {
      chrome: under("Google", "Chrome", "Application", "chrome.exe"),
      brave: under("BraveSoftware", "Brave-Browser", "Application", "brave.exe"),
      edge: under("Microsoft", "Edge", "Application", "msedge.exe"),
      chromium: under("Chromium", "Application", "chrome.exe"),
    };
  }
  // Linux: on the PATH, or where the packages put them.
  const onPath = (...names: string[]) => names.flatMap((n) => (env.PATH ?? "").split(delimiter).filter(Boolean).map((d) => join(d, n)));
  return {
    chrome: ["/opt/google/chrome/chrome", ...onPath("google-chrome", "google-chrome-stable")],
    brave: ["/opt/brave.com/brave/brave", ...onPath("brave-browser", "brave"), "/snap/bin/brave"],
    edge: ["/opt/microsoft/msedge/msedge", ...onPath("microsoft-edge", "microsoft-edge-stable")],
    chromium: [...onPath("chromium", "chromium-browser"), "/snap/bin/chromium"],
  };
}

// Every browser installed here, Chrome first.
export function findBrowsers(platform: NodeJS.Platform = process.platform, env: Env = process.env, exists: (p: string) => boolean = existsSync): FoundBrowser[] {
  const all = candidates(platform, env);
  return BROWSER_IDS.flatMap((id) => {
    const path = all[id].find((p) => exists(p));
    return path ? [{ id, name: BROWSER_NAMES[id], path }] : [];
  });
}

// WANDERLOT_BROWSER: a browser's name ("brave"; "msedge" too, as before) or
// the path to one. Unset, or not installed: the first one found.
export class BrowserChoice {
  #chosen: FoundBrowser | null;
  readonly options: FoundBrowser[];

  constructor(
    found: FoundBrowser[],
    setting: string | undefined,
    private readonly remember: (value: string) => void = () => {},
    exists: (p: string) => boolean = existsSync,
  ) {
    const want = setting?.trim().toLowerCase() === "msedge" ? "edge" : setting?.trim();
    const byName = found.find((o) => o.id === want?.toLowerCase());
    const known = found.find((o) => o.path === want);
    const byPath = known ?? (want && /[/\\]/.test(want) && exists(want) ? { id: "custom" as const, name: "Tu navegador", path: want } : null);
    this.options = byPath && !known ? [...found, byPath] : found;
    this.#chosen = byName ?? byPath ?? found[0] ?? null;
  }

  get chosen(): FoundBrowser | null {
    return this.#chosen;
  }

  choose(id: string): FoundBrowser {
    const found = this.options.find((o) => o.id === id);
    if (!found) throw new Error("Ese navegador no está instalado en este ordenador");
    this.#chosen = found;
    this.remember(found.id === "custom" ? found.path : found.id);
    return found;
  }

  view() {
    return { options: this.options.map(({ id, name, path }) => ({ id, name, path })), active: this.#chosen?.id ?? null };
  }
}
