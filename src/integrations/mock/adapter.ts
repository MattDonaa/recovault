import type { ZodType, ZodTypeDef } from "zod";

import type { MarketplaceAdapter, MarketplaceCapabilities } from "@/core/marketplace/adapter";
import {
  balanceSchema,
  offerSchema,
  returnSchema,
  saleSchema,
  sellerMetadataSchema,
  shipmentSchema,
  transactionSchema,
  type Balance,
  type ConnectionStatus,
  type Offer,
  type Return,
  type Sale,
  type SellerMetadata,
  type Shipment,
  type Transaction,
} from "@/core/marketplace/dto";
import {
  DEFAULT_PAGE_SIZE,
  type ListParams,
  type Page,
} from "@/core/marketplace/pagination";
import type { ScenarioFixture } from "@/core/marketplace/scenario";
import { validateBatch, validateBatchStrict } from "@/core/marketplace/validation";

const MOCK_CAPABILITIES: MarketplaceCapabilities = {
  offers: true,
  sales: true,
  returns: true,
  shipments: true,
  transactions: true,
  balances: true,
};

/**
 * Contract-faithful mock marketplace adapter. It serves a synthetic fixture
 * scenario through the generic MarketplaceAdapter contract: validating raw
 * payloads at the boundary (fail closed → quarantine), and paginating
 * deterministically so every record is yielded exactly once.
 */
export class MockMarketplaceAdapter implements MarketplaceAdapter {
  readonly marketplace = "mock";
  readonly mode = "mock" as const;
  readonly capabilities = MOCK_CAPABILITIES;

  private readonly pageSize: number;

  constructor(
    private readonly fixture: ScenarioFixture,
    options: { pageSize?: number } = {},
  ) {
    this.pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
  }

  get scenarioKey(): string {
    return this.fixture.manifest.key;
  }

  async verifyConnection(): Promise<ConnectionStatus> {
    return {
      ok: true,
      marketplace: this.marketplace,
      mode: this.mode,
      checkedAt: new Date().toISOString(),
      message: "MOCK adapter — synthetic data, not a real seller",
    };
  }

  async listSellerMetadata(): Promise<SellerMetadata> {
    // Fail closed: a malformed seller is a hard error, not a silent default.
    return sellerMetadataSchema.parse(this.fixture.data.seller);
  }

  private paginate<T>(
    kind: string,
    schema: ZodType<T, ZodTypeDef, unknown>,
    raws: readonly unknown[],
    params: ListParams | undefined,
  ): Page<T> {
    const { valid, quarantined } = validateBatch(kind, schema, raws);
    const size = params?.pageSize ?? this.pageSize;
    const start = params?.cursor ? Number.parseInt(params.cursor, 10) : 0;
    const safeStart = Number.isFinite(start) && start > 0 ? start : 0;
    const slice = valid.slice(safeStart, safeStart + size);
    const nextIndex = safeStart + size;
    return {
      records: slice,
      nextCursor: nextIndex < valid.length ? String(nextIndex) : null,
      // Surface quarantined records once, on the first page.
      quarantined: safeStart === 0 ? quarantined : [],
    };
  }

  async listOffers(params?: ListParams): Promise<Page<Offer>> {
    return this.paginate("offers", offerSchema, this.fixture.data.offers, params);
  }

  async listSales(params?: ListParams): Promise<Page<Sale>> {
    return this.paginate("sales", saleSchema, this.fixture.data.sales, params);
  }

  async listReturns(params?: ListParams): Promise<Page<Return>> {
    return this.paginate("returns", returnSchema, this.fixture.data.returns, params);
  }

  async listShipments(params?: ListParams): Promise<Page<Shipment>> {
    return this.paginate("shipments", shipmentSchema, this.fixture.data.shipments, params);
  }

  async listTransactions(params?: ListParams): Promise<Page<Transaction>> {
    return this.paginate("transactions", transactionSchema, this.fixture.data.transactions, params);
  }

  async listBalances(): Promise<Balance[]> {
    // Balances are not paginated; fail closed on any malformed balance.
    return validateBatchStrict("balances", balanceSchema, this.fixture.data.balances);
  }
}
