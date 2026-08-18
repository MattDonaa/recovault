import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    // PGlite (real Postgres in WASM) cold-starts and applies migrations in the
    // integration suites; allow generous time for setup and long-running cases.
    hookTimeout: 60_000,
    testTimeout: 60_000,
    // Playwright specs live in tests/e2e and must never be collected by Vitest.
    include: ["tests/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["tests/e2e/**", "node_modules/**", ".next/**"],
  },
});
