import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { formatMoneyMinor } from "@/core/money/format";
import type { CandidateSummary } from "@/core/recovery/totals";
import { computeTotals } from "@/core/recovery/totals";
import {
  assertTransition,
  canTransition,
  InvalidTransitionError,
} from "@/core/recovery/workflow";
import { filterCandidates } from "@/lib/marketplace/money-finder-store";
import type { StoredCandidate } from "@/lib/marketplace/money-finder-store";

describe("candidate workflow", () => {
  it("allows only valid transitions", () => {
    expect(canTransition("detected", "investigating")).toBe(true);
    expect(canTransition("detected", "dismissed")).toBe(true);
    expect(canTransition("detected", "accepted")).toBe(false);
    expect(canTransition("investigating", "accepted")).toBe(true);
    expect(canTransition("investigating", "dismissed")).toBe(true);
    expect(canTransition("accepted", "investigating")).toBe(false);
    expect(canTransition("dismissed", "detected")).toBe(false);
  });

  it("throws on invalid transitions", () => {
    expect(() => assertTransition("detected", "accepted")).toThrow(InvalidTransitionError);
    expect(() => assertTransition("accepted", "dismissed")).toThrow(InvalidTransitionError);
  });
});

function sum(
  overrides: Partial<CandidateSummary>,
  amount: number | null,
  status: CandidateSummary["status"],
): CandidateSummary {
  return {
    ruleId: "MR-003",
    confidence: "HIGH",
    status,
    potentialRecoveryMinor: amount,
    currency: amount === null ? null : "ZAR",
    ...overrides,
  };
}

describe("recovery totals", () => {
  it("sums potential recovery over non-dismissed candidates, exactly", () => {
    const totals = computeTotals([
      sum({ ruleId: "MR-003" }, 99500, "detected"),
      sum({ ruleId: "MR-002", confidence: "MEDIUM" }, 19900, "investigating"),
      sum({ ruleId: "MR-001" }, null, "detected"),
      sum({ ruleId: "MR-003" }, 50000, "dismissed"), // excluded from total
    ]);
    expect(totals.potentialRecoveryMinor).toBe(119400); // 99500 + 19900
    expect(totals.candidateCount).toBe(4);
    expect(totals.actionableCount).toBe(3);
    expect(totals.dismissedCount).toBe(1);
    expect(totals.byRule).toMatchObject({ "MR-001": 1, "MR-002": 1, "MR-003": 2 });
    expect(totals.currency).toBe("ZAR");
  });
});

describe("money formatting", () => {
  it("formats exact minor units and handles null", () => {
    expect(formatMoneyMinor(19900, "ZAR")).toMatch(/199[.,]00/);
    expect(formatMoneyMinor(null, "ZAR")).toBe("—");
    expect(formatMoneyMinor(100, null)).toBe("—");
  });
});

function candidate(over: Partial<StoredCandidate>): StoredCandidate {
  return {
    id: "c1",
    organizationId: "org",
    marketplaceAccountId: "acc",
    marketplace: "mock",
    status: "detected",
    detectedAt: "now",
    ruleId: "MR-001",
    ruleVersion: "MR-001:v1",
    candidateKey: "k",
    confidence: "HIGH",
    confidenceScore: 90,
    potentialRecoveryMinor: null,
    currency: null,
    sku: null,
    externalRef: null,
    title: "t",
    summary: "s",
    calculation: {},
    evidence: [],
    ...over,
  };
}

describe("candidate filtering", () => {
  const list = [
    candidate({ id: "a", ruleId: "MR-001", confidence: "HIGH", status: "detected" }),
    candidate({ id: "b", ruleId: "MR-002", confidence: "MEDIUM", status: "investigating" }),
    candidate({ id: "c", ruleId: "MR-003", confidence: "HIGH", status: "dismissed" }),
  ];

  it("filters by rule/confidence/status; empty matches all", () => {
    expect(filterCandidates(list, {}).length).toBe(3);
    expect(filterCandidates(list, { rule: "MR-002" }).map((c) => c.id)).toEqual(["b"]);
    expect(filterCandidates(list, { confidence: "HIGH" }).map((c) => c.id)).toEqual(["a", "c"]);
    expect(filterCandidates(list, { status: "dismissed" }).map((c) => c.id)).toEqual(["c"]);
  });
});

describe("language guardrail", () => {
  const FORBIDDEN = [
    "owes you",
    "guaranteed recovery",
    "guaranteed claim",
    "guaranteed money",
    "confirmed debt",
  ];
  const dirs = [
    path.resolve(process.cwd(), "src", "app", "app", "org"),
    path.resolve(process.cwd(), "src", "components", "recovery"),
    path.resolve(process.cwd(), "src", "components", "marketplace"),
  ];

  function walk(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) out.push(...walk(full));
      else if (full.endsWith(".tsx") || full.endsWith(".ts")) out.push(full);
    }
    return out;
  }

  it("no forbidden liability language in Money Finder UI", () => {
    const offenders: string[] = [];
    for (const dir of dirs) {
      for (const file of walk(dir)) {
        const text = readFileSync(file, "utf8").toLowerCase();
        for (const phrase of FORBIDDEN) {
          if (text.includes(phrase)) offenders.push(`${file}: ${phrase}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
