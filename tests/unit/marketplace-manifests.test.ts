import { describe, expect, it } from "vitest";

import { RECORD_SCHEMAS } from "@/core/marketplace/dto";
import { validateManifest } from "@/core/marketplace/scenario";
import { validateBatch } from "@/core/marketplace/validation";
import { SCENARIOS } from "@/integrations/mock/fixtures";

const REQUIRED_SCENARIO_KEYS = [
  "healthy",
  "shipment-discrepancy",
  "resolved-shipment",
  "consistent-return",
  "return-mismatch",
  "stock-loss-paid",
  "stock-loss-unpaid",
  "payment-reversal",
  "duplicate-retry",
  "malformed-payload",
  "empty-account",
  "large-account",
];

describe("scenario manifests", () => {
  it("covers all 12 mandatory scenarios", () => {
    const keys = SCENARIOS.map((s) => s.manifest.key).sort();
    expect(keys).toEqual([...REQUIRED_SCENARIO_KEYS].sort());
  });

  for (const scenario of SCENARIOS) {
    describe(scenario.manifest.key, () => {
      it("has a schema-valid manifest", () => {
        expect(() => validateManifest(scenario.manifest)).not.toThrow();
      });

      it("declares counts that match the fixture data", () => {
        const d = scenario.data;
        const offers = validateBatch("offers", RECORD_SCHEMAS.offers, d.offers);
        const sales = validateBatch("sales", RECORD_SCHEMAS.sales, d.sales);
        const returns = validateBatch("returns", RECORD_SCHEMAS.returns, d.returns);
        const shipments = validateBatch("shipments", RECORD_SCHEMAS.shipments, d.shipments);
        const transactions = validateBatch("transactions", RECORD_SCHEMAS.transactions, d.transactions);
        const balances = validateBatch("balances", RECORD_SCHEMAS.balances, d.balances);

        const actual = {
          offers: offers.valid.length,
          sales: sales.valid.length,
          returns: returns.valid.length,
          shipments: shipments.valid.length,
          transactions: transactions.valid.length,
          balances: balances.valid.length,
          quarantined:
            offers.quarantined.length +
            sales.quarantined.length +
            returns.quarantined.length +
            shipments.quarantined.length +
            transactions.quarantined.length,
        };
        expect(actual).toEqual(scenario.manifest.expected);
      });

      it("contains no marketplace-specific leakage or PII/secret markers", () => {
        const blob = JSON.stringify(scenario).toLowerCase();
        for (const forbidden of [
          "takealot",
          "password",
          "secret",
          "api_key",
          "apikey",
          "bearer ",
        ]) {
          expect(blob).not.toContain(forbidden);
        }
      });
    });
  }
});
