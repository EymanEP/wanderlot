import { describe, expect, it } from "vitest";
import { addDays, dayRole, monthGrid, monthLabel, shiftMonth } from "../src/calendar.ts";

describe("calendar maths", () => {
  it("lays November 2026 out Monday-first, as in the design", () => {
    const grid = monthGrid(2026, 10);
    expect(grid).toHaveLength(42);
    // The design's grid starts on Monday 26 October.
    expect(grid[0]).toEqual({ date: "2026-10-26", day: 26, inMonth: false });
    expect(grid[6]!.date).toBe("2026-11-01");
    expect(grid.filter((c) => c.inMonth)).toHaveLength(30);
  });

  it("marks the stay's start, end and the nights between", () => {
    const end = addDays("2026-11-07", 7);
    expect(end).toBe("2026-11-14");
    expect(dayRole("2026-11-07", "2026-11-07", end)).toBe("start");
    expect(dayRole("2026-11-10", "2026-11-07", end)).toBe("between");
    expect(dayRole("2026-11-14", "2026-11-07", end)).toBe("end");
    expect(dayRole("2026-11-15", "2026-11-07", end)).toBe("none");
  });

  it("names and steps months across a year boundary", () => {
    expect(monthLabel(2026, 10)).toBe("Noviembre 2026");
    expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, month0: 0 });
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
  });
});
