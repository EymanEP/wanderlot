import { describe, expect, it } from "vitest";
import { destination } from "../../../../packages/core/test/fixtures.ts";
import { groupWord, overridden, placeLine } from "../src/lib/view.ts";

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

describe("overridden", () => {
  it("is true only when the group went somewhere other than the vote's winner", () => {
    expect(overridden({ winnerId: "prg", voteWinnerId: "bud" })).toBe(true);
    expect(overridden({ winnerId: "bud", voteWinnerId: "bud" })).toBe(false);
    // A tie broken by the organiser, or an older site without the field.
    expect(overridden({ winnerId: "bud", voteWinnerId: null })).toBe(false);
    expect(overridden({ winnerId: "bud" })).toBe(false);
    expect(overridden(null)).toBe(false);
  });
});

describe("groupWord", () => {
  it("names the group by its size instead of always six", () => {
    expect(`nosotros ${groupWord(5)}`).toBe("nosotros cinco");
    expect(`los ${groupWord(6)}`).toBe("los seis");
    expect(groupWord(14)).toBe("14");
  });
});
