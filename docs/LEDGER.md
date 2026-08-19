# RecoVault — Normalized Marketplace Ledger

Status: established at **Milestone 08**. Schema:
`supabase/migrations/0005_marketplace_events.sql`. Normalizers: `src/core/ledger/`.

The ledger converts validated `source_records` (M07) into an **append-oriented,
marketplace-independent** event stream. The recovery core consumes these
canonical events without any marketplace-specific (e.g. Takealot) DTOs.

## `marketplace_events` (LEDGER LAW)
Each event carries: tenant + account, marketplace, canonical **event type**,
canonical entity references (`external_ref`, `sku`, `order_external_id`,
`references_json`), quantity (where applicable), **exact monetary amount**
(`amount_minor` bigint integer minor units + `currency`), `occurred_at`, the
**source record reference** (`source_record_id`), the **normalizer version**, and
a **deterministic event key** (unique per account → idempotent, append-only).

## Canonical event types
`sale`, `shipment_item`, `return`, `payment`, `charge`, `reversal`,
`adjustment`.

Source families → event types:
| Source (`external_type`) | Event type(s) |
|---|---|
| `sales` | `sale` |
| `shipments` | `shipment_item` (quantities in `references_json`) |
| `returns` | `return` (outcome/reason in `references_json`) |
| `transactions` | by canonical transaction type: `sale`/`reimbursement` → `payment`; `fee`/`refund` → `charge`; `reversal` → `reversal`; `adjustment` → `adjustment` |

`offers` and `balances` produce no ledger events.

## Determinism & idempotency
`normalizeSourceRecord` is pure and deterministic — the same source record
always yields the same events, including the event key
(`sale:<id>`, `shipment_item:<id>`, `return:<id>`, `transaction:<id>`). Insertion
uses `ON CONFLICT (marketplace_account_id, event_key) DO NOTHING`, so
re-normalization inserts nothing and never duplicates. `rebuildLedger` drops an
account's events and re-normalizes, reproducing an equivalent ledger (dev/test).

## Financial exactness
Money is stored as **integer minor units** (`bigint`) with an ISO currency —
never JS floating point. Amounts are copied exactly from the canonical records;
tests assert exactness at the boundary.

## Provenance & isolation
Every event has a non-null `source_record_id` (FK) → full source→event
traceability. RLS on `marketplace_events` lets members read their org's ledger;
writes are performed by trusted server code (service role).

## Engine
- `normalizeAccount(store, ctx)` — read source records, normalize, idempotently
  insert (`src/core/ledger/engine.ts`).
- `rebuildLedger(store, ctx)` — delete + re-normalize.
- `createSqlLedgerStore(exec)` — pg-like store; proven on PGlite
  (`src/lib/ledger/sql-store.ts`).

## Out of scope (later milestones)
Recovery candidate generation (M09/M10), confidence scoring, cases (M11). The
ledger only normalizes and preserves; it never interprets liability or eligibility.
