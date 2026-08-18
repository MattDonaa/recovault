import { describe, expect, it } from "vitest";

import { collectAll } from "@/core/marketplace/pagination";
import { MockMarketplaceAdapter } from "@/integrations/mock/adapter";
import {
  getScenario,
  SCENARIOS,
} from "@/integrations/mock/fixtures";

async function summarize(adapter: MockMarketplaceAdapter) {
  const [offers, sales, returns, shipments, transactions] = await Promise.all([
    collectAll((c) => adapter.listOffers({ cursor: c })),
    collectAll((c) => adapter.listSales({ cursor: c })),
    collectAll((c) => adapter.listReturns({ cursor: c })),
    collectAll((c) => adapter.listShipments({ cursor: c })),
    collectAll((c) => adapter.listTransactions({ cursor: c })),
  ]);
  const balances = await adapter.listBalances();
  return {
    counts: {
      offers: offers.records.length,
      sales: sales.records.length,
      returns: returns.records.length,
      shipments: shipments.records.length,
      transactions: transactions.records.length,
      balances: balances.length,
      quarantined:
        offers.quarantined.length +
        sales.quarantined.length +
        returns.quarantined.length +
        shipments.quarantined.length +
        transactions.quarantined.length,
    },
    sales,
  };
}

describe("MockMarketplaceAdapter — generic contract suite", () => {
  it("declares full capabilities and a mock connection", async () => {
    const adapter = new MockMarketplaceAdapter(getScenario("healthy")!);
    const status = await adapter.verifyConnection();
    expect(status.ok).toBe(true);
    expect(status.mode).toBe("mock");
    expect(adapter.capabilities.balances).toBe(true);
    const seller = await adapter.listSellerMetadata();
    expect(seller.displayName).toMatch(/mock/i);
  });

  // Each fixture's declared manifest counts must match the adapter output.
  for (const scenario of SCENARIOS) {
    it(`matches the manifest for "${scenario.manifest.key}"`, async () => {
      const adapter = new MockMarketplaceAdapter(scenario, { pageSize: 10 });
      const { counts } = await summarize(adapter);
      expect(counts).toEqual(scenario.manifest.expected);
    });
  }

  it("quarantines malformed payloads (fail closed)", async () => {
    const adapter = new MockMarketplaceAdapter(getScenario("malformed-payload")!);
    const offers = await collectAll((c) => adapter.listOffers({ cursor: c }));
    expect(offers.records).toHaveLength(1);
    expect(offers.quarantined).toHaveLength(1);
    expect(offers.quarantined[0]?.reason).toBeTruthy();
    // A malformed seller would be a hard failure, but this fixture's seller is valid.
    await expect(adapter.listSellerMetadata()).resolves.toBeTruthy();
  });

  it("paginates a large account, returning each record exactly once", async () => {
    const scenario = getScenario("large-account")!;
    const adapter = new MockMarketplaceAdapter(scenario, { pageSize: 25 });
    const { records } = await collectAll((c) => adapter.listSales({ cursor: c }));
    expect(records).toHaveLength(137);
    expect(new Set(records.map((r) => r.externalId)).size).toBe(137);
  });

  it("produces deterministic output on retry (duplicate-retry scenario)", async () => {
    const scenario = getScenario("duplicate-retry")!;
    const adapter = new MockMarketplaceAdapter(scenario, { pageSize: 2 });
    const first = await collectAll((c) => adapter.listSales({ cursor: c }));
    const second = await collectAll((c) => adapter.listSales({ cursor: c }));
    expect(second.records).toEqual(first.records);
    // The duplicate external id is preserved for downstream idempotency to dedupe.
    const ids = first.records.map((r) => r.externalId);
    expect(ids.filter((id) => id === "sale-1")).toHaveLength(2);
  });

  it("handles an empty account cleanly", async () => {
    const adapter = new MockMarketplaceAdapter(getScenario("empty-account")!);
    const { counts } = await summarize(adapter);
    expect(counts).toEqual({
      offers: 0,
      sales: 0,
      returns: 0,
      shipments: 0,
      transactions: 0,
      balances: 0,
      quarantined: 0,
    });
  });
});
