-- Least-privilege grant hardening (portability, defense-in-depth).
--
-- WHY
-- Hosted Supabase's platform default privileges grant anon, authenticated and
-- service_role broad DML on every table in `public` at creation time. Locally
-- (tables owned by the migration role) those defaults are absent. RLS enforces
-- row-level isolation correctly in both environments, but the *table-privilege*
-- surface differed: on hosted, anon/authenticated held full DML on all tenant
-- tables and service_role held full DML on marketplace_accounts — none of which
-- our workflows use, and which contradicts the documented least-privilege model
-- (docs/TENANCY.md). This migration pins the exact intended table privileges for
-- all three roles with explicit REVOKE + GRANT, so the effective grants are
-- deterministic and identical across local and hosted, independent of platform
-- defaults.
--
-- SCOPE / GUARANTEES
--   * Table privileges only. No RLS is enabled/disabled, no policy is changed,
--     no schema/type/column, no function/trigger, no business logic, no recovery
--     rule, no case state machine, no money representation, no credential crypto.
--   * anon: NO DML on any tenant table.
--   * authenticated: exactly the 0002-0009 client matrix (RLS still authorizes
--     rows); not broadened.
--   * service_role: unchanged from the migration 0010 operational matrix; the
--     only correction is removing the platform-default DML on marketplace_accounts
--     (service_role has no write path there — writes go via the authenticated
--     owner/RLS path).
--   * marketplace_credentials: server-only model preserved (anon/authenticated
--     denied as in 0003; service_role retains full DML).
-- REVOKE precedes GRANT so the result is exact regardless of any pre-existing
-- (platform-default) grants; both are idempotent, so this migration is safely
-- repeatable on a clean or already-provisioned database.

-- ===========================================================================
-- anon — strip ALL table privileges on every tenant table. anon authenticates
-- nothing; RLS has no anon policy, but we also deny at the privilege layer.
-- ===========================================================================
revoke all on public.organizations               from anon;
revoke all on public.organization_members        from anon;
revoke all on public.marketplace_accounts        from anon;
revoke all on public.audit_events                from anon;
revoke all on public.marketplace_credentials     from anon;
revoke all on public.sync_jobs                   from anon;
revoke all on public.source_records              from anon;
revoke all on public.source_record_rejections    from anon;
revoke all on public.sync_checkpoints            from anon;
revoke all on public.marketplace_events          from anon;
revoke all on public.recovery_candidates         from anon;
revoke all on public.recovery_candidate_evidence from anon;
revoke all on public.cases                       from anon;
revoke all on public.case_events                 from anon;
revoke all on public.case_evidence_refs          from anon;
revoke all on public.recovery_records            from anon;

-- ===========================================================================
-- authenticated — reset to exactly the validated client matrix (0002-0009).
-- RLS remains the row-level authorization layer; these are the table-privilege
-- envelopes only.
-- ===========================================================================
revoke all on public.organizations               from authenticated;
revoke all on public.organization_members        from authenticated;
revoke all on public.marketplace_accounts        from authenticated;
revoke all on public.audit_events                from authenticated;
revoke all on public.marketplace_credentials     from authenticated;  -- stays denied (0003)
revoke all on public.sync_jobs                   from authenticated;
revoke all on public.source_records              from authenticated;
revoke all on public.source_record_rejections    from authenticated;
revoke all on public.sync_checkpoints            from authenticated;
revoke all on public.marketplace_events          from authenticated;
revoke all on public.recovery_candidates         from authenticated;
revoke all on public.recovery_candidate_evidence from authenticated;
revoke all on public.cases                       from authenticated;
revoke all on public.case_events                 from authenticated;
revoke all on public.case_evidence_refs          from authenticated;
revoke all on public.recovery_records            from authenticated;

-- Tenancy surfaces the client manages directly (RLS narrows to member/owner/admin).
grant select, insert, update, delete on public.organizations        to authenticated;
grant select, insert, update, delete on public.organization_members to authenticated;
grant select, insert, update, delete on public.marketplace_accounts to authenticated;
-- audit trail: append-only for clients (select + insert; no update/delete).
grant select, insert on public.audit_events to authenticated;
-- ingestion / ledger / candidates / cases / recovery: read-only for clients
-- (all writes are server/service-role; RLS also restricts rows to the org).
grant select on public.sync_jobs                   to authenticated;
grant select on public.source_records              to authenticated;
grant select on public.source_record_rejections    to authenticated;
grant select on public.sync_checkpoints            to authenticated;
grant select on public.marketplace_events          to authenticated;
grant select on public.recovery_candidates         to authenticated;
grant select on public.recovery_candidate_evidence to authenticated;
grant select on public.cases                       to authenticated;
grant select on public.case_events                 to authenticated;
grant select on public.case_evidence_refs          to authenticated;
grant select on public.recovery_records            to authenticated;
-- marketplace_credentials: intentionally NOT granted (server-only; see 0003).

-- ===========================================================================
-- service_role — keep the migration 0010 operational matrix exactly; only
-- remove the platform-default DML on marketplace_accounts (no server write
-- path exists there). The 0010-managed tables and marketplace_credentials
-- (0003) are already deterministic and are left untouched here.
-- ===========================================================================
revoke all on public.marketplace_accounts from service_role;
