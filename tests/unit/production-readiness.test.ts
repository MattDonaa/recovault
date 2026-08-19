import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { REQUIRED_PRODUCTION_ENV, validateProductionEnv } from "@/lib/env.server";
import { captureException, redactSecrets } from "@/lib/observability";

describe("production env validation", () => {
  it("passes when all required vars are present", () => {
    const env: Record<string, string> = {};
    for (const key of REQUIRED_PRODUCTION_ENV) env[key] = "x";
    expect(() => validateProductionEnv(env)).not.toThrow();
  });

  it("fails closed listing every missing var", () => {
    expect(() => validateProductionEnv({})).toThrow(/Missing required production environment variables/);
    try {
      validateProductionEnv({ AUTH_SESSION_SECRET: "x" });
    } catch (e) {
      expect((e as Error).message).toContain("MARKETPLACE_ENCRYPTION_KEY");
      expect((e as Error).message).not.toContain("AUTH_SESSION_SECRET");
    }
  });
});

describe("observability redaction", () => {
  it("redacts sensitive keys and token-shaped values", () => {
    const out = redactSecrets({
      apiKey: "secret-value",
      note: "eyJhbGciOiJIUzI1Ni9.payload.sig",
      nested: { password: "p", ok: "fine" },
    }) as Record<string, unknown>;
    expect(out.apiKey).toBe("***");
    expect(out.note).toContain("***");
    expect((out.nested as Record<string, unknown>).password).toBe("***");
    expect((out.nested as Record<string, unknown>).ok).toBe("fine");
  });

  it("captureException never throws", () => {
    expect(() => captureException(new Error("boom"), { apiKey: "s" })).not.toThrow();
  });
});

describe("clean-clone configurability (AC-05 proxy)", () => {
  it("every env var used in src is documented in .env.example", () => {
    const envExample = readFileSync(path.resolve(process.cwd(), ".env.example"), "utf8");
    const documented = new Set(
      envExample
        .split("\n")
        .map((l) => l.match(/^([A-Z0-9_]+)=/)?.[1])
        .filter((x): x is string => Boolean(x)),
    );
    // NODE_ENV is provided by the runtime, not the .env file.
    documented.add("NODE_ENV");

    const used = new Set<string>();
    for (const file of walk(path.resolve(process.cwd(), "src"))) {
      const text = readFileSync(file, "utf8");
      for (const m of text.matchAll(/process\.env\.([A-Z0-9_]+)/g)) used.add(m[1]!);
      for (const m of text.matchAll(/source\.([A-Z0-9_]+)/g)) used.add(m[1]!);
    }

    const undocumented = [...used].filter((k) => !documented.has(k));
    expect(undocumented).toEqual([]);
  });
});

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (full.endsWith(".ts") || full.endsWith(".tsx")) out.push(full);
  }
  return out;
}
