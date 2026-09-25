import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/*/test/**/*.test.ts", "apps/*/web/test/**/*.test.{ts,tsx}", "packages/ui/test/**/*.test.{ts,tsx}", "apps/*/test/**/*.test.ts"],
  },
});
