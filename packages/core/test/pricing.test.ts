import { describe, expect, it } from "vitest";
import { applyCheckedPrices, stayGroupCents, stayShareCents, totalPerPersonCents } from "../src/index.ts";
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
