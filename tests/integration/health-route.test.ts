import { describe, expect, it } from "vitest";

import { GET } from "@/app/health/route";

describe("health route (integration)", () => {
  it("returns a non-sensitive ok status payload", async () => {
    const response = GET();
    expect(response.status).toBe(200);

    const body = (await response.json()) as Record<string, unknown>;
    expect(body.status).toBe("ok");
    expect(body.milestone).toBe("01-foundation");
    // Must never leak secrets or credential-shaped fields.
    const serialized = JSON.stringify(body).toLowerCase();
    expect(serialized).not.toContain("secret");
    expect(serialized).not.toContain("password");
    expect(serialized).not.toContain("api_key");
  });
});
