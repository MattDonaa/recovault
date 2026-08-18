import type {
  RawScenarioData,
  ScenarioFixture,
} from "@/core/marketplace/scenario";

import {
  at,
  balance,
  money,
  offer,
  ret,
  sale,
  seller,
  shipment,
  txn,
} from "@/integrations/mock/fixtures/builders";

function base(partial: Partial<RawScenarioData>): RawScenarioData {
  return {
    seller: seller(),
    offers: [],
    sales: [],
    returns: [],
    shipments: [],
    transactions: [],
    balances: [],
    ...partial,
  };
}

// 1 — Healthy / no-loss control.
const healthy: ScenarioFixture = {
  manifest: {
    key: "healthy",
    label: "Healthy account (no loss)",
    description:
      "A clean account with matched sales, a consistent return, and a fully received shipment. No anomalies expected.",
    expected: {
      offers: 2,
      sales: 2,
      returns: 1,
      shipments: 1,
      transactions: 2,
      balances: 1,
      quarantined: 0,
    },
    detectorExpectations: [
      { rule: "MR-001", outcome: "no_candidate", note: "Shipment fully received." },
      { rule: "MR-002", outcome: "no_candidate", note: "Return outcome matches financials." },
      { rule: "MR-003", outcome: "no_candidate", note: "No stock-loss event." },
    ],
  },
  data: base({
    offers: [offer("off-1", "SKU-A"), offer("off-2", "SKU-B")],
    sales: [sale("sale-1", "SKU-A"), sale("sale-2", "SKU-B")],
    returns: [ret("ret-1", "SKU-A", "restocked", { refund: null })],
    shipments: [shipment("shp-1", "SKU-A")],
    transactions: [
      txn("txn-1", "sale", 16915, { relatedExternalId: "sale-1" }),
      txn("txn-2", "sale", 16915, { relatedExternalId: "sale-2" }),
    ],
    balances: [balance()],
  }),
};

// 2 — Inbound shipment discrepancy (unresolved).
const shipmentDiscrepancy: ScenarioFixture = {
  manifest: {
    key: "shipment-discrepancy",
    label: "Shipment discrepancy",
    description:
      "An inbound shipment where 6 units are unaccounted (sent 50, received 44), status still open. MR-001 should raise a candidate.",
    expected: {
      offers: 1,
      sales: 0,
      returns: 0,
      shipments: 1,
      transactions: 0,
      balances: 1,
      quarantined: 0,
    },
    detectorExpectations: [
      {
        rule: "MR-001",
        outcome: "candidate",
        note: "unaccounted = 50 - 44 - 0 = 6 units, shipment not resolved.",
      },
    ],
  },
  data: base({
    offers: [offer("off-1", "SKU-A")],
    shipments: [
      shipment("shp-1", "SKU-A", {
        quantitySent: 50,
        quantityReceived: 44,
        quantityDamaged: 0,
        status: "discrepancy",
      }),
    ],
    balances: [balance()],
  }),
};

// 3 — Resolved shipment (previously discrepant, now closed).
const resolvedShipment: ScenarioFixture = {
  manifest: {
    key: "resolved-shipment",
    label: "Resolved shipment",
    description:
      "A shipment that was short but is now resolved with a matching reimbursement. MR-001 should NOT raise a candidate.",
    expected: {
      offers: 1,
      sales: 0,
      returns: 0,
      shipments: 1,
      transactions: 1,
      balances: 1,
      quarantined: 0,
    },
    detectorExpectations: [
      { rule: "MR-001", outcome: "no_candidate", note: "Discrepancy resolved and reimbursed." },
    ],
  },
  data: base({
    offers: [offer("off-1", "SKU-A")],
    shipments: [
      shipment("shp-1", "SKU-A", {
        quantitySent: 50,
        quantityReceived: 44,
        quantityDamaged: 0,
        status: "resolved",
      }),
    ],
    transactions: [
      txn("txn-1", "reimbursement", 119400, { relatedExternalId: "shp-1" }),
    ],
    balances: [balance()],
  }),
};

// 4 — Consistent return (outcome matches financial events).
const consistentReturn: ScenarioFixture = {
  manifest: {
    key: "consistent-return",
    label: "Consistent return",
    description:
      "A refunded return with a matching refund transaction. MR-002 should NOT raise a candidate.",
    expected: {
      offers: 1,
      sales: 1,
      returns: 1,
      shipments: 0,
      transactions: 1,
      balances: 1,
      quarantined: 0,
    },
    detectorExpectations: [
      { rule: "MR-002", outcome: "no_candidate", note: "Refund outcome has a matching refund transaction." },
    ],
  },
  data: base({
    offers: [offer("off-1", "SKU-A")],
    sales: [sale("sale-1", "SKU-A")],
    returns: [ret("ret-1", "SKU-A", "refunded")],
    transactions: [
      txn("txn-1", "refund", -19900, { relatedExternalId: "ret-1" }),
    ],
    balances: [balance()],
  }),
};

// 5 — Return mismatch (outcome contradicts financial events).
const returnMismatch: ScenarioFixture = {
  manifest: {
    key: "return-mismatch",
    label: "Return mismatch",
    description:
      "A return marked refunded with NO matching refund transaction. MR-002 should raise a candidate.",
    expected: {
      offers: 1,
      sales: 1,
      returns: 1,
      shipments: 0,
      transactions: 0,
      balances: 1,
      quarantined: 0,
    },
    detectorExpectations: [
      { rule: "MR-002", outcome: "candidate", note: "Refund outcome without any matching refund transaction." },
    ],
  },
  data: base({
    offers: [offer("off-1", "SKU-A")],
    sales: [sale("sale-1", "SKU-A")],
    returns: [ret("ret-1", "SKU-A", "refunded")],
    balances: [balance()],
  }),
};

// 6 — Stock-loss event WITH matching payment.
const stockLossPaid: ScenarioFixture = {
  manifest: {
    key: "stock-loss-paid",
    label: "Stock loss with matching payment",
    description:
      "5 damaged units on inbound with a matching reimbursement. MR-003 should NOT raise a candidate.",
    expected: {
      offers: 1,
      sales: 0,
      returns: 0,
      shipments: 1,
      transactions: 1,
      balances: 1,
      quarantined: 0,
    },
    detectorExpectations: [
      { rule: "MR-003", outcome: "no_candidate", note: "Stock-loss reimbursed within window." },
    ],
  },
  data: base({
    offers: [offer("off-1", "SKU-A")],
    shipments: [
      shipment("shp-1", "SKU-A", {
        quantitySent: 50,
        quantityReceived: 45,
        quantityDamaged: 5,
        status: "discrepancy",
      }),
    ],
    transactions: [
      txn("txn-1", "reimbursement", 99500, { relatedExternalId: "shp-1" }),
    ],
    balances: [balance()],
  }),
};

// 7 — Stock-loss event WITHOUT matching payment.
const stockLossUnpaid: ScenarioFixture = {
  manifest: {
    key: "stock-loss-unpaid",
    label: "Stock loss without payment",
    description:
      "5 damaged units on inbound with no reimbursement. MR-003 should raise a candidate.",
    expected: {
      offers: 1,
      sales: 0,
      returns: 0,
      shipments: 1,
      transactions: 0,
      balances: 1,
      quarantined: 0,
    },
    detectorExpectations: [
      { rule: "MR-003", outcome: "candidate", note: "Stock-loss with no matching recovery in window." },
    ],
  },
  data: base({
    offers: [offer("off-1", "SKU-A")],
    shipments: [
      shipment("shp-1", "SKU-A", {
        quantitySent: 50,
        quantityReceived: 45,
        quantityDamaged: 5,
        status: "discrepancy",
      }),
    ],
    balances: [balance()],
  }),
};

// 8 — Payment followed by reversal (recovery reopened).
const paymentReversal: ScenarioFixture = {
  manifest: {
    key: "payment-reversal",
    label: "Payment then reversal",
    description:
      "A reimbursement later reversed, leaving the stock-loss effectively unrecovered. MR-003 should re-raise a candidate.",
    expected: {
      offers: 1,
      sales: 0,
      returns: 0,
      shipments: 1,
      transactions: 2,
      balances: 1,
      quarantined: 0,
    },
    detectorExpectations: [
      { rule: "MR-003", outcome: "candidate", note: "Reimbursement reversed; net recovery is zero." },
    ],
  },
  data: base({
    offers: [offer("off-1", "SKU-A")],
    shipments: [
      shipment("shp-1", "SKU-A", {
        quantitySent: 50,
        quantityReceived: 45,
        quantityDamaged: 5,
        status: "discrepancy",
      }),
    ],
    transactions: [
      txn("txn-1", "reimbursement", 99500, { relatedExternalId: "shp-1" }),
      txn("txn-2", "reversal", -99500, { relatedExternalId: "txn-1" }),
    ],
    balances: [balance()],
  }),
};

// 9 — Duplicate / retry pages (same external id served twice).
const duplicateRetry: ScenarioFixture = {
  manifest: {
    key: "duplicate-retry",
    label: "Duplicate / retry pages",
    description:
      "The source serves a duplicate sale (same external id twice). Ingestion downstream must dedupe by external id / event key; the adapter surfaces records deterministically.",
    expected: {
      offers: 1,
      sales: 3,
      returns: 0,
      shipments: 0,
      transactions: 0,
      balances: 1,
      quarantined: 0,
    },
    detectorExpectations: [
      { rule: "MR-002", outcome: "no_candidate", note: "No return anomalies; scenario tests idempotency, not detection." },
    ],
  },
  data: base({
    offers: [offer("off-1", "SKU-A")],
    sales: [
      sale("sale-1", "SKU-A"),
      sale("sale-1", "SKU-A"), // duplicate external id
      sale("sale-2", "SKU-B"),
    ],
    balances: [balance()],
  }),
};

// 10 — Malformed external payload (must fail closed / quarantine).
const malformed: ScenarioFixture = {
  manifest: {
    key: "malformed-payload",
    label: "Malformed payload",
    description:
      "Mixed valid and invalid raw records. Invalid ones must be quarantined (fail closed), never normalized.",
    expected: {
      offers: 1,
      sales: 1,
      returns: 0,
      shipments: 0,
      transactions: 0,
      balances: 1,
      quarantined: 5,
    },
    detectorExpectations: [
      { rule: "MR-001", outcome: "no_candidate", note: "Malformed shipment quarantined; not eligible." },
    ],
  },
  data: base({
    offers: [
      offer("off-1", "SKU-A"),
      { externalId: "off-2" }, // missing sku/title/price
    ],
    sales: [
      sale("sale-1", "SKU-A"),
      {
        externalId: "sale-2",
        sku: "SKU-A",
        quantity: 0, // < 1
        soldAt: "not-a-date",
        gross: { minorUnits: 1.5, currency: "zar" }, // non-int + bad currency
      },
    ],
    returns: [
      {
        externalId: "ret-x",
        sku: "SKU-A",
        quantity: 1,
        outcome: "exploded", // invalid enum
        occurredAt: at(5),
      },
    ],
    shipments: [
      {
        externalId: "shp-x",
        sku: "SKU-A",
        quantitySent: -5, // negative
        quantityReceived: 50,
        status: "received",
        createdAt: at(0),
      },
    ],
    transactions: [
      {
        externalId: "txn-x",
        type: "unknown", // invalid enum
        amount: { minorUnits: 10, currency: "ZAR" },
        occurredAt: at(3),
      },
    ],
    balances: [balance()],
  }),
};

// 11 — Empty account.
const empty: ScenarioFixture = {
  manifest: {
    key: "empty-account",
    label: "Empty account",
    description:
      "A connected account with no records at all. Everything must be handled cleanly with zero anomalies.",
    expected: {
      offers: 0,
      sales: 0,
      returns: 0,
      shipments: 0,
      transactions: 0,
      balances: 0,
      quarantined: 0,
    },
    detectorExpectations: [
      { rule: "MR-001", outcome: "no_candidate", note: "No data." },
      { rule: "MR-002", outcome: "no_candidate", note: "No data." },
      { rule: "MR-003", outcome: "no_candidate", note: "No data." },
    ],
  },
  data: base({}),
};

// 12 — Large paginated account.
const LARGE_SALES = 137;
const largeAccount: ScenarioFixture = {
  manifest: {
    key: "large-account",
    label: "Large paginated account",
    description:
      "A high-volume account spanning many pages; pagination must return every record exactly once.",
    expected: {
      offers: 20,
      sales: LARGE_SALES,
      returns: 0,
      shipments: 0,
      transactions: LARGE_SALES,
      balances: 1,
      quarantined: 0,
    },
    detectorExpectations: [
      { rule: "MR-002", outcome: "no_candidate", note: "Volume/pagination scenario, not a detection scenario." },
    ],
  },
  data: base({
    offers: Array.from({ length: 20 }, (_, i) => offer(`off-${i + 1}`, `SKU-${i + 1}`)),
    sales: Array.from({ length: LARGE_SALES }, (_, i) =>
      sale(`sale-${i + 1}`, "SKU-A", { soldAt: at(i % 28) }),
    ),
    transactions: Array.from({ length: LARGE_SALES }, (_, i) =>
      txn(`txn-${i + 1}`, "sale", 16915, { relatedExternalId: `sale-${i + 1}` }),
    ),
    balances: [balance({ available: money(9_999_900) })],
  }),
};

export const SCENARIOS: readonly ScenarioFixture[] = [
  healthy,
  shipmentDiscrepancy,
  resolvedShipment,
  consistentReturn,
  returnMismatch,
  stockLossPaid,
  stockLossUnpaid,
  paymentReversal,
  duplicateRetry,
  malformed,
  empty,
  largeAccount,
];
