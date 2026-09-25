import { describe, expect, it } from "vitest";
import { freezeViolation, tally, validateRanking } from "../src/index.ts";

const opt = (id: string, totalPerPersonCents = 40000) => ({ id, totalPerPersonCents });

describe("tally", () => {
  it("awards 3/2/1 and sums to 6 per ballot", () => {
    const r = tally([opt("lis"), opt("nap"), opt("opo")], [["lis", "nap", "opo"]]);
    expect(r.rows.map((x) => [x.id, x.points])).toEqual([
      ["lis", 3],
      ["nap", 2],
      ["opo", 1],
    ]);
    expect(r.rows.reduce((s, x) => s + x.points, 0)).toBe(6);
  });

  it("lets broad second choices beat a polarising favourite", () => {
    // Plurality would pick "a" (two first places, everyone else one).
    const options = ["a", "b", "c", "d", "e"].map((id) => opt(id));
    const r = tally(options, [
      ["a", "b", "c"],
      ["a", "b", "c"],
      ["c", "b", "d"],
      ["d", "b", "e"],
      ["e", "b", "c"],
      ["b", "c", "d"],
    ]);
    expect(r.winnerId).toBe("b");
    expect(r.rows.find((x) => x.id === "a")!.points).toBe(6);
    expect(r.rows.find((x) => x.id === "b")!.points).toBe(13);
    expect(r.rows.reduce((s, x) => s + x.points, 0)).toBe(36);
  });

  it("breaks a points tie on first places", () => {
    // x: 3+1 = 4, one first. y: 2+2 = 4, no firsts.
    const r = tally([opt("x"), opt("y"), opt("z")], [
      ["x", "y", "z"],
      ["z", "y", "x"],
    ]);
    const x = r.rows.find((row) => row.id === "x")!;
    const y = r.rows.find((row) => row.id === "y")!;
    expect(x.points).toBe(y.points);
    expect(x.rank).toBeLessThan(y.rank);
  });

  it("then breaks on price, cheaper first", () => {
    const r = tally([opt("cara", 50000), opt("barata", 30000)], [
      ["cara", "barata"],
      ["barata", "cara"],
    ]);
    expect(r.winnerId).toBe("barata");
  });

  it("reports an unbroken tie instead of inventing a rule", () => {
    const r = tally([opt("p"), opt("q")], [
      ["p", "q"],
      ["q", "p"],
    ]);
    expect(r.winnerId).toBeNull();
    expect(r.tiedForFirst).toEqual(["p", "q"]);
    expect(r.rows.map((x) => x.rank)).toEqual([1, 1]);
  });

  it("gives unranked options zero", () => {
    const r = tally([opt("a"), opt("b"), opt("c"), opt("d")], [["a", "b", "c"]]);
    expect(r.rows.find((x) => x.id === "d")!.points).toBe(0);
  });
});

describe("validateRanking", () => {
  const four = ["lis", "nap", "rak", "bud"];

  it("accepts exactly three distinct in-vote ids", () => {
    expect(validateRanking(["lis", "nap", "rak"], four)).toBeNull();
  });

  it("needs min(3, n) entries", () => {
    expect(validateRanking(["lis", "nap"], four)).toMatch(/exactamente 3/);
    expect(validateRanking(["lis", "nap"], ["lis", "nap"])).toBeNull();
  });

  it("rejects duplicates and unknown ids", () => {
    expect(validateRanking(["lis", "lis", "nap"], four)).toMatch(/dos veces/);
    expect(validateRanking(["lis", "nap", "edi"], four)).toMatch(/edi/);
  });

  it("refuses a vote with fewer than two destinations", () => {
    expect(validateRanking(["lis"], ["lis"])).toMatch(/al menos 2/);
  });
});

describe("freezeViolation", () => {
  const a = [
    { id: "lis", inVote: true },
    { id: "nap", inVote: true },
    { id: "edi", inVote: false },
  ];

  it("allows the same set in any order", () => {
    expect(freezeViolation(a, [...a].reverse())).toBeNull();
  });

  it("rejects adding, removing, or toggling inVote", () => {
    expect(freezeViolation(a, a.slice(0, 2))).not.toBeNull();
    expect(freezeViolation(a, [...a, { id: "opo", inVote: false }])).not.toBeNull();
    expect(freezeViolation(a, a.map((d) => ({ ...d, inVote: true })))).not.toBeNull();
  });
});
