-- Milestone hardening (portability) — explicit service_role table privileges.
--
-- WHY
-- Validation against a real local Supabase stack exposed a portability gap: our
-- tenant tables are owned by the migration role (`postgres`), whose default
-- privileges do NOT grant DML to the API roles. So on a clean environment the
-- `service_role` (which the server uses for trusted, RLS-bypassing writes) held
-- only the incidental TRUNCATE/REFERENCES/TRIGGER bits and could not perform the
-- ingestion -> ledger -> candidate -> case -> recovery writes the product relies
-- on. Migrations 0001-0009 depend on the deployment environment to grant those
-- privileges implicitly; this migration makes them explicit so a clean Supabase
-- environment behaves deterministically.
--
-- SCOPE / DISCIPLINE
--   * Grants ONLY the minimum privileges each table's validated server workflow
--     exercises (see src/lib/**/sql-store.ts and src/lib/auth/supabase/store.ts).
--   * Append-only history tables (audit_events, source_record_rejections,
--     *_evidence, case_events, recovery_records) get SELECT + INSERT only — never
--     UPDATE/DELETE — preserving auditability.
--   * marketplace_credentials is intentionally NOT touched: migration 0003
--     already defines its privileged, server-only model (service_role = ALL;
--     anon/authenticated revoked). That model is preserved verbatim.
--   * anon and authenticated privileges are NOT modified or broadened here.
--   * No table schema, RLS policy, function, or trigger is changed. RLS is not
--     weakened; service_role continues to bypass RLS by role attribute only.
--
-- For every operational table we first `revoke all ... from service_role` so the
-- resulting privilege set is exactly what we grant below (independent of any
-- platform default), then grant the minimum. revoke/grant are idempotent, so
-- this migration is safely repeatable on a clean database.

-- Schema access (explicit, not relying on a platform default).
grant usage on schema public to service_role;

-- ---------------------------------------------------------------------------
-- Tenancy core.
--   organizations: server creates orgs (INSERT ... RETURNING). The AFTER-INSERT
--     trigger seeds owner membership as the table owner, so service_role needs
--     no INSERT on organization_members.
--   organization_members: server only reads memberships.
--   audit_events: append-only auditability surface (SELECT + INSERT only).
-- ---------------------------------------------------------------------------
revoke all on public.organizations        from service_role;
revoke all on public.organization_members from service_role;
revoke all on public.audit_events         from service_role;

grant select, insert on public.organizations        to service_role;
grant select          on public.organization_members to service_role;
grant select, insert on public.audit_events         to service_role;

-- ---------------------------------------------------------------------------
-- Ingestion & provenance.
--   sync_jobs: created (INSERT ... RETURNING) then finished (UPDATE).
--   source_records: idempotent upsert (INSERT ... ON CONFLICT DO UPDATE ...
--     RETURNING) + read for normalization.
--   source_record_rejections: append-only quarantine (INSERT; read for health).
--   sync_checkpoints: cursor upsert (INSERT ... ON CONFLICT DO UPDATE).
-- ---------------------------------------------------------------------------
revoke all on public.sync_jobs                from service_role;
revoke all on public.source_records           from service_role;
revoke all on public.source_record_rejections from service_role;
revoke all on public.sync_checkpoints         from service_role;

grant select, insert, update on public.sync_jobs                to service_role;
grant select, insert, update on public.source_records           to service_role;
grant select, insert          on public.source_record_rejections to service_role;
grant select, insert, update on public.sync_checkpoints         to service_role;

-- ---------------------------------------------------------------------------
-- Normalized ledger.
--   marketplace_events: append-only insert (ON CONFLICT DO NOTHING RETURNING) +
--     read; a full rebuild deletes an account's events (deleteEventsForAccount),
--     so DELETE is required by the validated rebuild workflow. No UPDATE.
-- ---------------------------------------------------------------------------
revoke all on public.marketplace_events from service_role;
grant select, insert, delete on public.marketplace_events to service_role;

-- ---------------------------------------------------------------------------
-- Recovery candidates & evidence.
--   recovery_candidates: append insert + read; full rebuild deletes candidates
--     (deleteCandidates) → DELETE required. No UPDATE.
--   recovery_candidate_evidence: append-only evidence links (SELECT + INSERT);
--     rebuild removes rows via ON DELETE CASCADE from recovery_candidates, which
--     does not require DELETE privilege on the child.
-- ---------------------------------------------------------------------------
revoke all on public.recovery_candidates          from service_role;
revoke all on public.recovery_candidate_evidence  from service_role;

grant select, insert, delete on public.recovery_candidates         to service_role;
grant select, insert          on public.recovery_candidate_evidence to service_role;

-- ---------------------------------------------------------------------------
-- Cases, case audit, case evidence.
--   cases: created (INSERT ... RETURNING), read, and mutated via status/claim
--     UPDATEs (case state machine, claim submission, mark recovered).
--   case_events: append-only case audit (SELECT + INSERT only).
--   case_evidence_refs: append-only evidence links (SELECT + INSERT only).
-- ---------------------------------------------------------------------------
revoke all on public.cases              from service_role;
revoke all on public.case_events        from service_role;
revoke all on public.case_evidence_refs from service_role;

grant select, insert, update on public.cases              to service_role;
grant select, insert          on public.case_events        to service_role;
grant select, insert          on public.case_evidence_refs to service_role;

-- ---------------------------------------------------------------------------
-- Recovery records.
--   recovery_records: append-only match records, one per (account, event)
--     (INSERT ... ON CONFLICT DO NOTHING RETURNING) + read. Reversals are new
--     records, never updates — so SELECT + INSERT only.
-- ---------------------------------------------------------------------------
revoke all on public.recovery_records from service_role;
grant select, insert on public.recovery_records to service_role;

-- marketplace_credentials: intentionally untouched (see migration 0003).
