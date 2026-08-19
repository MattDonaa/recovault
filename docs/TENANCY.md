# RecoVault — Tenancy & Row-Level Security Model

Status: established at **Milestone 02**. Schema source of truth:
`supabase/migrations/*.sql`.

## Tenancy unit
The **organization** is the tenant boundary. Every tenant-owned row carries an
`organization_id` and is isolated from other organizations both by server-side
authorization and by PostgreSQL Row-Level Security (RLS).

## Tables
| Table | Purpose | Tenant key |
|-------|---------|-----------|
| `organizations` | Tenant root. `created_by` records the founder. | `id` |
| `organization_members` | User↔org membership with a role. Unique per (org, user). | `organization_id` |
| `marketplace_accounts` | **Metadata only** for a connected marketplace (no credentials/secrets). | `organization_id` |
| `audit_events` | Append-only record of material state transitions. | `organization_id` |
| `marketplace_credentials` | **Encrypted** marketplace secrets (M06), one per account. RLS denies all client roles; server/service-role only. | `organization_id` |
| `sync_jobs`, `source_records`, `source_record_rejections`, `sync_checkpoints` | Ingestion + provenance (M07). Members read their org's rows; writes server/service-role. | `organization_id` |
| `marketplace_events` | Normalized ledger (M08). Members read their org's events; writes server/service-role. | `organization_id` |

All primary keys are UUID. All timestamps are `timestamptz` stored in UTC.
No table, type, or column is named after the brand (`RecoVault`) or a
marketplace (`Takealot`); `marketplace` is a data value, never an identifier.

## Roles
Supabase-native Postgres roles (mirrored offline by the test shim):
- **`anon`** — unauthenticated. Holds **no** grant on tenant tables; access is
  refused before RLS is consulted.
- **`authenticated`** — end users. All access is constrained by the RLS
  policies below, keyed on `auth.uid()` (the JWT `sub` claim).
- **`service_role`** — trusted server key. `BYPASSRLS`; used only for
  system/admin operations. Never exposed to the browser.

## Membership roles
`org_role` enum: `owner`, `admin`, `member`.
- The organization creator is automatically inserted as `owner` by a
  `SECURITY DEFINER` `AFTER INSERT` trigger (`handle_new_organization`).
- Write operations on org-scoped tables require `owner` or `admin`
  (`public.has_org_role`). Reads require any membership
  (`public.is_org_member`). Both helpers are `SECURITY DEFINER` so policy
  evaluation does not recurse through `organization_members` RLS.

## Policy summary
| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| `organizations` | member **or** creator | `created_by = auth.uid()` | owner/admin | owner |
| `organization_members` | member | owner/admin | owner/admin | owner/admin |
| `marketplace_accounts` | member | owner/admin | owner/admin | owner/admin |
| `audit_events` | member | member (append) | *(none — denied)* | *(none — denied)* |

`audit_events` is append-only: `authenticated` is granted only `SELECT` and
`INSERT`, and no UPDATE/DELETE policy exists, so tampering is refused.

The `organizations` SELECT policy also matches `created_by = auth.uid()` so that
`INSERT ... RETURNING` succeeds during org bootstrap (the owner-membership row is
seeded by an AFTER trigger that has not yet run when RETURNING evaluates the
SELECT policy). Cross-tenant isolation is unaffected — another tenant matches
neither clause.

## Default deny
RLS is enabled on every tenant table. With no matching permissive policy, access
is denied. Cross-organization reads return zero rows; cross-organization writes
affect zero rows or raise a row-level-security violation.

## Typed access boundary
- `src/core/tenancy/schema.ts` — Zod schemas + inferred types for every row
  shape (runtime validation boundary).
- `src/lib/db/database.types.ts` — compile-time `Database` type for the
  Supabase client generic.
- `src/lib/supabase/server.ts` — server-only client factories
  (`createAnonServerClient`, `createServiceRoleClient`); the service-role key is
  validated by `src/lib/env.server.ts` and never reaches the browser.

## Testing
RLS is a real PostgreSQL feature, so tests run the **actual migrations** against
an embedded Postgres (`@electric-sql/pglite`) — no Docker, no network, fully
deterministic. `tests/db/supabase-shim.sql` recreates the minimal Supabase auth
surface (`auth.users`, `auth.uid()`, the three roles) so the same migrations run
offline. `tests/db/harness.ts` exposes `asUser` / `asAnon` / `asService`
contexts that set the role and JWT claims per transaction, exactly as
Supabase/PostgREST do. See `tests/integration/tenancy-*.test.ts`.

## Applying migrations to a real Supabase project
Migrations under `supabase/migrations/` are the single source of truth and are
applied with the Supabase CLI (`supabase db push` / `supabase migration up`).
They depend only on the Supabase-provided `auth` schema and roles; the test shim
is never applied to a real project.
