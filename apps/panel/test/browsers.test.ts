import { describe, expect, it } from "vitest";
import { BrowserChoice, findBrowsers } from "../src/browsers.ts";

const BRAVE_MAC = "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser";
const CHROME_MAC = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

describe("finding the browsers on the laptop", () => {
  it("finds Brave on a Mac without Chrome", () => {
    const found = findBrowsers("darwin", { HOME: "/Users/ana" }, (p) => p === BRAVE_MAC);
    expect(found).toEqual([{ id: "brave", name: "Brave", path: BRAVE_MAC }]);
  });

  it("finds them on Windows under Program Files or the user's folder", () => {
    const env = { PROGRAMFILES: "C:\\Program Files", LOCALAPPDATA: "C:\\Users\\ana\\AppData\\Local" };
    const found = findBrowsers("win32", env, (p) => /Brave-Browser|Edge/.test(p));
    expect(found.map((b) => b.id)).toEqual(["brave", "edge"]);
  });

  it("finds them on the PATH on Linux", () => {
    const found = findBrowsers("linux", { PATH: "/usr/bin:/bin" }, (p) => p === "/usr/bin/brave-browser" || p === "/usr/bin/chromium");
    expect(found).toEqual([
      { id: "brave", name: "Brave", path: "/usr/bin/brave-browser" },
      { id: "chromium", name: "Chromium", path: "/usr/bin/chromium" },
    ]);
  });
});

describe("choosing one", () => {
  const both = [
    { id: "chrome" as const, name: "Chrome", path: CHROME_MAC },
    { id: "brave" as const, name: "Brave", path: BRAVE_MAC },
  ];

  it("takes the first one found when nothing is set, or what was set isn't here", () => {
    expect(new BrowserChoice(both, undefined).chosen?.id).toBe("chrome");
    expect(new BrowserChoice(both, "edge").chosen?.id).toBe("chrome");
    expect(new BrowserChoice([], undefined).chosen).toBeNull();
  });

  it("takes a name or a path, and remembers a change", () => {
    const saved: string[] = [];
    const choice = new BrowserChoice(both, "Brave", (v) => saved.push(v));
    expect(choice.chosen?.id).toBe("brave");
    choice.choose("chrome");
    expect(choice.chosen?.name).toBe("Chrome");
    expect(saved).toEqual(["chrome"]);
    expect(() => choice.choose("edge")).toThrow(/no está instalado/);

    const custom = new BrowserChoice(both, "/opt/vivaldi/vivaldi", () => {}, (p) => p === "/opt/vivaldi/vivaldi");
    expect(custom.chosen).toEqual({ id: "custom", name: "Tu navegador", path: "/opt/vivaldi/vivaldi" });
    expect(custom.view().options).toHaveLength(3);
  });
});
