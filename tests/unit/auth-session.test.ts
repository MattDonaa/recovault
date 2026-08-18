import { describe, expect, it } from "vitest";

import {
  createSessionToken,
  getSessionSecret,
  verifySessionToken,
} from "@/core/auth/session";

const user = { id: "u-1", email: "a@example.test" };
const secret = "unit-test-session-secret-0123456789";

describe("session tokens", () => {
  it("round-trips a valid token", () => {
    const token = createSessionToken(user, { secret });
    expect(verifySessionToken(token, { secret })).toEqual(user);
  });

  it("rejects a tampered payload", () => {
    const token = createSessionToken(user, { secret });
    const [, sig] = token.split(".");
    const forgedBody = Buffer.from(
      JSON.stringify({ sub: "attacker", email: "e@x.t", iat: 0, exp: 9e9 }),
    ).toString("base64url");
    expect(verifySessionToken(`${forgedBody}.${sig}`, { secret })).toBeNull();
  });

  it("rejects a token signed with a different secret", () => {
    const token = createSessionToken(user, { secret: "other-secret-value-xx" });
    expect(verifySessionToken(token, { secret })).toBeNull();
  });

  it("rejects an expired token", () => {
    const past = Date.now() - 10_000;
    const token = createSessionToken(user, {
      secret,
      now: past,
      maxAgeSec: 1,
    });
    expect(verifySessionToken(token, { secret })).toBeNull();
  });

  it("rejects malformed input", () => {
    expect(verifySessionToken(undefined, { secret })).toBeNull();
    expect(verifySessionToken("not-a-token", { secret })).toBeNull();
  });

  it("requires a strong secret in production", () => {
    expect(() =>
      getSessionSecret({ NODE_ENV: "production", AUTH_SESSION_SECRET: "" }),
    ).toThrow(/AUTH_SESSION_SECRET/);
    expect(
      getSessionSecret({
        NODE_ENV: "production",
        AUTH_SESSION_SECRET: "a-sufficiently-long-secret",
      }),
    ).toBe("a-sufficiently-long-secret");
  });
});
