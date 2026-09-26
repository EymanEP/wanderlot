import { describe, expect, it } from "vitest";
import {
  daysUntil,
  standardImageUrl,
  deadlineLabel,
  duration,
  euros,
  eurosGrouped,
  legDuration,
  mediumDate,
  rangeLabel,
  relativeTime,
  shortDate,
  stopsLabel,
} from "../src/index.ts";

describe("display", () => {
  it("formats euros the way the designs do", () => {
    expect(euros(41200)).toBe("412 €");
    expect(eurosGrouped(172000)).toBe("1 720 €");
  });

  it("formats durations and stops", () => {
    expect(duration(80)).toBe("1 h 20 m");
    expect(duration(185)).toBe("3 h 05 m");
    expect(duration(45)).toBe("45 m");
    expect(stopsLabel(0)).toBe("Directo");
    expect(stopsLabel(1)).toBe("1 escala");
  });

  it("measures a leg across time zones", () => {
    expect(
      legDuration({
        from: "MAD",
        to: "LIS",
        departAt: "2026-11-07T07:10:00+01:00",
        arriveAt: "2026-11-07T07:30:00+00:00",
        carrier: "TAP",
        flightNumber: "TP1015",
        stops: 0,
        priceCents: 0,
      }),
    ).toBe("1 h 20 m");
  });

  it("formats Spanish dates", () => {
    expect(shortDate("2026-11-07")).toBe("sáb 7 nov");
    expect(mediumDate("2026-09-24T10:00:00Z")).toBe("24 sep 2026");
    expect(rangeLabel("2026-11-07", "2026-11-14")).toBe("7 – 14 nov");
    expect(deadlineLabel("2026-10-10T23:59:00+02:00")).toBe("sábado 10 de octubre a las 23:59");
  });

  it("counts whole days left, rounding down", () => {
    const now = new Date("2026-09-25T10:00:00Z");
    expect(daysUntil("2026-10-10T23:59:00+02:00", now)).toBe(15);
    expect(daysUntil("2026-09-25T20:00:00Z", now)).toBe(0);
  });

  it("describes elapsed time", () => {
    const now = new Date("2026-09-25T12:00:00Z");
    expect(relativeTime("2026-09-25T08:00:00Z", now)).toBe("hace 4 horas");
    expect(relativeTime("2026-09-23T10:00:00Z", now)).toBe("hace 2 días");
    expect(relativeTime("2026-09-25T11:59:40Z", now)).toBe("ahora mismo");
  });
});

describe("standardImageUrl", () => {
  const thumb = (w: number) => `https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Bel%C3%A9m.jpg/${w}px-Bel%C3%A9m.jpg`;

  it("moves a Wikimedia thumbnail to the largest standard width that fits", () => {
    expect(standardImageUrl(thumb(1600))).toBe(thumb(1280));
    expect(standardImageUrl(thumb(1000))).toBe(thumb(960));
    expect(standardImageUrl(thumb(10))).toBe(thumb(20));
    const onThumbHost = thumb(1600).replace("upload.wikimedia.org", "thumb.wikimedia.org");
    expect(standardImageUrl(onThumbHost)).toBe(thumb(1280).replace("upload.wikimedia.org", "thumb.wikimedia.org"));
  });

  it("leaves standard widths, originals and other hosts alone", () => {
    expect(standardImageUrl(thumb(1280))).toBe(thumb(1280));
    const original = "https://upload.wikimedia.org/wikipedia/commons/a/ab/Bel%C3%A9m.jpg";
    expect(standardImageUrl(original)).toBe(original);
    const unsplash = "https://images.unsplash.com/photo-1?w=1600";
    expect(standardImageUrl(unsplash)).toBe(unsplash);
  });
});
