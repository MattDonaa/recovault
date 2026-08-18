# Milestone 13 — Recovery Verification & Mock-Validated MVP

## Objective
Close the financial loop, harden the application, and prove the complete MVP using mock marketplace data.

## Preconditions
- Milestone 12 GREEN.

## In Scope
Create:
- `recovery_records`
- deterministic recovery/payment matching service
- reversal handling
- recovered totals
- case recovery closure
- production environment validation
- security headers
- application error boundaries
- sanitized structured logging
- observability/Sentry-ready boundary
- clean-clone setup/runbook
- deployment documentation

## Matching Rules
- Match using documented canonical identifiers first.
- Use time windows only where explicitly required.
- Ambiguous matches must become review-required; never silently close a case.
- Unmatched payments remain unmatched.
- Reversal handling must be deterministic and auditable.

## Golden End-to-End Scenario
1. Create mock marketplace connection.
2. Run sync.
3. Persist source records.
4. Normalize ledger.
5. Run recovery detector.
6. Display candidate in Money Finder.
7. Accept candidate.
8. Create case.
9. Generate evidence.
10. Mark manually submitted.
11. Ingest matching recovery/payment event.
12. Match recovery.
13. Mark case recovered.
14. Update recovered dashboard total.

## Required Tests
- Golden E2E GREEN.
- Unmatched payment does not close case.
- Ambiguous match requires review.
- Valid match closes/advances correct case.
- Reversal changes state according to documented rule.
- Full tenant-isolation regression.
- Secret scan.
- Dependency/security audit recorded.
- Production build.
- Clean-clone/runbook verification.

## Acceptance Criteria
- AC-01: All package quality commands GREEN.
- AC-02: Golden E2E GREEN.
- AC-03: Complete MVP demo works without real seller.
- AC-04: Security regression GREEN.
- AC-05: Clean clone can be configured and run from documentation.
- AC-06: UI clearly states mock/demo status.
- AC-07: No claim of live Takealot validation.

## Completion
At GREEN, the mock-validated MVP is complete.
- Last GREEN Milestone = 13.
- Current Allowed Milestone = 14, but status = BLOCKED until real seller credentials/permission exist.
- STOP.
