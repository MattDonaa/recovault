import { describe, expect, it } from "vitest";

import { collectAll } from "@/core/marketplace/pagination";
import { TakealotMarketplaceAdapter } from "@/integrations/takealot/adapter";
import type { FetchLike } from "@/integrations/takealot/transport";
import {
  disbursementPayload,
  envelope,
  feeTransactionPayload,
  offerPayload,
  returnPayload,
  salePayload,
  sellerPayload,
  shipmentPayload,
  stockLossTransactionPayload,
} from "../fixtures/takealot-payloads";

const KEY = "adapter-secret-key-DO-NOT-LEAK";

interface Recorded {
  path: string;
  continuation: string | null;
  key: string | undefined;
}

/** Router mock fetch that records every request and keys off path + cursor. */
function makeFetch(
  routes: (path: string, continuation: string | null) => { status: number; body: unknown },
  recorded: Recorded[],
): FetchLike {
  return (url, init) => {
    const u = new URL(url);
    const path = u.pathname.replace(/^\/v1/, "");
    const continuation = u.searchParams.get("continuation_token");
    recorded.push({ path, continuation, key: init.headers["X-API-Key"] });
    const { status, body } = routes(path, continuation);
    return Promise.resolve({
      status,
      ok: status >= 200 && status < 300,
      json: async () => body,
      text: async () => JSON.stringify(body),
    });
  };
}

function standardRoutes(path: string, continuation: string | null) {
  switch (path) {
    case "/seller":
      return { status: 200, body: sellerPayload };
    case "/offers":
      // Two pages via continuation token.
      return continuation === "page2"
        ? { status: 200, body: envelope([{ ...offerPayload, offer_id: 2, sku: "SKU-B" }], null) }
        : { status: 200, body: envelope([offerPayload], "page2") };
    case "/sales":
      return { status: 200, body: envelope([salePayload]) };
    case "/returns":
      return { status: 200, body: envelope([returnPayload]) };
    case "/shipments":
      return { status: 200, body: envelope([shipmentPayload]) };
    case "/transactions":
      return { status: 200, body: envelope([stockLossTransactionPayload, feeTransactionPayload]) };
    case "/balances":
      return { status: 200, body: disbursementPayload };
    default:
      return { status: 404, body: { message: "not found" } };
  }
}

function adapterWith(
  routes: (p: string, c: string | null) => { status: number; body: unknown },
  recorded: Recorded[] = [],
) {
  return new TakealotMarketplaceAdapter({ apiKey: KEY, fetchImpl: makeFetch(routes, recorded) });
}

describe("TakealotMarketplaceAdapter — contract suite (mocked HTTP)", () => {
  it("verifies connection and declares full capabilities", async () => {
    const adapter = adapterWith(standardRoutes);
    const status = await adapter.verifyConnection();
    expect(status.ok).toBe(true);
    expect(status.mode).toBe("live");
    expect(adapter.marketplace).toBe("takealot");
    expect(adapter.capabilities).toMatchObject({ offers: true, balances: true });
  });

  it("reports a sanitized failure (no key) when the API rejects the key", async () => {
    const recorded: Recorded[] = [];
    const adapter = adapterWith(
      (p) => (p === "/seller" ? { status: 403, body: { errors: [] } } : { status: 200, body: {} }),
      recorded,
    );
    const status = await adapter.verifyConnection();
    expect(status.ok).toBe(false);
    expect(status.message ?? "").not.toContain(KEY);
  });

  it("maps seller metadata", async () => {
    const seller = await adapterWith(standardRoutes).listSellerMetadata();
    expect(seller).toMatchObject({ externalId: "123456", defaultCurrency: "ZAR" });
  });

  it("drains continuation-token pagination, each record exactly once", async () => {
    const recorded: Recorded[] = [];
    const adapter = adapterWith(standardRoutes, recorded);
    const { records } = await collectAll((c) => adapter.listOffers({ cursor: c }));
    expect(records.map((r) => r.externalId)).toEqual(["987654", "2"]);
    // Two pages were fetched via continuation token.
    const offerCalls = recorded.filter((r) => r.path === "/offers");
    expect(offerCalls).toHaveLength(2);
    expect(offerCalls[1]!.continuation).toBe("page2");
  });

  it("expands a shipment into one canonical record per item", async () => {
    const { records } = await collectAll((c) => adapterWith(standardRoutes).listShipments({ cursor: c }));
    expect(records).toHaveLength(2);
    expect(records.map((r) => r.externalId)).toEqual(["500001", "500002"]);
  });

  it("maps sales, returns, transactions and balances", async () => {
    const adapter = adapterWith(standardRoutes);
    const sales = await collectAll((c) => adapter.listSales({ cursor: c }));
    expect(sales.records[0]).toMatchObject({ externalId: "7778888", quantity: 3 });
    const returns = await collectAll((c) => adapter.listReturns({ cursor: c }));
    expect(returns.records[0]?.outcome).toBe("restocked");
    const tx = await collectAll((c) => adapter.listTransactions({ cursor: c }));
    expect(tx.records.map((t) => t.type)).toEqual(["reimbursement", "fee"]);
    const balances = await adapter.listBalances();
    expect(balances[0]?.currency).toBe("ZAR");
  });

  it("quarantines a malformed item and keeps the valid ones (fail closed)", async () => {
    const routes = (p: string) =>
      p === "/offers"
        ? { status: 200, body: envelope([offerPayload, { offer_id: 5 /* missing fields */ }]) }
        : standardRoutes(p, null);
    const page = await adapterWith(routes).listOffers();
    expect(page.records).toHaveLength(1);
    expect(page.quarantined).toHaveLength(1);
  });

  it("sends the X-API-Key on every request and never exposes it in results", async () => {
    const recorded: Recorded[] = [];
    const adapter = adapterWith(standardRoutes, recorded);
    await collectAll((c) => adapter.listOffers({ cursor: c }));
    await adapter.listBalances();
    expect(recorded.length).toBeGreaterThan(0);
    for (const r of recorded) expect(r.key).toBe(KEY);
    // Nothing the adapter returns should contain the key.
    const balances = await adapter.listBalances();
    expect(JSON.stringify(balances)).not.toContain(KEY);
  });
});
