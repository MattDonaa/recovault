import { describe, expect, it } from "vitest";

import { getServerEnv } from "@/lib/env.server";

const valid = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-key",
};

describe("server environment validation", () => {
  it("parses a complete server environment", () => {
    const env = getServerEnv(valid);
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe("https://example.supabase.co");
  });

  it("fails closed when the service-role key is missing", () => {
    const { SUPABASE_SERVICE_ROLE_KEY: _omit, ...partial } = valid;
    void _omit;
    expect(() => getServerEnv(partial)).toThrow(
      /Invalid server environment configuration/,
    );
  });

  it("fails closed on a non-URL Supabase URL", () => {
    expect(() =>
      getServerEnv({ ...valid, NEXT_PUBLIC_SUPABASE_URL: "not-a-url" }),
    ).toThrow(/Invalid server environment configuration/);
  });
});
