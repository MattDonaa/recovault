-- Milestone 09 — Deterministic recovery engine
-- Recovery candidates are produced by versioned, deterministic rules from the
-- canonical ledger. Every candidate is explainable (rule + calculation inputs +
-- linked ledger events → source records). Money is exact integer minor units.
-- No LLM determines liability, amount, confidence, or eligibility.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'recovery_candidate_status') then
    -- detected -> investigating -> accepted | dismissed
    create type public.recovery_candidate_status as enum (
      'detected', 'investigating', 'accepted', 'dismissed'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'recovery_confidence') then
    create type public.recovery_confidence as enum ('HIGH', 'MEDIUM', 'LOW');
  end if;
end $$;

create table if not exists public.recovery_candidates (
  id                       uuid primary key default gen_random_uuid(),
  organization_id          uuid not null references public.organizations (id) on delete cascade,
  marketplace_account_id   uuid not null references public.marketplace_accounts (id) on delete cascade,
  rule_id                  text not null,
  rule_version             text not null,
  status                   public.recovery_candidate_status not null default 'detected',
  confidence               public.recovery_confidence not null,
  confidence_score         integer not null,
  -- Exact potential recovery (integer minor units); null when quantity-based.
  potential_recovery_minor bigint,
  currency                 text,
  sku                      text,
  external_ref             text,
  title                    text not null,
  summary                  text not null,
  calculation              jsonb not null default '{}'::jsonb,
  -- Deterministic dedup key → idempotent detection (append-only per key).
  candidate_key            text not null,
  detected_at              timestamptz not null default now(),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  constraint recovery_candidates_unique_key
    unique (marketplace_account_id, candidate_key)
);

create index if not exists idx_recovery_candidates_account
  on public.recovery_candidates (marketplace_account_id, rule_id);
create index if not exists idx_recovery_candidates_org
  on public.recovery_candidates (organization_id);

drop trigger if exists trg_recovery_candidates_updated_at on public.recovery_candidates;
create trigger trg_recovery_candidates_updated_at
  before update on public.recovery_candidates
  for each row execute function public.set_updated_at();

-- Evidence: link each candidate to the ledger events that justify it, for full
-- source → ledger → rule → calculation traceability.
create table if not exists public.recovery_candidate_evidence (
  id                       uuid primary key default gen_random_uuid(),
  organization_id          uuid not null references public.organizations (id) on delete cascade,
  recovery_candidate_id    uuid not null references public.recovery_candidates (id) on delete cascade,
  marketplace_event_id     uuid not null references public.marketplace_events (id) on delete cascade,
  role                     text not null,
  created_at               timestamptz not null default now(),
  constraint recovery_candidate_evidence_unique
    unique (recovery_candidate_id, marketplace_event_id, role)
);

create index if not exists idx_recovery_candidate_evidence_candidate
  on public.recovery_candidate_evidence (recovery_candidate_id);

-- Members read their org's candidates + evidence; writes are server-side.
grant select on public.recovery_candidates to authenticated;
grant select on public.recovery_candidate_evidence to authenticated;

alter table public.recovery_candidates enable row level security;
alter table public.recovery_candidate_evidence enable row level security;

create policy recovery_candidates_select on public.recovery_candidates
  for select to authenticated using (public.is_org_member(organization_id));

create policy recovery_candidate_evidence_select on public.recovery_candidate_evidence
  for select to authenticated using (public.is_org_member(organization_id));
