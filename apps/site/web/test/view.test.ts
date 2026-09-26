import { describe, expect, it } from "vitest";
import { destination } from "../../../../packages/core/test/fixtures.ts";
import { placeLine } from "../src/lib/view.ts";

describe("placeLine", () => {
  const checked = { kind: "organiser" as const, checkedAt: "2026-09-26T10:00:00Z", sources: [] };

  it("shows the flight's length from research or an API", () => {
    expect(placeLine(destination("lis"))).toMatch(/^Portugal · directo \d+ h/);
  });

  it("shows only the checked price when the organiser didn't check the times", () => {
    expect(placeLine(destination("lis", { provenance: checked }))).toBe("Portugal · vuelo 200 € i/v");
  });

  it("shows the times again once they were read from a screenshot", () => {
    expect(placeLine(destination("lis", { provenance: { ...checked, flightDetails: true } }))).toMatch(/^Portugal · directo \d+ h/);
  });
});
