import { describe, expect, it } from "vitest";
import { effectiveStatus, totalPerPersonCents, trustLabel, trustState } from "../src/index.ts";

const now = new Date("2026-10-10T12:00:00Z");
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString();

describe("trust", () => {
  it("claude provenance is always unverified", () => {
    const s = trustState({ kind: "claude", sources: [{ label: "x", url: "https://x.test" }] }, now);
    expect(s.kind).toBe("unverified");
    expect(trustLabel(s)).toBe("Lo escribió Claude");
  });

  it("api provenance goes stale after 72 hours", () => {
    const fresh = trustState({ kind: "api", provider: "duffel", checkedAt: hoursAgo(71) }, now);
    const stale = trustState({ kind: "api", provider: "duffel", checkedAt: hoursAgo(73) }, now);
    expect(fresh.kind).toBe("verified");
    expect(stale.kind).toBe("stale");
    expect(trustLabel(stale)).toBe("Verificado hace 3 días");
    expect(trustLabel(trustState({ kind: "api", provider: "duffel", checkedAt: hoursAgo(5) }, now))).toBe(
      "Verificado hace 5 h",
    );
  });
});

describe("effectiveStatus", () => {
  const base = { status: "voting" as const, partySize: 6, voteDeadline: "2026-10-15T20:00:00Z" };

  it("stays open until the sixth ballot or the deadline", () => {
    expect(effectiveStatus({ ...base, ballotsCast: 5 }, now)).toBe("voting");
    expect(effectiveStatus({ ...base, ballotsCast: 6 }, now)).toBe("closed");
    expect(effectiveStatus({ ...base, ballotsCast: 2 }, new Date("2026-10-15T20:00:00Z"))).toBe("closed");
  });

  it("never reopens a draft or a closed plan", () => {
    expect(effectiveStatus({ ...base, status: "draft", ballotsCast: 6 }, now)).toBe("draft");
    expect(effectiveStatus({ ...base, status: "closed", ballotsCast: 0 }, now)).toBe("closed");
  });
});

describe("totalPerPersonCents", () => {
  const leg = (priceCents: number) => ({
    from: "MAD",
    to: "LIS",
    departAt: "2026-11-07T08:00:00Z",
    arriveAt: "2026-11-07T08:20:00Z",
    carrier: "TAP",
    flightNumber: "TP1015",
    stops: 0,
    priceCents,
  });

  it("adds a person's share of the recommended stay to the flights", () => {
    const total = totalPerPersonCents(
      {
        outbound: leg(9000),
        inbound: leg(8000),
        stays: [
          { name: "Barato", kind: "Hostal", nightlyCents: 12000, recommended: false },
          { name: "Recomendado", kind: "Apartamento", nightlyCents: 20400, recommended: true },
        ],
      },
      7,
      6,
    );
    expect(total).toBe(17000 + 23800); // 204 € × 7 / 6 = 238 €
  });

  it("falls back to the cheapest stay, then to flights only", () => {
    const stays = [
      { name: "A", kind: "Hotel", nightlyCents: 30000, recommended: false },
      { name: "B", kind: "Hotel", nightlyCents: 18000, recommended: false },
    ];
    expect(totalPerPersonCents({ outbound: leg(1), inbound: leg(1), stays }, 3, 6)).toBe(2 + 9000);
    expect(totalPerPersonCents({ outbound: leg(1), inbound: leg(1), stays: [] }, 3, 6)).toBe(2);
  });
});
