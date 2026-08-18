/**
 * Takealot Marketplace API configuration. Verified against the official
 * OpenAPI 3.1.1 spec at https://marketplace-api.takealot.com/v1/docs
 * (see docs/TAKEALOT_API.md for provenance).
 */
import type { MarketplaceCapabilities } from "@/core/marketplace/adapter";

export const TAKEALOT_MARKETPLACE = "takealot";
export const TAKEALOT_BASE_URL = "https://marketplace-api.takealot.com/v1";

/**
 * The API-key header. The official spec defines `X-API-Key` as the apiKey
 * header; kept as one named constant so auth injection lives in exactly one
 * place and is trivially auditable.
 */
export const TAKEALOT_API_KEY_HEADER = "X-API-Key";

/** Currency in which the API denominates all monetary amounts (verified). */
export const TAKEALOT_CURRENCY = "ZAR";

/** Documented pagination limit (default 100, max 1000). */
export const TAKEALOT_DEFAULT_LIMIT = 100;
export const TAKEALOT_MAX_LIMIT = 1000;

/** All capabilities are documented by the official API. */
export const TAKEALOT_CAPABILITIES: MarketplaceCapabilities = {
  offers: true,
  sales: true,
  returns: true,
  shipments: true,
  transactions: true,
  balances: true,
};

/**
 * Default historical window size for date-ranged endpoints (sales/returns/
 * transactions). Used by the deterministic window splitter for historical
 * sync. Chosen conservatively; not a documented hard cap.
 */
export const TAKEALOT_DEFAULT_WINDOW_DAYS = 30;
