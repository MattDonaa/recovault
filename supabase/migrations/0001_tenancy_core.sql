-- Milestone 02 — Tenancy core schema
-- Marketplace-agnostic multi-tenant foundation. No brand/marketplace names in
-- table identifiers. No marketplace credentials (metadata only). UTC timestamps.
--
-- Depends on the Supabase-provided `auth` schema (auth.users, auth.uid()). In
-- the offline test harness these are provided by tests/db/supabase-shim.sql.

-- ---------------------------------------------------------------------------
-- Enumerations
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'org_role') then
    create type public.org_role as enum ('owner', 'admin', 'member');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'marketplace_mode') then
    create type public.marketplace_mode as enum ('mock', 'live');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'marketplace_account_status') then
    create type public.marketplace_account_status as enum (
      'pending', 'connected', 'disconnected', 'error'
    );
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Shared helper: maintain updated_at
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- organizations
-- ---------------------------------------------------------------------------
create table if not exists public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(btrim(name)) between 1 and 200),
  slug        text not null unique check (slug ~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$'),
  created_by  uuid not null default auth.uid() references auth.users (id) on delete restrict,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists trg_organizations_updated_at on public.organizations;
create trigger trg_organizations_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- organization_members
-- ---------------------------------------------------------------------------
create table if not exists public.organization_members (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  user_id          uuid not null references auth.users (id) on delete cascade,
  role             public.org_role not null default 'member',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint organization_members_unique_membership unique (organization_id, user_id)
);

create index if not exists idx_organization_members_org
  on public.organization_members (organization_id);
create index if not exists idx_organization_members_user
  on public.organization_members (user_id);
-- At most one owner-seeding path; owners are queried frequently.
create index if not exists idx_organization_members_org_role
  on public.organization_members (organization_id, role);

drop trigger if exists trg_organization_members_updated_at on public.organization_members;
create trigger trg_organization_members_updated_at
  before update on public.organization_members
  for each row execute function public.set_updated_at();

-- Seed the creator as owner immediately after an organization is created.
-- SECURITY DEFINER so the insert is not blocked by organization_members RLS.
create or replace function public.handle_new_organization()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.organization_members (organization_id, user_id, role)
  values (new.id, new.created_by, 'owner')
  on conflict (organization_id, user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_organizations_seed_owner on public.organizations;
create trigger trg_organizations_seed_owner
  after insert on public.organizations
  for each row execute function public.handle_new_organization();

-- ---------------------------------------------------------------------------
-- marketplace_accounts (METADATA ONLY — never credentials/secrets)
-- ---------------------------------------------------------------------------
create table if not exists public.marketplace_accounts (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references public.organizations (id) on delete cascade,
  marketplace           text not null check (marketplace ~ '^[a-z][a-z0-9_]{1,49}$'),
  display_name          text not null check (length(btrim(display_name)) between 1 and 200),
  -- Non-secret external reference (e.g. seller id / account handle), if any.
  external_account_ref  text,
  mode                  public.marketplace_mode not null default 'mock',
  status                public.marketplace_account_status not null default 'pending',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint marketplace_accounts_unique_ref
    unique (organization_id, marketplace, external_account_ref)
);

create index if not exists idx_marketplace_accounts_org
  on public.marketplace_accounts (organization_id);

drop trigger if exists trg_marketplace_accounts_updated_at on public.marketplace_accounts;
create trigger trg_marketplace_accounts_updated_at
  before update on public.marketplace_accounts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- audit_events (append-only material state transitions)
-- ---------------------------------------------------------------------------
create table if not exists public.audit_events (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  actor_user_id    uuid references auth.users (id) on delete set null,
  action           text not null check (length(btrim(action)) between 1 and 100),
  entity_type      text not null check (length(btrim(entity_type)) between 1 and 100),
  entity_id        uuid,
  metadata         jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now()
);

create index if not exists idx_audit_events_org_created
  on public.audit_events (organization_id, created_at desc);
