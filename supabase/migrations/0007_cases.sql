-- Milestone 11 — Case engine & audit trail
-- Human-accepted recovery candidates become controlled, auditable recovery
-- cases. One accepted candidate maps to at most one case (idempotent). Every
-- material transition is recorded append-only. Candidate evidence stays
-- traceable through the case. Tenant-isolated by RLS.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'case_status') then
    create type public.case_status as enum (
      'draft',
      'evidence_ready',
      'submitted',
      'under_review',
      'accepted',
      'disputed',
      'payment_expected',
      'recovered',
      'closed'
    );
  end if;
end $$;

create table if not exists public.cases (
  id                       uuid primary key default gen_random_uuid(),
  organization_id          uuid not null references public.organizations (id) on delete cascade,
  marketplace_account_id   uuid not null references public.marketplace_accounts (id) on delete cascade,
  -- One case per accepted candidate → idempotent creation.
  recovery_candidate_id    uuid not null unique
    references public.recovery_candidates (id) on delete cascade,
  status                   public.case_status not null default 'draft',
  title                    text not null,
  summary                  text not null,
  -- Snapshot of the candidate at case creation (exact minor units).
  potential_recovery_minor bigint,
  currency                 text,
  rule_id                  text not null,
  rule_version             text not null,
  created_by               uuid references auth.users (id) on delete set null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists idx_cases_account on public.cases (marketplace_account_id);
create index if not exists idx_cases_org on public.cases (organization_id, status);

drop trigger if exists trg_cases_updated_at on public.cases;
create trigger trg_cases_updated_at
  before update on public.cases
  for each row execute function public.set_updated_at();

-- Append-only audit trail of material case events (creation + transitions).
create table if not exists public.case_events (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  case_id          uuid not null references public.cases (id) on delete cascade,
  actor_user_id    uuid references auth.users (id) on delete set null,
  event_type       text not null,             -- 'created' | 'transition'
  from_status      public.case_status,
  to_status        public.case_status,
  reason           text,
  metadata         jsonb not null default '{}'::jsonb,
  correlation_id   text,
  created_at       timestamptz not null default now()
);

create index if not exists idx_case_events_case
  on public.case_events (case_id, created_at);

-- Evidence references carried from the accepted candidate into the case.
create table if not exists public.case_evidence_refs (
  id                     uuid primary key default gen_random_uuid(),
  organization_id        uuid not null references public.organizations (id) on delete cascade,
  case_id                uuid not null references public.cases (id) on delete cascade,
  marketplace_event_id   uuid not null references public.marketplace_events (id) on delete cascade,
  role                   text not null,
  created_at             timestamptz not null default now(),
  constraint case_evidence_refs_unique unique (case_id, marketplace_event_id, role)
);

create index if not exists idx_case_evidence_refs_case
  on public.case_evidence_refs (case_id);

-- Members read their org's cases + audit + evidence; writes are server-side.
grant select on public.cases to authenticated;
grant select on public.case_events to authenticated;
grant select on public.case_evidence_refs to authenticated;

alter table public.cases enable row level security;
alter table public.case_events enable row level security;
alter table public.case_evidence_refs enable row level security;

create policy cases_select on public.cases
  for select to authenticated using (public.is_org_member(organization_id));

create policy case_events_select on public.case_events
  for select to authenticated using (public.is_org_member(organization_id));

create policy case_evidence_refs_select on public.case_evidence_refs
  for select to authenticated using (public.is_org_member(organization_id));
