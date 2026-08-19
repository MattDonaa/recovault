import { describe, expect, it } from "vitest";

import { analyzeScenario } from "@/lib/marketplace/analysis";

describe("mock-mode analysis (in-memory pipeline)", () => {
  it("matches the recovery engine outputs for each scenario", async () => {
    const healthy = await analyzeScenario("healthy");
    expect(healthy.candidates).toHaveLength(0);

    const disc = await analyzeScenario("shipment-discrepancy");
    expect(disc.candidates).toHaveLength(1);
    expect(disc.candidates[0]).toMatchObject({ ruleId: "MR-001", confidence: "HIGH" });

    const ret = await analyzeScenario("return-mismatch");
    expect(ret.candidates[0]).toMatchObject({
      ruleId: "MR-002",
      confidence: "MEDIUM",
      potentialRecoveryMinor: 19900,
    });

    const rev = await analyzeScenario("payment-reversal");
    expect(rev.candidates[0]).toMatchObject({
      ruleId: "MR-003",
      potentialRecoveryMinor: 99500,
    });
  });

  it("is deterministic across runs", async () => {
    const a = await analyzeScenario("stock-loss-unpaid");
    const b = await analyzeScenario("stock-loss-unpaid");
    expect(a.candidates).toEqual(b.candidates);
    expect(a.candidates[0]).toMatchObject({ ruleId: "MR-003", confidence: "HIGH" });
  });
});
