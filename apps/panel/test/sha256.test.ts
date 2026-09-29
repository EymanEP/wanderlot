import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { sha256Hex } from "../src/sha256.ts";

describe("sha256Hex", () => {
  it("matches node:crypto, so fingerprints saved before still match", () => {
    const inputs = ["", "abc", "a".repeat(55), "a".repeat(56), "a".repeat(64), "Nápoles · 7–14 nov 🍕", JSON.stringify({ x: "y".repeat(5000) })];
    for (const s of inputs) expect(sha256Hex(s)).toBe(createHash("sha256").update(s).digest("hex"));
  });
});
