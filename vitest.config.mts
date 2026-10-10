import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

/**
 * Tests cover the pure logic that security and correctness depend on:
 * validation schemas, permission helpers and pipeline filtering. No jsdom or
 * component rendering - the deadline is short and these are the parts where a
 * silent regression would actually matter.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
