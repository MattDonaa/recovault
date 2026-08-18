-- Milestone 06 — Secure marketplace connection
-- Credentials are stored ENCRYPTED, in a table separate from account metadata,
-- and are never readable by end users. The encryption key lives only in the
-- environment (never in the database). Decryption happens server-side only.

-- ---------------------------------------------------------------------------
-- Account verification metadata (non-secret, sanitized).
-- ---------------------------------------------------------------------------
alter table public.marketplace_accounts
  add column if not exists verified_at timestamptz;
alter table public.marketplace_accounts
  add column if not exists last_verification_error text;

-- ---------------------------------------------------------------------------
-- marketplace_credentials — encrypted secrets, one per account.
-- ---------------------------------------------------------------------------
create table if not exists public.marketplace_credentials (
  id                      uuid primary key default gen_random_uuid(),
  marketplace_account_id  uuid not null unique
    references public.marketplace_accounts (id) on delete cascade,
  organization_id         uuid not null
    references public.organizations (id) on delete cascade,
  -- AES-256-GCM ciphertext envelope (v1.<iv>.<tag>.<ciphertext>). Never plaintext.
  encrypted_secret        text not null,
  key_version             integer not null default 1,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index if not exists idx_marketplace_credentials_org
  on public.marketplace_credentials (organization_id);

drop trigger if exists trg_marketplace_credentials_updated_at
  on public.marketplace_credentials;
create trigger trg_marketplace_credentials_updated_at
  before update on public.marketplace_credentials
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Access control: NO end-user access at all. Encrypted credentials are only
-- ever touched by trusted server code (the service role, which BYPASSRLS).
-- RLS is enabled with no permissive policy for `authenticated`/`anon`, and the
-- table grants are revoked from them — so client-scoped roles are denied both
-- by privilege and by policy. Cross-tenant access is therefore impossible for
-- any client credential.
-- ---------------------------------------------------------------------------
alter table public.marketplace_credentials enable row level security;

revoke all on public.marketplace_credentials from authenticated;
revoke all on public.marketplace_credentials from anon;
grant all on public.marketplace_credentials to service_role;
