import { afterEach, describe, expect, it } from "vitest";
import { setLocale } from "@wanderlot/core";
import { toCents } from "../src/components/PriceDialog.tsx";

afterEach(() => setLocale("es"));

describe("toCents", () => {
  it("reads prices as written in Spanish", () => {
    expect(["1044", "1044,50", "1.044,50", "1.044", "1044.5", "  89 € "].map(toCents)).toEqual([104400, 104450, 104450, 104400, 104450, 8900]);
    expect(toCents("1,044")).toBe(104);
  });

  it("reads prices as written in English", () => {
    setLocale("en");
    expect(["1,044.50", "1,044", "1044.50", "€89"].map(toCents)).toEqual([104450, 104400, 104450, 8900]);
  });

  it("refuses what isn't a price", () => {
    expect(["", "abc", "-5"].map(toCents)).toEqual([null, null, null]);
  });
});
