-- Milestone 08 — Normalized marketplace ledger
-- Append-oriented, marketplace-independent event ledger derived deterministically
-- from validated source records. Money is stored as integer minor units
-- (bigint) — never binary floating point. Tenant-isolated by RLS.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'marketplace_event_type') then
    create type public.marketplace_event_type as enum (
      'sale',
      'shipment_item',
      'return',
      'payment',
      'charge',
      'reversal',
      'adjustment'
    );
  end if;
end $$;

create table if not exists public.marketplace_events (
  id                       uuid primary key default gen_random_uuid(),
  organization_id          uuid not null references public.organizations (id) on delete cascade,
  marketplace_account_id   uuid not null references public.marketplace_accounts (id) on delete cascade,
  marketplace              text not null,
  event_type               public.marketplace_event_type not null,
  -- Canonical entity references.
  external_ref             text not null,          -- source external id
  sku                      text,
  order_external_id        text,
  references_json          jsonb not null default '{}'::jsonb,
  -- Quantity where applicable.
  quantity                 integer,
  -- Exact monetary amount where applicable (integer minor units + ISO currency).
  amount_minor             bigint,
  currency                 text,
  occurred_at              timestamptz,
  -- Provenance / traceability.
  source_record_id         uuid not null references public.source_records (id) on delete cascade,
  normalizer_version       text not null,
  -- Deterministic dedup key: idempotent, append-only ledger.
  event_key                text not null,
  created_at               timestamptz not null default now(),
  constraint marketplace_events_unique_key
    unique (marketplace_account_id, event_key)
);

create index if not exists idx_marketplace_events_account_type
  on public.marketplace_events (marketplace_account_id, event_type);
create index if not exists idx_marketplace_events_source
  on public.marketplace_events (source_record_id);
create index if not exists idx_marketplace_events_org
  on public.marketplace_events (organization_id);
create index if not exists idx_marketplace_events_sku
  on public.marketplace_events (marketplace_account_id, sku);

-- Members may read their org's ledger; writes are performed by trusted server
-- code (service role, BYPASSRLS).
grant select on public.marketplace_events to authenticated;

alter table public.marketplace_events enable row level security;

create policy marketplace_events_select on public.marketplace_events
  for select to authenticated
  using (public.is_org_member(organization_id));
