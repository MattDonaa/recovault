-- Milestone 13 — Recovery verification (closing the financial loop)
-- A recovery_record captures an observed recovery/payment event and its match
-- state against a case. Matching is deterministic (canonical identifiers).
-- Ambiguous matches are review-required and never silently close a case;
-- reversals are handled explicitly. Tenant-isolated by RLS.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'recovery_record_status') then
    create type public.recovery_record_status as enum (
      'matched',        -- valid, unreversed match to a single case
      'unmatched',      -- payment with no corresponding case
      'reversed',       -- matched payment later reversed (not a valid recovery)
      'needs_review'    -- ambiguous (multiple candidate cases)
    );
  end if;
end $$;

create table if not exists public.recovery_records (
  id                       uuid primary key default gen_random_uuid(),
  organization_id          uuid not null references public.organizations (id) on delete cascade,
  marketplace_account_id   uuid not null references public.marketplace_accounts (id) on delete cascade,
  -- The ledger event that represents the recovery/payment.
  marketplace_event_id     uuid not null references public.marketplace_events (id) on delete cascade,
  -- Set when matched to a case (null when unmatched).
  case_id                  uuid references public.cases (id) on delete set null,
  status                   public.recovery_record_status not null,
  amount_minor             bigint,
  currency                 text,
  external_ref             text,
  reason                   text,
  matched_at               timestamptz,
  created_at               timestamptz not null default now(),
  -- Idempotency: one record per (account, event).
  constraint recovery_records_unique_event unique (marketplace_account_id, marketplace_event_id)
);

create index if not exists idx_recovery_records_account
  on public.recovery_records (marketplace_account_id, status);
create index if not exists idx_recovery_records_case
  on public.recovery_records (case_id);
create index if not exists idx_recovery_records_org
  on public.recovery_records (organization_id);

grant select on public.recovery_records to authenticated;

alter table public.recovery_records enable row level security;

create policy recovery_records_select on public.recovery_records
  for select to authenticated using (public.is_org_member(organization_id));
