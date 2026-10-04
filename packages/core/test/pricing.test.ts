import { describe, expect, it } from "vitest";
import { applyCheckedPrices, chooseAccess, flightDetailsKnown, markForOtherDates, stayGroupCents, stayShareCents, totalPerPersonCents } from "../src/index.ts";
import { proposal } from "./fixtures.ts";

// Lisbon: 98 € out + 102 € back per person; the flat is 204 € a night.
const lis = proposal("lis", "Lisboa", "LIS");

describe("checked prices", () => {
  it("shows the stay as the whole group pays it, and each person's share", () => {
    expect(stayGroupCents(lis.stays, 7)).toBe(142800);
    expect(stayShareCents(lis.stays, 7, 6)).toBe(23800);
    expect(stayGroupCents([], 7)).toBeNull();
  });

  it("stores one person's flight and the whole stay, and adds up again", () => {
    const p = applyCheckedPrices(lis, { flightCents: 25000, stayCents: 168000 }, 7);
    // 250 € there and back, split between the legs like research found (49% / 51%).
    expect(p.outbound.priceCents + p.inbound.priceCents).toBe(25000);
    expect(p.outbound.priceCents).toBe(12250);
    expect(p.stays[0]!.nightlyCents).toBe(24000);
    expect(stayGroupCents(p.stays, 7)).toBe(168000);
    expect(totalPerPersonCents(p, 7, 6)).toBe(25000 + 28000);
  });

  it("leaves the stay alone without a stay total, and halves free flights", () => {
    const free = { ...lis, outbound: { ...lis.outbound, priceCents: 0 }, inbound: { ...lis.inbound, priceCents: 0 } };
    const p = applyCheckedPrices(free, { flightCents: 10000 }, 7);
    expect([p.outbound.priceCents, p.inbound.priceCents]).toEqual([5000, 5000]);
    expect(p.stays).toEqual(lis.stays);
  });
});

describe("what was checked with the prices", () => {
  const twoStays = { ...lis, stays: [lis.stays[0]!, { name: "Hotel en Baixa", kind: "Hotel", nightlyCents: 30000, recommended: false }] };

  it("keeps only the checked stay, with its own name, description and link", () => {
    const p = applyCheckedPrices(twoStays, { flightCents: 20000, stayCents: 140000, stay: { name: "Piso en Graça", url: "https://www.airbnb.es/rooms/1" } }, 7);
    expect(p.stays).toEqual([{ name: "Piso en Graça", kind: "Apartamento", description: undefined, url: "https://www.airbnb.es/rooms/1", nightlyCents: 20000, recommended: true }]);
    // No stay price: research's options stay as they were.
    expect(applyCheckedPrices(twoStays, { flightCents: 20000 }, 7).stays).toEqual(twoStays.stays);
  });

  it("takes the flights' real times from a screenshot, keeping the checked price", () => {
    const leg = { from: "MAD", to: "LIS", departAt: "2026-11-07T11:55:00+01:00", arriveAt: "2026-11-07T12:20:00+00:00", carrier: "Iberia", flightNumber: "IB3102", stops: 0 };
    const back = { ...leg, from: "LIS", to: "MAD", flightNumber: "IB3107", departAt: "2026-11-14T13:00:00+00:00", arriveAt: "2026-11-14T15:20:00+01:00" };
    const p = applyCheckedPrices(lis, { flightCents: 18000, outbound: leg, inbound: back }, 7);
    expect(p.outbound).toEqual({ ...leg, priceCents: 8820 });
    expect(p.inbound).toEqual({ ...back, priceCents: 9180 });
  });

  it("shows flight times unless the organiser checked only the price", () => {
    expect(flightDetailsKnown({ provenance: { kind: "claude", sources: [{ label: "x", url: "https://x.org" }] } })).toBe(true);
    expect(flightDetailsKnown({ provenance: { kind: "api", provider: "duffel", checkedAt: "2026-09-26T10:00:00Z" } })).toBe(true);
    expect(flightDetailsKnown({ provenance: { kind: "organiser", checkedAt: "2026-09-26T10:00:00Z", sources: [] } })).toBe(false);
    expect(flightDetailsKnown({ provenance: { kind: "organiser", checkedAt: "2026-09-26T10:00:00Z", sources: [], flightDetails: true } })).toBe(true);
  });
});

describe("markForOtherDates", () => {
  it("makes checked prices stale and hides their flight times; leaves research's alone", async () => {
    const { trustState, trustLabel } = await import("../src/index.ts");
    const now = new Date("2026-09-26T12:00:00Z");
    const checked = { ...lis, provenance: { kind: "organiser" as const, checkedAt: "2026-09-26T10:00:00Z", sources: [], flightDetails: true } };
    const moved = markForOtherDates(checked);
    expect(moved.provenance).toEqual({ kind: "organiser", checkedAt: "2026-09-26T10:00:00Z", sources: [], forOtherDates: true });
    const state = trustState(moved.provenance, now);
    expect(state).toMatchObject({ kind: "stale", otherDates: true });
    expect(trustLabel(state, "organiser")).toBe("Precio de otras fechas");
    expect(flightDetailsKnown(moved)).toBe(false);
    const api = markForOtherDates({ ...lis, provenance: { kind: "api" as const, provider: "duffel" as const, checkedAt: "2026-09-26T10:00:00Z" } });
    expect(flightDetailsKnown(api)).toBe(false);
    const research = { ...lis, provenance: { kind: "claude" as const, sources: [{ label: "x", url: "https://x.org" }] } };
    expect(markForOtherDates(research)).toBe(research);
  });
});

describe("getting to the departure airport (ROADMAP 2.3)", () => {
  const access = { home: "Logroño", mode: "car" as const, title: "Coche hasta Madrid, 2 coches", minutes: 210, cents: 3500 };

  it("counts in the total when it's known, and only then", () => {
    const base = totalPerPersonCents(lis, 7, 6);
    expect(totalPerPersonCents({ ...lis, access }, 7, 6)).toBe(base + 3500);
  });

  it("is corrected along with the checked prices, and marked as checked", () => {
    const p = applyCheckedPrices({ ...lis, access }, { flightCents: 25000, accessCents: 2800 }, 7);
    expect(p.access).toEqual({ ...access, cents: 2800, checked: true });
    expect(applyCheckedPrices({ ...lis, access }, { flightCents: 25000 }, 7).access).toEqual(access);
    // Nothing to correct without research's estimate.
    expect(applyCheckedPrices(lis, { flightCents: 25000, accessCents: 2800 }, 7)).not.toHaveProperty("access");
  });
});

describe("choosing another way to the airport", () => {
  const car = { mode: "car" as const, title: "Coche", minutes: 120, cents: 3400 };
  const bus = { mode: "bus" as const, title: "Autobús", minutes: 190, cents: 4200 };
  const train = { mode: "train" as const, title: "Tren", minutes: 170, cents: 5600 };
  const access = { ...car, home: "Logroño", alternatives: [bus, train] };

  it("swaps the one that counts with the alternative picked", () => {
    expect(chooseAccess(access, 1)).toEqual({ ...train, home: "Logroño", alternatives: [bus, car] });
    expect(chooseAccess(access, 7)).toBe(access);
  });

  it("goes with the checked prices, and can be corrected at the same time", () => {
    const p = applyCheckedPrices({ ...lis, access }, { flightCents: 25000, accessChoice: 0, accessCents: 4000 }, 7);
    expect(p.access).toEqual({ ...bus, cents: 4000, checked: true, home: "Logroño", alternatives: [car, train] });
    expect(totalPerPersonCents(p, 7, 6)).toBe(25000 + stayShareCents(lis.stays, 7, 6)! + 4000);
  });
});
