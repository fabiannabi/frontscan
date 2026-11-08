import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/*/test/**/*.test.ts"],
    // Fixtures are small repos the lenses scan; they are data, never tests.
    exclude: ["**/fixtures/**", "**/node_modules/**"],
  },
});
