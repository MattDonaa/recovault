import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const CORE_DIR = path.resolve(process.cwd(), "src", "core");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (full.endsWith(".ts") || full.endsWith(".tsx")) out.push(full);
  }
  return out;
}

describe("core purity (marketplace-agnostic)", () => {
  const files = walk(CORE_DIR);

  it("finds core source files to check", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("contains no marketplace-specific names in src/core", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8").toLowerCase();
      if (text.includes("takealot")) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });

  it("does not import concrete adapters (@/integrations) from src/core", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      if (/from\s+["']@\/integrations/.test(text)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });
});
