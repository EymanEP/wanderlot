import { describe, expect, it } from "vitest";
import { COUNTDOWN_RUNWAY_DAYS, departureAt, tripCountdown } from "../src/countdown.ts";

// Local times throughout, as the viewer's browser sees them.
const at = (y: number, m: number, d: number, h = 0, min = 0, s = 0) => new Date(y, m - 1, d, h, min, s);
const trip = { dateFrom: "2026-11-07", dateTo: "2026-11-14" };

describe("tripCountdown", () => {
  it("counts down to the first day's midnight without a flight time", () => {
    const c = tripCountdown(trip, at(2026, 11, 5, 18, 30, 15));
    expect(c).toMatchObject({ phase: "before", days: 1, hours: 5, minutes: 29, seconds: 45, calendarDays: 2 });
  });

  it("counts down to the flight when it leaves on the first day", () => {
    const departAt = at(2026, 11, 7, 7, 20).toISOString();
    expect(departureAt(trip.dateFrom, departAt).getTime()).toBe(at(2026, 11, 7, 7, 20).getTime());
    const c = tripCountdown({ ...trip, departAt }, at(2026, 11, 6, 22, 0));
    expect(c).toMatchObject({ phase: "before", days: 0, hours: 9, minutes: 20, seconds: 0, calendarDays: 1 });
  });

  it("ignores a flight time for other dates", () => {
    expect(departureAt(trip.dateFrom, "2026-11-20T07:20:00+01:00").getTime()).toBe(at(2026, 11, 7).getTime());
  });

  it("says it's today on the morning of a flight", () => {
    const c = tripCountdown({ ...trip, departAt: at(2026, 11, 7, 18).toISOString() }, at(2026, 11, 7, 9));
    expect(c).toMatchObject({ phase: "before", days: 0, hours: 9, calendarDays: 0 });
  });

  it("moves the plane along the last eight weeks", () => {
    const far = tripCountdown(trip, at(2026, 6, 1));
    const half = tripCountdown(trip, new Date(at(2026, 11, 7).getTime() - (COUNTDOWN_RUNWAY_DAYS / 2) * 86_400_000));
    expect(far.phase === "before" && far.progress).toBe(0);
    expect(half.phase === "before" && half.progress).toBeCloseTo(0.5, 5);
  });

  it("counts the days of the trip, then stops", () => {
    expect(tripCountdown(trip, at(2026, 11, 7, 12))).toEqual({ phase: "during", day: 1, of: 8, progress: 0 });
    expect(tripCountdown(trip, at(2026, 11, 10, 12))).toMatchObject({ phase: "during", day: 4, of: 8 });
    expect(tripCountdown(trip, at(2026, 11, 14, 23))).toEqual({ phase: "during", day: 8, of: 8, progress: 1 });
    expect(tripCountdown(trip, at(2026, 11, 15, 0, 1))).toEqual({ phase: "after" });
  });
});
