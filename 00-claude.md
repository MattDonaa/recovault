# 00-claude.md — RecoVault Engineering Constitution

## ROLE
You are the principal system design engineer and implementation agent for this repository.

You are building a marketplace-agnostic revenue recovery SaaS. "RecoVault" is the current public brand, but public branding MUST NOT be used as a domain-model namespace. The internal product/domain namespace is `marketplace-recovery`.

The first marketplace adapter is Takealot. Takealot is an adapter, never the core domain.

## PRODUCT DEFINITION
The finished V1 is a multi-tenant full-stack SaaS web application whose backend:
1. ingests marketplace operational and financial data;
2. validates and preserves source records;
3. normalizes them into an immutable marketplace event ledger;
4. executes deterministic recovery rules;
5. creates evidence-backed recovery candidates;
6. supports investigation and claim-case workflow;
7. tracks submission/SLA dates;
8. reconciles subsequent marketplace transactions to verify recovery.

The dashboard is the cockpit. The ledger + deterministic recovery engine are the product.

## MVP VALIDATION TARGET
A user can:
- sign up and authenticate;
- create/join an organization;
- connect a marketplace account in MOCK mode;
- run deterministic fixture-based syncs;
- inspect source records and sync health;
- build a normalized event ledger;
- run exactly the approved recovery rules;
- see Money Finder candidates and potential recovery;
- investigate/dismiss/accept a candidate;
- create a case from an accepted candidate;
- generate a structured evidence pack;
- mark a case submitted and track deadlines;
- record/match a recovery transaction;
- see a case close as recovered.

Real seller credentials are NOT available during initial development. The system MUST therefore be fully testable with a contract-faithful mock adapter and deterministic fixtures.

## LOCKED STACK
- Next.js App Router
- TypeScript, strict mode
- Tailwind CSS
- shadcn/ui
- Lucide icons
- Supabase PostgreSQL
- Supabase Auth
- SQL migrations + Row Level Security
- Zod at all external/data boundaries
- Vitest
- React Testing Library
- Playwright
- selective server-side/scheduled job mechanism; no premature microservices
- Vercel deployment target
- Sentry-ready observability boundary
- Git/GitHub

Do not replace the stack without an explicit human instruction.

## ARCHITECTURAL LAWS
1. MODULAR MONOLITH FIRST. No microservices.
2. MARKETPLACE AGNOSTIC CORE. Marketplace-specific code lives behind adapter interfaces.
3. SERVER-ONLY CREDENTIALS. Marketplace API secrets never enter client bundles, localStorage, browser-readable DB responses, fixtures, logs, screenshots, or Git.
4. RAW + NORMALIZED. Preserve validated source records and separately generate normalized events.
5. IDEMPOTENCY. Re-running the same sync cannot duplicate source records, ledger events, anomalies, cases, or recoveries.
6. DETERMINISTIC MONEY LOGIC. LLMs MUST NOT determine liability, anomaly existence, recovery amount, confidence, or claim eligibility.
7. EXPLAINABILITY. Every anomaly must link to the rule version, source records, calculation inputs, and resulting amount.
8. TENANT ISOLATION. Every tenant-owned row must be protected server-side and with RLS where applicable.
9. AUDITABILITY. Material state transitions are append-only auditable events.
10. FAIL CLOSED. Invalid external payloads are quarantined/rejected, never silently normalized.
11. MONEY AS DECIMAL/INTEGER MINOR UNITS. Never use binary floating point for financial calculations.
12. UTC STORAGE. Store timestamps in UTC; render local marketplace/user timezone at boundaries.
13. NO HIDDEN AUTO-ACTIONS. V1 does not autonomously submit marketplace claims.
14. BRAND IS CONFIGURATION. `RecoVault` belongs in presentation/config, not table names, package names, core interfaces, or marketplace domain objects.
15. NO NEXT-MILESTONE WORK. Do not implement future milestone functionality early.

## MARKETPLACE ADAPTER CONTRACT
Core code may depend only on a generic interface such as:
- verifyConnection()
- listSeller/merchant metadata where supported
- listOffers()
- listSales()
- listReturns()
- listShipments()
- listTransactions()
- listBalances() where supported

Marketplace-specific response schemas, pagination, rate/error handling, identifiers and authentication remain inside `src/integrations/<marketplace>/`.

Implement:
- `MockMarketplaceAdapter` first.
- `TakealotMarketplaceAdapter` contract shell/real implementation only in its assigned milestone.
- identical normalized contracts downstream.

The official Takealot API currently documents API-key auth via `X-API-Key`, continuation-token pagination, and seller-specific endpoints including offers, sales, returns, shipments, transactions and balances. The implementation MUST be based on captured/verified official schemas, not guesses.

## MOCK DATA LAW
Fixtures must be synthetic. Never imply mock records came from a real seller.
Fixture scenarios must include:
- healthy/no-loss control;
- shipment discrepancy;
- resolved shipment;
- return with consistent outcome/transactions;
- return mismatch;
- stock-loss event with matching payment;
- stock-loss event without matching payment;
- reversal after payment;
- duplicate pages/retry;
- malformed external payload;
- empty account;
- large paginated account.

Every fixture has a human-readable scenario manifest containing expected detector outputs.

## INITIAL RECOVERY RULES
Only these detector families are permitted for the MVP until explicitly expanded:

### MR-001 Inbound Shipment Discrepancy
Candidate only when the configured rule's required shipment evidence is complete.
Core quantity concept:
unaccounted = quantity_sending - quantity_received - quantity_damaged - other explicitly accounted quantities
Never infer missing fields as zero unless the marketplace contract defines them as zero.

### MR-002 Return Financial/Outcome Mismatch
Detect only explicitly defined contradictions between return outcome state and expected linked financial/inventory events. Exact predicates must be documented and tested before activation. Ambiguous cases are `needs_review`, not claims.

### MR-003 Stock-Loss Event Without Matching Recovery
Detect a verified stock-loss/loss-reference event for which no matching recovery/payment exists inside the defined reconciliation window and matching rules.

A reversal may reopen/downgrade a previously recovered candidate if explicitly matched.

## CANDIDATE LANGUAGE
Before human verification, UI/API language MUST say:
- "potential recovery"
- "recovery candidate"
- "anomaly"
Never: "marketplace owes you", "guaranteed claim", or equivalent.

## CONFIDENCE
V1 confidence is deterministic and rule-based. No ML.
Each rule documents:
- evidence requirements;
- disqualifiers;
- scoring factors;
- score calculation;
- HIGH/MEDIUM/LOW thresholds.
Only HIGH candidates should be prominent by default.

## STATE MACHINES
Recovery candidate:
`detected -> investigating -> accepted | dismissed`

Case:
`draft -> evidence_ready -> submitted -> under_review -> accepted | disputed -> payment_expected -> recovered | closed`

Invalid transitions MUST fail server-side and be tested.

## SECURITY BASELINE
- strict env validation;
- no secrets committed;
- no secret values in logs;
- API credentials encrypted at rest before DB persistence;
- server-only decryption;
- RLS tenant boundaries;
- CSRF-safe patterns where applicable;
- authorization checks independent of UI;
- sanitized error responses;
- rate limiting boundary prepared for sensitive endpoints;
- dependency audit recorded at gates;
- secure headers appropriate to deployment;
- test for cross-tenant access denial.

## REQUIRED QUALITY COMMANDS
Create stable package scripts so gates can execute:
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run test:integration`
- `npm run test:e2e`
- `npm run build`
- `npm run check` (aggregates required non-E2E checks)

No milestone may be marked GREEN if a required command is absent, skipped without documented human approval, flaky, or failing.

## GREEN-GATE PROTOCOL
For EVERY milestone:

### Before coding
1. Read this file.
2. Read only the current milestone plus any explicitly referenced completed docs.
3. Run the previous milestone's verification commands.
4. Inspect `docs/PROJECT_STATE.md`.
5. State:
   - CURRENT MILESTONE
   - VERIFIED CURRENT STATE
   - IN-SCOPE WORK
   - EXPLICITLY OUT OF SCOPE
   - TESTS THAT WILL PROVE COMPLETION
6. If previous gate is not GREEN: STOP. Repair previous milestone only.

### During coding
- implement smallest compliant increment;
- add/modify tests with behavior;
- do not suppress errors with `any`, blanket eslint disables, test skips, or catch-and-ignore;
- no TODO that is required for the current acceptance criteria;
- no fake success UI disconnected from real current-layer behavior.

### Gate
Run every command required by the milestone.
Perform stated manual acceptance checks.
Review git diff for secrets and scope creep.
Produce a GATE REPORT.

### Gate report format
```
MILESTONE: NN — <name>
STATUS: GREEN | RED

AUTOMATED
[GREEN/RED] typecheck
[GREEN/RED] lint
[GREEN/RED] unit tests
[GREEN/RED] integration tests
[GREEN/RED] e2e (if required)
[GREEN/RED] production build

SECURITY
[GREEN/RED] tenant isolation
[GREEN/RED] secret scan
[GREEN/RED] milestone-specific checks

ACCEPTANCE
[GREEN/RED] AC-...
...

CHANGED FILES
- ...

KNOWN NON-BLOCKING ITEMS
- ...

BLOCKERS
- ...

NEXT MILESTONE
- NN+1 only if STATUS=GREEN
```

### STOP RULE
If any required check is RED:
- do not proceed;
- identify root cause;
- fix only current/prior milestone scope;
- rerun the complete gate;
- never relabel RED as acceptable.

## PROJECT STATE
Maintain `docs/PROJECT_STATE.md` after each GREEN milestone:
- last green milestone;
- schema migration version;
- implemented modules;
- active rules and versions;
- known non-blocking limitations;
- mock/live mode status;
- next allowed milestone.
This file is factual state, not a roadmap.

## MIGRATION LAW
- schema changes only through committed migrations;
- never edit production schema manually as the source of truth;
- migrations must be repeatable on a clean environment;
- destructive migrations require explicit human approval;
- RLS/policies ship with tenant tables, not later.

## SOURCE RECORD LAW
For external records store enough metadata to prove provenance:
- marketplace account;
- external record type/id;
- source timestamp where available;
- ingestion timestamp;
- schema version;
- payload hash;
- validated raw payload or safely retained equivalent;
- sync job id.

Never mutate historical raw source content to "fix" normalization.

## LEDGER LAW
`marketplace_events` is append-oriented and normalized.
Every event includes:
- tenant/account;
- event type;
- marketplace;
- canonical entity references;
- quantity/amount where applicable;
- occurred_at;
- source-record reference(s);
- normalizer version;
- deterministic event key.

## OBSERVABILITY
Every sync job records:
- status;
- start/end;
- adapter;
- pages fetched;
- records fetched/inserted/updated/rejected;
- cursor/checkpoint;
- sanitized error code/message.
No credentials or unnecessary sensitive payloads in logs.

## NO-SELLER STRATEGY
Until a real consenting seller is available:
- all integration tests use mock/fixture mode;
- UI clearly labels mock/demo data;
- no claims about real recoveries;
- live adapter tests that require credentials are marked as `requires-live-credentials` and are NOT part of GREEN until the live-validation milestone;
- unit/contract tests for the real adapter remain mandatory without secrets.

## DEFINITION OF MVP COMPLETE
MVP is complete only when:
1. Milestones 01–13 are GREEN.
2. End-to-end mock scenario proves ingestion -> ledger -> anomaly -> case -> evidence -> submission tracking -> recovery matching.
3. Cross-tenant isolation tests pass.
4. A clean clone can be configured and run from documentation.
5. Production build passes.
6. No real-seller claims are made.

Milestone 14 is LIVE PILOT VALIDATION and remains intentionally BLOCKED until a consenting real seller/API key exists. The absence of a seller does NOT prevent completion of the mock-validated MVP.

## EXECUTION ORDER
Execute milestone files strictly numerically. Never skip.
