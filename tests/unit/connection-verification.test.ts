import { describe, expect, it } from "vitest";

import type { MarketplaceAdapter } from "@/core/marketplace/adapter";
import {
  verifyConnection,
  type VerificationDeps,
} from "@/core/marketplace/verification";

function adapterReturning(ok: boolean, message: string | null = null): MarketplaceAdapter {
  return {
    marketplace: "test",
    mode: ok ? "mock" : "live",
    capabilities: {
      offers: true,
      sales: true,
      returns: true,
      shipments: true,
      transactions: true,
      balances: true,
    },
    verifyConnection: async () => ({
      ok,
      marketplace: "test",
      mode: "mock",
      checkedAt: new Date().toISOString(),
      message,
    }),
    listSellerMetadata: async () => {
      throw new Error("unused");
    },
    listOffers: async () => ({ records: [], nextCursor: null, quarantined: [] }),
    listSales: async () => ({ records: [], nextCursor: null, quarantined: [] }),
    listReturns: async () => ({ records: [], nextCursor: null, quarantined: [] }),
    listShipments: async () => ({ records: [], nextCursor: null, quarantined: [] }),
    listTransactions: async () => ({ records: [], nextCursor: null, quarantined: [] }),
  };
}

function deps(overrides: Partial<VerificationDeps>): VerificationDeps {
  return {
    buildMockAdapter: () => adapterReturning(true),
    buildLiveAdapter: () => adapterReturning(false),
    getCiphertext: () => null,
    decrypt: (c) => c,
    ...overrides,
  };
}

describe("connection verification", () => {
  it("verifies a mock connection without any credential", async () => {
    const result = await verifyConnection(
      { mode: "mock", scenarioKey: "healthy" },
      deps({ getCiphertext: () => null }),
    );
    expect(result.ok).toBe(true);
  });

  it("fails an unknown mock scenario", async () => {
    const result = await verifyConnection(
      { mode: "mock", scenarioKey: "nope" },
      deps({ buildMockAdapter: () => null }),
    );
    expect(result.ok).toBe(false);
  });

  it("cannot verify a live connection with no stored credential", async () => {
    const result = await verifyConnection(
      { mode: "live", scenarioKey: null },
      deps({ getCiphertext: () => null }),
    );
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/no credential/i);
  });

  it("does NOT mark live verified when the adapter check fails", async () => {
    const result = await verifyConnection(
      { mode: "live", scenarioKey: null },
      deps({
        getCiphertext: () => "cipher",
        decrypt: () => "some-key",
        buildLiveAdapter: () => adapterReturning(false, "Invalid API key"),
      }),
    );
    expect(result.ok).toBe(false);
  });

  it("marks live verified ONLY when a real adapter check succeeds", async () => {
    let usedKey = "";
    const result = await verifyConnection(
      { mode: "live", scenarioKey: null },
      deps({
        getCiphertext: () => "cipher",
        decrypt: () => "real-key",
        buildLiveAdapter: (key) => {
          usedKey = key;
          return adapterReturning(true);
        },
      }),
    );
    expect(result.ok).toBe(true);
    expect(usedKey).toBe("real-key"); // decrypted credential was used
  });
});
