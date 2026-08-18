import { describe, expect, it } from "vitest";

import { parseEnv } from "@/lib/env";

describe("environment validation", () => {
  it("applies safe defaults when optional app vars are absent", () => {
    const env = parseEnv({});
    expect(env.NEXT_PUBLIC_APP_NAME).toBe("RecoVault");
    expect(env.NEXT_PUBLIC_APP_ENV).toBe("development");
    expect(env.NODE_ENV).toBe("development");
  });

  it("accepts a valid explicit environment", () => {
    const env = parseEnv({
      NODE_ENV: "test",
      NEXT_PUBLIC_APP_NAME: "RecoVault",
      NEXT_PUBLIC_APP_ENV: "test",
    });
    expect(env.NEXT_PUBLIC_APP_ENV).toBe("test");
  });

  it("fails closed on an invalid enum value", () => {
    expect(() => parseEnv({ NEXT_PUBLIC_APP_ENV: "staging" })).toThrow(
      /Invalid environment configuration/,
    );
  });
});
