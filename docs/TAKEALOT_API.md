# Takealot Marketplace API — Verified Contract (source provenance for M05)

**Source:** official OpenAPI 3.1.1 spec embedded in the ReDoc documentation at
`https://marketplace-api.takealot.com/v1/docs`.
**API title/version:** "Takealot Marketplace API" v1.0.0.
**Verified:** 2026-08-18 (inspected via the rendered ReDoc spec object).

> This file records exactly what was VERIFIED from the official documentation so
> the adapter schemas are grounded in the real contract, not guesses. Live
> request/response validation against a real seller account remains deferred to
> the live-pilot milestone.

## Server & auth
- Production base URL: `https://marketplace-api.takealot.com/v1`
- Auth: API key in the **`X-API-Key`** request header (`securitySchemes.api_key`,
  `type: apiKey`, `in: header`). Server-side only.

## Pagination (uniform for list endpoints)
Query params (shared components): `limit` (integer; documented default 100, max
1000), `continuation_token` (string), `include_count` (boolean).
List responses are `{ items: [...], continuation_token, count, limit }`:
- `items`: array of the entity
- `continuation_token`: present when more results exist (opaque string)
- `count`: total, only when `include_count=true`
- `limit`: echoed page size

## Endpoints (verified paths)
- `GET /offers`, `GET /offers/{offer_id}`, `/offers/by_sku/{sku}`, `/offers/by_barcode/{barcode}`, `/offers/batch`, `/offers/batch/{batch_id}`
- `GET /sales` (filters: `order_id`, `order_date__gte`, `order_date__lte`, `stock_source_region`, `limit`, `continuation_token`, `include_count`, `fields`)
- `GET /transactions` (filters: `created_at__gte`, `created_at__lte` [date-time], `transaction_type__in`, `limit`, `continuation_token`, `include_count`, `fields`, `expands`)
- `GET /balances` → `DisbursementInformation`
- `GET /shipments`, `GET /shipments/{shipment_id}`
- `GET /returns`, `GET /returns/{return_id}` (filters: `return_date__gte/lte` [date], `outcome__in`, `return_reason__in`, `order_id`, `sku`, `order_by`, …)
- `GET /seller` → `Seller`
- `GET /status`, `GET /facilities/get_enabled_regions`

## Money semantics (verified from field descriptions + examples)
All monetary amounts are denominated in **South African Rand (ZAR)**:
- `SellingPrice`, `RRP`: `integer` (int32), "in South African Rand" (examples 345, 399).
- `SuccessFee`, `Sale.total_fees`, `fulfillment_fee`, `courier_collection_fee`, `stock_transfer_fee`: `number`/double in Rand (examples 5, 15.75, 7.25, 3.5, 5.25).
- `Transaction.amount_incl_vat`: `number` in Rand (example 115); `vat_multiplier` example 0.15.
- Balances `current`/`available`/`held_back`: `number` in Rand (examples 15000.5, 12500, 2500.5).

→ Canonical money is integer **minor units** + ISO currency. Conversion:
`minorUnits = round(randValue * 100)`, `currency = "ZAR"`. This applies the
fixed ZAR→cents relationship to the documented unit (not a guessed unit).

## Key entity fields (verified)
- **Offer**: `offer_id` (int), `sku`, `barcode`, `title`, `selling_price`, `rrp`, `status` enum `[buyable, not_buyable, disabled_by_seller, disabled_by_takealot]`, `seller_warehouse_stock[]` `{seller_warehouse_id, quantity_available}`, `takealot_warehouse_stock[]`, `tsin_id`, timestamps.
- **Sale**: `order_id` (int), `order_item_id` (int), `offer_id`, `sku`, `tsin_id`, `quantity` (int), `order_date` (date-time), `selling_price`, `success_fee`, `total_fees`, `fulfillment_fee`, `courier_collection_fee`, `stock_transfer_fee`, `sale_status`, `sales_region`, `stock_source_region`.
- **Transaction** (`TransactionWithReferences` = Transaction + `references[]`): `transaction_id` (int), `transaction_type` (enum, incl. stock-loss: `payment-stock-loss-payment`, `reversal-stock-loss-reversal`, `charge-stock-loss-*`, `charge-success-fee`, `payment-customer-order`, `reversal-customer-order`, `disbursement-disbursement`, …), `amount_incl_vat` (number), `vat_multiplier`, `created_at` (date-time). `TransactionReference`: `order_id`, `order_item_id`, `offer_id`, `purchase_order_number`, `return_reference_number`, `removal_order_item_id`, `item_quantity`, `rule`, `manual_reference`.
- **Shipment**: `shipment_id` (int), `purchase_order_number`, `purchase_order_state` (enum `[shipped, receiving, partially_received, received_full_quantity, closed_partially_received, cancelled, unloaded]`), `shipment_type` (enum `[customer_order, replenishment, mixed]`), `reference`, `created_at`, `due_date`, `destination_region`, `shipped`, `cancelled`, `shipment_items[]`. **ShipmentItem**: `shipment_item_id`, `offer_id`, `quantity_required`, `quantity_sending`, `purchase_order_quantity_received`, `purchase_order_quantity_damaged`, `cancelled`.
- **SellerReturn**: `seller_return_id` (int), `order_id`, `offer_id`, `sku`, `tsin_id`, `quantity`, `return_date` (date), `return_reason` (enum), `return_reference_number` (RRN), `return_region`, `outcomes[]` (`ReturnOutcome{outcome_id, status}`; `ReturnOutcomeEnum [pending_removal_order, removal_order, pending_sellable_stock, sellable_stock]`), `customer_comment`, `transactions[]` (expand).
- **DisbursementInformation**: `balances { current, available, held_back }` (ZAR numbers).
- **Seller**: `seller_id` (int), `uuid`, `display_name`, `legal_name`, `countries[]`, `account_verified`, `is_vat_registered`, …

## Errors
`DefaultError { message }`, `Error { title }`, `ForbiddenError { errors[] }`
(403), `ValidationError { errors[] }`. The adapter surfaces sanitized,
non-sensitive error codes/messages and never includes the API key.

## Documentation notes / mapping decisions (verified fields → canonical DTOs)
These are mapping choices grounded in verified fields (not schema guesses):
- Canonical `sku` for shipment lines is derived from `ShipmentItem.offer_id`
  (a stable real identifier; ShipmentItem carries `offer_id`, not `sku`).
- Return `refund` is left null on the canonical DTO; refund money is expressed
  via linked `transactions` (expand), consistent with MR-002 handling later.
- Return outcome mapping: `sellable_stock → restocked`, `removal_order → returned_to_seller`, `pending_* → pending` (canonical enum has no direct `refunded`/`written_off`; those derive from transactions in later milestones).
- Seller `defaultCurrency` = `ZAR` (the API denominates amounts in South African Rand).
- Transaction type is mapped to the canonical set via a deterministic table
  (see `src/integrations/takealot/mapper.ts`).
