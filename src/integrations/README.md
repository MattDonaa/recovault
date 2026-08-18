# src/integrations — Marketplace Adapters

Marketplace-specific code lives here under `src/integrations/<marketplace>/`:
auth, response schemas, pagination, rate/error handling, and identifiers.

Each adapter implements the generic `MarketplaceAdapter` contract so the core
never depends on marketplace-specific details.

Planned:
- `mock/` — `MockMarketplaceAdapter` (contract-faithful, fixture-driven)
- `takealot/` — `TakealotMarketplaceAdapter`

Empty at Milestone 01 (foundation only). Populated in later milestones.
