import { defineConfig, devices } from "@playwright/test";

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // Run against a production build: precompiled and deterministic, avoiding
    // dev on-demand compilation latency/flakiness.
    command: "npm run build && npm run start",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    env: {
      // Deterministic session signing for E2E.
      AUTH_SESSION_SECRET: "e2e-session-secret-not-in-client-1234567890",
      // Server-only secret sentinels. Auth stays in MOCK mode because the
      // NEXT_PUBLIC_SUPABASE_* pair is intentionally absent (live mode needs all
      // three). The secret-exposure test asserts these never reach the client.
      SUPABASE_SERVICE_ROLE_KEY: "svc_role_SECRET_SENTINEL_DO_NOT_LEAK",
      // Valid 32-byte (hex) AES key; its value is a sentinel that must never
      // reach the client. Marketplace credentials are encrypted with it.
      MARKETPLACE_ENCRYPTION_KEY:
        "e2e0e2e0aaaa1111bbbb2222cccc3333dddd4444eeee5555ffff6666a7b8c9d0",
    },
  },
});

/** Secret sentinels shared with tests/e2e/secret-exposure.spec.ts. */
export const SECRET_SENTINELS = [
  "e2e-session-secret-not-in-client-1234567890",
  "svc_role_SECRET_SENTINEL_DO_NOT_LEAK",
  "e2e0e2e0aaaa1111bbbb2222cccc3333dddd4444eeee5555ffff6666a7b8c9d0",
];
