// What the AI and the group chat get in the group's language (ROADMAP 4).
import { describe, expect, it } from "vitest";
import { snapshot } from "../../../packages/core/test/fixtures.ts";
import { datesChosenMessage, leaveReminderMessage, voteClosedMessage, voteOpenedMessage, voteReminderMessage } from "../src/announce.ts";
import { extractPrompt } from "../src/providers/extract.ts";
import { guidePrompt, type GuideRequest } from "../src/providers/guide.ts";

const plan = { id: "noviembre-2026", name: "Noviembre 2026" };
const site = "https://viajes.example/";
const deadline = "2026-10-10T21:59:00Z";

describe("the group chat's messages", () => {
  it("stay as they were in Spanish", () => {
    expect(voteOpenedMessage(plan, deadline, site, [])).toContain("Abierta la votación de Noviembre 2026.");
    expect(voteReminderMessage(plan, deadline, site, ["Laura", "Diego"])).toContain("Faltan Laura y Diego por votar Noviembre 2026.");
    expect(voteClosedMessage(plan, "Lisboa", site)).toBe("Votación de Noviembre 2026 cerrada: nos vamos a Lisboa. Recuento completo en https://viajes.example/p/noviembre-2026");
  });

  it("are written in English for an English group", () => {
    const opened = voteOpenedMessage(plan, deadline, site, [{ name: "Laura", url: "https://viajes.example/i/x" }], "en");
    expect(opened).toContain("Voting for Noviembre 2026 is open.");
    expect(opened).toContain("before Saturday 10 October at 23:59.");
    expect(opened).toContain("• Laura: https://viajes.example/i/x");
    expect(voteReminderMessage(plan, deadline, site, ["Laura"], "en")).toContain("Laura still needs to vote for Noviembre 2026.");
    expect(voteReminderMessage(plan, deadline, site, ["Laura", "Diego"], "en")).toContain("Laura and Diego still need to vote");
    expect(voteClosedMessage(plan, "Lisbon", site, "Porto", "en")).toContain("Porto won, but in the end we're going to Lisbon.");
    expect(datesChosenMessage(plan, { id: "a", dateFrom: "2026-11-07", dateTo: "2026-11-14" }, site, "en")).toContain("decided: 7 – 14 Nov.");
    expect(leaveReminderMessage(plan, { dateFrom: "2026-11-07", dateTo: "2026-11-14" }, site, ["Diego"], "en")).toContain("Diego still needs to confirm.");
  });
});

describe("what the AI writes", () => {
  const trip = snapshot([]).plan;
  const guide: GuideRequest = { city: "Lisboa", country: "Portugal", iata: "LIS", origin: "MAD", home: "", dateFrom: trip.dateFrom, dateTo: trip.dateTo, nights: 7, partySize: 6 };

  it("is the guide in the group's language", () => {
    expect(guidePrompt(guide)).toContain("en español de España");
    expect(guidePrompt({ ...guide, locale: "en" })).toContain("British English");
  });

  it("is the stay's description, read from a screenshot, in the group's language", () => {
    const context = { origin: "MAD", city: "Lisboa", iata: "LIS", dateFrom: trip.dateFrom, dateTo: trip.dateTo, nights: 7, partySize: 6 };
    expect(extractPrompt({ kind: "stay", images: [], context, locale: "en" })).toContain("British English");
    expect(extractPrompt({ kind: "flight", images: [], context, locale: "en" })).not.toContain("British English");
  });
});
