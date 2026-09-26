import { describe, expect, it } from "vitest";
import { applyGroupTotals, groupFlightsCents, stayGroupCents, stayShareCents, totalPerPersonCents } from "../src/index.ts";
import { proposal } from "./fixtures.ts";

// Lisbon: 98 € out + 102 € back per person; the flat is 204 € a night.
const lis = proposal("lis", "Lisboa", "LIS");

describe("group totals", () => {
  it("shows the flights and the stay as the whole group pays them", () => {
    expect(groupFlightsCents(lis, 6)).toBe(120000);
    expect(stayGroupCents(lis.stays, 7)).toBe(142800);
    expect(stayShareCents(lis.stays, 7, 6)).toBe(23800);
    expect(stayGroupCents([], 7)).toBeNull();
  });

  it("stores hand-checked totals per person and per night, and adds up again", () => {
    const p = applyGroupTotals(lis, { flightsCents: 150000, stayCents: 168000 }, 7, 6);
    // 250 € each, split between the legs like research found (49% / 51%).
    expect(p.outbound.priceCents + p.inbound.priceCents).toBe(25000);
    expect(p.outbound.priceCents).toBe(12250);
    expect(p.stays[0]!.nightlyCents).toBe(24000);
    expect(totalPerPersonCents(p, 7, 6)).toBe(25000 + 28000);
    expect(groupFlightsCents(p, 6)).toBe(150000);
    expect(stayGroupCents(p.stays, 7)).toBe(168000);
  });

  it("leaves the stay alone without a stay total, and halves free flights", () => {
    const free = { ...lis, outbound: { ...lis.outbound, priceCents: 0 }, inbound: { ...lis.inbound, priceCents: 0 } };
    const p = applyGroupTotals(free, { flightsCents: 60000 }, 7, 6);
    expect([p.outbound.priceCents, p.inbound.priceCents]).toEqual([5000, 5000]);
    expect(p.stays).toEqual(lis.stays);
  });
});
