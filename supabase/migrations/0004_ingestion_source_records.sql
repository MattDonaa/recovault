-- Milestone 07 — Idempotent ingestion & source records
-- Preserve validated source provenance before any normalization/recovery.
-- Every source record retains full provenance; ingestion is idempotent via a
-- per-account external key. Tenant-isolated by RLS.

-- ---------------------------------------------------------------------------
-- sync_jobs — one row per ingestion run (observability + counts + checkpoint).
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'sync_job_status') then
    create type public.sync_job_status as enum ('running', 'completed', 'failed');
  end if;
end $$;

create table if not exists public.sync_jobs (
  id                      uuid primary key default gen_random_uuid(),
  organization_id         uuid not null references public.organizations (id) on delete cascade,
  marketplace_account_id  uuid not null references public.marketplace_accounts (id) on delete cascade,
  adapter                 text not null,
  status                  public.sync_job_status not null default 'running',
  started_at              timestamptz not null default now(),
  finished_at             timestamptz,
  pages_fetched           integer not null default 0,
  records_fetched         integer not null default 0,
  records_inserted        integer not null default 0,
  records_updated         integer not null default 0,
  records_rejected        integer not null default 0,
  checkpoint              text,
  error_code              text,
  error_message           text,
  created_at              timestamptz not null default now()
);

create index if not exists idx_sync_jobs_account
  on public.sync_jobs (marketplace_account_id, started_at desc);

-- ---------------------------------------------------------------------------
-- source_records — validated source provenance, idempotent per external key.
-- ---------------------------------------------------------------------------
create table if not exists public.source_records (
  id                       uuid primary key default gen_random_uuid(),
  organization_id          uuid not null references public.organizations (id) on delete cascade,
  marketplace_account_id   uuid not null references public.marketplace_accounts (id) on delete cascade,
  marketplace              text not null,
  external_type            text not null,
  external_id              text not null,
  source_timestamp         timestamptz,
  ingested_at              timestamptz not null default now(),
  schema_version           text not null,
  payload_hash             text not null,
  payload                  jsonb not null,
  version                  integer not null default 1,
  -- Provenance of first observation is immutable; last observation tracks change.
  first_seen_sync_job_id   uuid not null references public.sync_jobs (id) on delete restrict,
  last_seen_sync_job_id    uuid not null references public.sync_jobs (id) on delete restrict,
  updated_at               timestamptz not null default now(),
  constraint source_records_unique_external
    unique (marketplace_account_id, external_type, external_id)
);

create index if not exists idx_source_records_account_type
  on public.source_records (marketplace_account_id, external_type);
create index if not exists idx_source_records_org
  on public.source_records (organization_id);

-- ---------------------------------------------------------------------------
-- source_record_rejections — quarantined payloads (fail-closed), deduped.
-- ---------------------------------------------------------------------------
create table if not exists public.source_record_rejections (
  id                       uuid primary key default gen_random_uuid(),
  organization_id          uuid not null references public.organizations (id) on delete cascade,
  marketplace_account_id   uuid not null references public.marketplace_accounts (id) on delete cascade,
  sync_job_id              uuid not null references public.sync_jobs (id) on delete cascade,
  external_type            text not null,
  reason                   text not null,
  payload_hash             text not null,
  raw                      jsonb not null,
  created_at               timestamptz not null default now(),
  constraint source_record_rejections_unique
    unique (marketplace_account_id, external_type, payload_hash)
);

create index if not exists idx_source_record_rejections_account
  on public.source_record_rejections (marketplace_account_id, external_type);

-- ---------------------------------------------------------------------------
-- sync_checkpoints — last successful cursor per account + record type.
-- ---------------------------------------------------------------------------
create table if not exists public.sync_checkpoints (
  id                       uuid primary key default gen_random_uuid(),
  organization_id          uuid not null references public.organizations (id) on delete cascade,
  marketplace_account_id   uuid not null references public.marketplace_accounts (id) on delete cascade,
  external_type            text not null,
  cursor                   text,
  updated_at               timestamptz not null default now(),
  constraint sync_checkpoints_unique unique (marketplace_account_id, external_type)
);

-- updated_at maintenance
drop trigger if exists trg_source_records_updated_at on public.source_records;
create trigger trg_source_records_updated_at
  before update on public.source_records
  for each row execute function public.set_updated_at();

drop trigger if exists trg_sync_checkpoints_updated_at on public.sync_checkpoints;
create trigger trg_sync_checkpoints_updated_at
  before update on public.sync_checkpoints
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Grants + RLS. Members may READ their org's ingestion data (sync health);
-- writes are performed by trusted server code (service role, BYPASSRLS).
-- ---------------------------------------------------------------------------
grant select on public.sync_jobs to authenticated;
grant select on public.source_records to authenticated;
grant select on public.source_record_rejections to authenticated;
grant select on public.sync_checkpoints to authenticated;

alter table public.sync_jobs               enable row level security;
alter table public.source_records          enable row level security;
alter table public.source_record_rejections enable row level security;
alter table public.sync_checkpoints        enable row level security;

create policy sync_jobs_select on public.sync_jobs
  for select to authenticated using (public.is_org_member(organization_id));

create policy source_records_select on public.source_records
  for select to authenticated using (public.is_org_member(organization_id));

create policy source_record_rejections_select on public.source_record_rejections
  for select to authenticated using (public.is_org_member(organization_id));

create policy sync_checkpoints_select on public.sync_checkpoints
  for select to authenticated using (public.is_org_member(organization_id));
