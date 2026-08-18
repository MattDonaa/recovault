-- TEST-ONLY Supabase compatibility shim.
--
-- Recreates the minimal pieces of a Supabase database that our production
-- migrations depend on, so the SAME migrations can run against an offline
-- PGlite instance. This file is NEVER applied to a real Supabase project
-- (where auth.users, auth.uid(), and the anon/authenticated/service_role roles
-- already exist). It lives under tests/ and is excluded from supabase/migrations.

create schema if not exists auth;

-- Minimal stand-in for auth.users (Supabase manages the real table).
create table if not exists auth.users (
  id    uuid primary key default gen_random_uuid(),
  email text
);

-- auth.uid(): reads the JWT `sub` claim from the per-transaction GUC, exactly
-- as Supabase/PostgREST expose it. Hardened against empty/missing claims.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(
    nullif(current_setting('request.jwt.claims', true), '')::json ->> 'sub',
    ''
  )::uuid;
$$;

-- Supabase roles.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end $$;

grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant select on auth.users to authenticated, service_role;
