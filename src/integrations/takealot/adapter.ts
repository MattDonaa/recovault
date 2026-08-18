import type { ZodType, ZodTypeDef } from "zod";

import type { MarketplaceAdapter } from "@/core/marketplace/adapter";
import {
  offerSchema,
  returnSchema,
  saleSchema,
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
import type { ListParams, Page } from "@/core/marketplace/pagination";
import {
  validateBatch,
  type QuarantinedRecord,
} from "@/core/marketplace/validation";

import {
  TAKEALOT_CAPABILITIES,
  TAKEALOT_DEFAULT_LIMIT,
  TAKEALOT_MARKETPLACE,
  TAKEALOT_MAX_LIMIT,
} from "@/integrations/takealot/config";
import { TakealotApiError } from "@/integrations/takealot/errors";
import {
  mapBalances,
  mapOffer,
  mapReturn,
  mapSale,
  mapSeller,
  mapShipment,
  mapTransaction,
} from "@/integrations/takealot/mapper";
import {
  takealotDisbursementSchema,
  takealotEnvelopeSchema,
  takealotOfferSchema,
  takealotReturnSchema,
  takealotSaleSchema,
  takealotSellerSchema,
  takealotShipmentSchema,
  takealotTransactionSchema,
} from "@/integrations/takealot/schemas";
import {
  TakealotTransport,
  type TakealotTransportOptions,
} from "@/integrations/takealot/transport";

type Schema<T> = ZodType<T, ZodTypeDef, unknown>;

function clampLimit(pageSize: number | undefined): number {
  const n = pageSize ?? TAKEALOT_DEFAULT_LIMIT;
  return Math.max(1, Math.min(n, TAKEALOT_MAX_LIMIT));
}

/**
 * First real marketplace adapter. Implements the generic MarketplaceAdapter
 * contract over the verified Takealot Marketplace API (docs/TAKEALOT_API.md):
 * validate raw payloads at the boundary (fail-closed quarantine), map to
 * canonical DTOs deterministically, and paginate via continuation tokens
 * exposed as the generic opaque cursor.
 */
export class TakealotMarketplaceAdapter implements MarketplaceAdapter {
  readonly marketplace = TAKEALOT_MARKETPLACE;
  readonly mode = "live" as const;
  readonly capabilities = TAKEALOT_CAPABILITIES;

  private readonly transport: TakealotTransport;

  constructor(options: TakealotTransportOptions | { transport: TakealotTransport }) {
    this.transport =
      "transport" in options ? options.transport : new TakealotTransport(options);
  }

  async verifyConnection(): Promise<ConnectionStatus> {
    const base = {
      marketplace: this.marketplace,
      mode: this.mode,
      checkedAt: new Date().toISOString(),
    };
    try {
      await this.transport.get("/seller");
      return { ...base, ok: true, message: null };
    } catch (error) {
      const message =
        error instanceof TakealotApiError ? error.message : "Connection failed";
      return { ...base, ok: false, message };
    }
  }

  async listSellerMetadata(): Promise<SellerMetadata> {
    const raw = await this.transport.get("/seller");
    return mapSeller(takealotSellerSchema.parse(raw));
  }

  /**
   * Fetch one page: validate the envelope, validate each item individually
   * (quarantining malformed ones), map survivors to canonical DTOs
   * (quarantining any that fail to map), and expose the continuation token as
   * the opaque next cursor.
   */
  private async listPaged<TRaw, TOut>(
    kind: string,
    path: string,
    itemSchema: Schema<TRaw>,
    mapFn: (raw: TRaw) => TOut[],
    canonicalSchema: Schema<TOut>,
    params: ListParams | undefined,
    extraQuery: Record<string, string | number | boolean | null | undefined> = {},
  ): Promise<Page<TOut>> {
    const raw = await this.transport.get(path, {
      limit: clampLimit(params?.pageSize),
      continuation_token: params?.cursor ?? undefined,
      ...extraQuery,
    });

    const envelope = takealotEnvelopeSchema.parse(raw);
    const { valid, quarantined } = validateBatch(kind, itemSchema, envelope.items);

    const records: TOut[] = [];
    valid.forEach((item, index) => {
      try {
        for (const mapped of mapFn(item)) {
          // Belt-and-suspenders: the mapped record must also be canonically valid.
          records.push(canonicalSchema.parse(mapped));
        }
      } catch (error) {
        quarantined.push({
          kind,
          index,
          reason: error instanceof Error ? error.message : "map failed",
          raw: item,
        } satisfies QuarantinedRecord);
      }
    });

    return { records, nextCursor: envelope.continuation_token, quarantined };
  }

  listOffers(params?: ListParams): Promise<Page<Offer>> {
    return this.listPaged("offers", "/offers", takealotOfferSchema, (o) => [mapOffer(o)], offerSchema, params);
  }

  listSales(params?: ListParams): Promise<Page<Sale>> {
    return this.listPaged("sales", "/sales", takealotSaleSchema, (s) => [mapSale(s)], saleSchema, params);
  }

  listReturns(params?: ListParams): Promise<Page<Return>> {
    return this.listPaged("returns", "/returns", takealotReturnSchema, (r) => [mapReturn(r)], returnSchema, params);
  }

  listShipments(params?: ListParams): Promise<Page<Shipment>> {
    return this.listPaged("shipments", "/shipments", takealotShipmentSchema, (sh) => mapShipment(sh), shipmentSchema, params);
  }

  listTransactions(params?: ListParams): Promise<Page<Transaction>> {
    return this.listPaged(
      "transactions",
      "/transactions",
      takealotTransactionSchema,
      (t) => [mapTransaction(t)],
      transactionSchema,
      params,
    );
  }

  async listBalances(): Promise<Balance[]> {
    const raw = await this.transport.get("/balances");
    return mapBalances(takealotDisbursementSchema.parse(raw));
  }
}
