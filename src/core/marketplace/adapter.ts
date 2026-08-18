import type {
  Balance,
  ConnectionStatus,
  Offer,
  Return,
  Sale,
  SellerMetadata,
  Shipment,
  Transaction,
} from "@/core/marketplace/dto";
import type { ListParams, Page } from "@/core/marketplace/pagination";

/**
 * The generic marketplace integration contract. Core services depend ONLY on
 * this interface — never on a concrete marketplace's SDK, schemas, auth, or
 * identifiers. Concrete per-marketplace adapters (and the mock) live under
 * `src/integrations/<marketplace>/`.
 */
export interface MarketplaceCapabilities {
  offers: boolean;
  sales: boolean;
  returns: boolean;
  shipments: boolean;
  transactions: boolean;
  balances: boolean;
}

export interface MarketplaceAdapter {
  readonly marketplace: string;
  readonly mode: "mock" | "live";
  readonly capabilities: MarketplaceCapabilities;

  verifyConnection(): Promise<ConnectionStatus>;
  listSellerMetadata(): Promise<SellerMetadata>;

  listOffers(params?: ListParams): Promise<Page<Offer>>;
  listSales(params?: ListParams): Promise<Page<Sale>>;
  listReturns(params?: ListParams): Promise<Page<Return>>;
  listShipments(params?: ListParams): Promise<Page<Shipment>>;
  listTransactions(params?: ListParams): Promise<Page<Transaction>>;

  /** Present only when `capabilities.balances` is true. */
  listBalances?(): Promise<Balance[]>;
}
