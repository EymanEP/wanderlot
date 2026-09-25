import { describe, expect, it } from "vitest";
import { cn } from "../src/cn.ts";

describe("cn", () => {
  it("lets a caller's class override the component's", () => {
    expect(cn("h-11 rounded-xl", "h-[46px]")).toBe("rounded-xl h-[46px]");
    expect(cn("inline-flex items-center", "hidden xl:inline-flex")).toBe("items-center hidden xl:inline-flex");
  });

  it("keeps our custom size and colour tokens apart", () => {
    expect(cn("text-display text-ink")).toBe("text-display text-ink");
    expect(cn("text-ink", "text-muted")).toBe("text-muted");
    expect(cn("shadow-raised", "shadow-pop")).toBe("shadow-pop");
    expect(cn("rounded-2xl", "rounded-card")).toBe("rounded-card");
  });
});
