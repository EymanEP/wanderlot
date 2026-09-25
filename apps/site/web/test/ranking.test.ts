import { describe, expect, it } from "vitest";
import { add, isComplete, moveDown, moveUp, pointsIfAdded, remove, sameRanking } from "../src/lib/ranking.ts";

describe("ranking edits", () => {
  const r = ["rak", "lis", "bud"];

  it("moves picks up and down, ignoring the ends", () => {
    expect(moveUp(r, 1)).toEqual(["lis", "rak", "bud"]);
    expect(moveDown(r, 1)).toEqual(["rak", "bud", "lis"]);
    expect(moveUp(r, 0)).toEqual(r);
    expect(moveDown(r, 2)).toEqual(r);
  });

  it("adds to a free slot, or replaces the third when full", () => {
    expect(add(["rak"], "nap")).toEqual(["rak", "nap"]);
    expect(add(r, "nap")).toEqual(["rak", "lis", "nap"]);
    expect(add(r, "lis")).toEqual(r);
  });

  it("says how many points a newcomer would get", () => {
    expect(pointsIfAdded([])).toBe(3);
    expect(pointsIfAdded(["rak"])).toBe(2);
    expect(pointsIfAdded(["rak", "lis"])).toBe(1);
    expect(pointsIfAdded(r)).toBe(1);
  });

  it("knows when a ballot is complete", () => {
    expect(isComplete(remove(r, "lis"), 4)).toBe(false);
    expect(isComplete(r, 4)).toBe(true);
    expect(isComplete(["rak", "lis"], 2)).toBe(true);
    expect(sameRanking(r, [...r])).toBe(true);
  });
});
