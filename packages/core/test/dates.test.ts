import { describe, expect, it } from "vitest";
import { DateWindows, answeredAll, bestDateOptions, dateCounts, type DatesView } from "../src/dates.ts";

const view = (responses: DatesView["responses"]): DatesView => ({
  status: "open",
  options: DateWindows.parse([
    { dateFrom: "2026-11-12", dateTo: "2026-11-16" },
    { dateFrom: "2026-11-03", dateTo: "2026-11-07" },
    { dateFrom: "2026-11-20", dateTo: "2026-11-24" },
  ]),
  deadline: null,
  chosenOptionId: null,
  responses,
});
const r = (memberId: string, answers: Record<string, "yes" | "maybe" | "no">) => ({ memberId, answers, note: null, updatedAt: "2026-10-01T10:00:00Z" });
const [A, B, C] = ["2026-11-03_2026-11-07", "2026-11-12_2026-11-16", "2026-11-20_2026-11-24"];

describe("date windows", () => {
  it("sorts them and names each by its dates", () => {
    expect(view([]).options.map((o) => o.id)).toEqual([A, B, C]);
  });

  it("needs 2 to 5 distinct windows of 1 to 30 nights", () => {
    const w = (dateFrom: string, dateTo: string) => ({ dateFrom, dateTo });
    expect(DateWindows.safeParse([w("2026-11-03", "2026-11-07")]).success).toBe(false);
    expect(DateWindows.safeParse([w("2026-11-03", "2026-11-07"), w("2026-11-03", "2026-11-07")]).success).toBe(false);
    expect(DateWindows.safeParse([w("2026-11-03", "2026-11-03"), w("2026-11-05", "2026-11-07")]).success).toBe(false);
    expect(DateWindows.safeParse([w("2026-11-01", "2026-12-15"), w("2026-11-05", "2026-11-07")]).success).toBe(false);
    expect(DateWindows.safeParse(Array.from({ length: 6 }, (_, i) => w(`2026-11-0${i + 1}`, `2026-11-1${i}`))).success).toBe(false);
  });
});

describe("who can go when", () => {
  it("counts answers and ignores windows someone hasn't seen", () => {
    const v = view([r("ana", { [A]: "yes", [B]: "maybe", [C]: "no" }), r("bea", { [A]: "yes", [B]: "yes" })]);
    expect(dateCounts(v)).toEqual([
      { id: A, yes: 2, maybe: 0, no: 0 },
      { id: B, yes: 1, maybe: 1, no: 0 },
      { id: C, yes: 0, maybe: 0, no: 1 },
    ]);
    expect(answeredAll(v, "ana")).toBe(true);
    expect(answeredAll(v, "bea")).toBe(false);
    expect(answeredAll(v, "carla")).toBe(false);
  });

  it("prefers most yes, then fewest no, then most if-need-be, and keeps ties", () => {
    expect(bestDateOptions(view([]))).toEqual([]);
    expect(bestDateOptions(view([r("ana", { [A]: "yes", [B]: "yes", [C]: "no" }), r("bea", { [A]: "no", [B]: "yes", [C]: "yes" })]))).toEqual([B]);
    expect(bestDateOptions(view([r("ana", { [A]: "yes", [B]: "yes", [C]: "yes" }), r("bea", { [A]: "no", [B]: "maybe", [C]: "no" })]))).toEqual([B]);
    expect(bestDateOptions(view([r("ana", { [A]: "yes", [B]: "yes", [C]: "no" })]))).toEqual([A, B]);
  });
});
