# Milestone 15 — Commercial Release Gate

## Objective
Turn the live-validated MVP into a release candidate without expanding the product into unrelated features.

## Entry Conditions
- Milestone 14 GREEN.
- Explicit human instruction to prepare commercial release.
- Live pilot findings accepted.

## In Scope
- Production security review.
- Data-retention policy implementation/configuration.
- Privacy/data handling documentation inputs.
- Backup procedures.
- Restore procedure and test.
- Operational alerts.
- Sync failure alerting.
- Admin/support runbook.
- Incident/rollback runbook.
- Production smoke tests.
- Marketplace integration health checks.
- Onboarding copy grounded only in validated capabilities.
- Final mock/demo isolation.
- Final accessibility/basic UX pass on existing workflows.
- Legal/terms/privacy items clearly flagged for qualified legal review.
- Billing only if explicitly authorized by the human owner.

## Release-Blocking Checks
- Tenant isolation.
- Credential security.
- Backup/restore.
- Production build.
- Golden E2E.
- Live adapter health.
- Recovery precision accepted from pilot.
- Operational runbook.
- Error/alert visibility.
- No unsupported recovery guarantees.
- No automatic marketplace claim submission unless separately designed, authorized, and validated in a future milestone.

## Explicitly Out of Scope
- New marketplaces.
- New detector families.
- AI decision-making.
- PPC/repricing/product research.
- Inventory forecasting.
- Mobile application.
- Unvalidated automation.
- Scope expansion disguised as launch polish.

## Acceptance Criteria
- AC-01: Security release review GREEN.
- AC-02: Backup and restore test GREEN.
- AC-03: Production smoke GREEN.
- AC-04: Golden E2E regression GREEN.
- AC-05: Live adapter regression GREEN.
- AC-06: Operational alerts/runbook GREEN.
- AC-07: Public-facing claims accurately reflect validated behavior.
- AC-08: Human owner approves release candidate.

## Completion
When GREEN, RecoVault is a commercial release candidate.

Claude must STOP and wait for explicit human authorization before any public launch, billing activation, new marketplace integration, or post-V1 feature development.
