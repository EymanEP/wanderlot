import { describe, expect, it } from "vitest";
import { Source } from "../src/model.ts";

describe("links", () => {
  it("accepts web addresses only", () => {
    expect(Source.safeParse({ label: "TAP", url: "https://www.flytap.com/" }).success).toBe(true);
    for (const url of ["javascript:alert(1)", "data:text/html,hi", "ftp://x.test/a"]) {
      expect(Source.safeParse({ label: "x", url }).success).toBe(false);
    }
  });
});
