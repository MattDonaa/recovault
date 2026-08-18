# Milestone 02 — Database, Tenancy & Row-Level Security

## Objective
Create the persistent multi-tenant data foundation before authentication UI or marketplace functionality.

## Preconditions
- Milestone 01 is GREEN.
- `docs/PROJECT_STATE.md` states Milestone 02 is allowed.
- Re-run Milestone 01 quality checks before coding.

## In Scope
- Configure Supabase development/local environment.
- Create SQL migrations as the only schema source of truth.
- Create:
  - `organizations`
  - `organization_members`
  - `marketplace_accounts` containing metadata only
  - `audit_events`
- Use UUID primary keys.
- Add timestamps, foreign keys, uniqueness constraints and required indexes.
- Define organization ownership/membership model.
- Implement PostgreSQL Row Level Security.
- Deny cross-organization access by default.
- Establish typed database access boundary.
- Document tenancy model.

## Explicitly Out of Scope
- Marketplace credentials.
- Source records.
- Marketplace sync.
- Authentication screens.
- Recovery data.
- Money Finder.

## Required Tests
- Clean migration applies successfully.
- Re-running supported migration setup is deterministic.
- Tenant A cannot read Tenant B records.
- Tenant A cannot update/delete Tenant B records.
- Unauthenticated access is denied where required.
- Invalid membership/role combinations are constrained.
- Duplicate membership rules behave as documented.

## Acceptance Criteria
- AC-01: All migrations apply to a clean database.
- AC-02: RLS integration tests GREEN.
- AC-03: Cross-tenant read/write tests GREEN.
- AC-04: Required indexes/constraints exist.
- AC-05: No core table is named after `RecoVault` or `Takealot`.
- AC-06: `npm run check` GREEN.
- AC-07: Production build GREEN.

## GREEN Gate
Any tenancy or RLS failure is automatically RED and blocks progress.

## Completion
After GREEN:
- update schema migration version in `PROJECT_STATE.md`;
- set Last GREEN Milestone = 02;
- set Current Allowed Milestone = 03;
- STOP.
