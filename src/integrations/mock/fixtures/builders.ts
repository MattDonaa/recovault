/**
 * Synthetic record builders for mock fixtures. All data is fabricated — no real
 * seller, PII, or secrets. The default currency is minor units of ZAR purely as
 * a synthetic choice; nothing here encodes marketplace-specific semantics.
 */
const CURRENCY = "ZAR";

export function money(minorUnits: number, currency: string = CURRENCY) {
  return { minorUnits, currency };
}

/** Deterministic synthetic timestamp: day offset from a fixed epoch (UTC). */
export function at(dayOffset: number, hour = 12): string {
  const base = Date.UTC(2026, 0, 1, hour, 0, 0);
  return new Date(base + dayOffset * 86_400_000).toISOString();
}

export function seller(overrides: Record<string, unknown> = {}) {
  return {
    externalId: "seller-mock-1",
    displayName: "Mock Seller (DEMO)",
    defaultCurrency: CURRENCY,
    countryCode: "ZA",
    ...overrides,
  };
}

export function offer(
  externalId: string,
  sku: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    externalId,
    sku,
    title: `Demo product ${sku}`,
    price: money(19900),
    stockOnHand: 100,
    status: "active",
    ...overrides,
  };
}

export function sale(
  externalId: string,
  sku: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    externalId,
    orderExternalId: `order-${externalId}`,
    sku,
    quantity: 1,
    soldAt: at(1),
    gross: money(19900),
    fees: money(-2985),
    net: money(16915),
    ...overrides,
  };
}

export function ret(
  externalId: string,
  sku: string,
  outcome: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    externalId,
    orderExternalId: `order-${externalId}`,
    sku,
    quantity: 1,
    outcome,
    reason: "customer_changed_mind",
    occurredAt: at(5),
    refund: money(-19900),
    ...overrides,
  };
}

export function shipment(
  externalId: string,
  sku: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    externalId,
    reference: `inbound-${externalId}`,
    sku,
    quantitySent: 50,
    quantityReceived: 50,
    quantityDamaged: 0,
    status: "received",
    createdAt: at(0),
    updatedAt: at(2),
    ...overrides,
  };
}

export function txn(
  externalId: string,
  type: string,
  minorUnits: number,
  overrides: Record<string, unknown> = {},
) {
  return {
    externalId,
    type,
    amount: money(minorUnits),
    occurredAt: at(3),
    relatedExternalId: null,
    description: null,
    ...overrides,
  };
}

export function balance(overrides: Record<string, unknown> = {}) {
  return {
    currency: CURRENCY,
    available: money(500000),
    pending: money(25000),
    asOf: at(6),
    ...overrides,
  };
}
