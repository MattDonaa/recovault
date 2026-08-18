-- Milestone 02 — Row-Level Security
-- Deny cross-organization access by default. Every tenant table is protected
-- server-side by RLS keyed on the caller's organization membership.
--
-- Role model (Supabase-native; mirrored by the offline test shim):
--   anon           -> unauthenticated; no tenant access
--   authenticated  -> end users; constrained by these policies
--   service_role   -> trusted server key; BYPASSRLS for admin/system tasks

-- ---------------------------------------------------------------------------
-- Membership helper functions (SECURITY DEFINER to avoid recursive RLS on
-- organization_members; executed as the function owner, which bypasses RLS).
-- ---------------------------------------------------------------------------
create or replace function public.is_org_member(org uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = org
      and m.user_id = auth.uid()
  );
$$;

create or replace function public.has_org_role(org uuid, roles public.org_role[])
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = org
      and m.user_id = auth.uid()
      and m.role = any(roles)
  );
$$;

-- ---------------------------------------------------------------------------
-- Grants: schema + table privileges. RLS then narrows row visibility.
-- `anon` intentionally receives nothing on tenant tables.
-- ---------------------------------------------------------------------------
grant usage on schema public to authenticated;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.has_org_role(uuid, public.org_role[]) to authenticated;

grant select, insert, update, delete on public.organizations to authenticated;
grant select, insert, update, delete on public.organization_members to authenticated;
grant select, insert, update, delete on public.marketplace_accounts to authenticated;
-- audit_events is append-only for end users: no update/delete privilege.
grant select, insert on public.audit_events to authenticated;

-- ---------------------------------------------------------------------------
-- Enable + force RLS on all tenant tables.
-- ---------------------------------------------------------------------------
alter table public.organizations        enable row level security;
alter table public.organization_members enable row level security;
alter table public.marketplace_accounts enable row level security;
alter table public.audit_events         enable row level security;

-- ---------------------------------------------------------------------------
-- organizations
-- ---------------------------------------------------------------------------
-- Members see their organizations. The creator is also allowed directly so
-- that INSERT ... RETURNING works during org bootstrap (the owner membership is
-- seeded by an AFTER INSERT trigger, which has not yet run when RETURNING
-- evaluates the SELECT policy). Cross-tenant isolation is unaffected: another
-- tenant matches neither clause.
create policy organizations_select on public.organizations
  for select to authenticated
  using (public.is_org_member(id) or created_by = auth.uid());

create policy organizations_insert on public.organizations
  for insert to authenticated
  with check (created_by = auth.uid());

create policy organizations_update on public.organizations
  for update to authenticated
  using (public.has_org_role(id, array['owner','admin']::public.org_role[]))
  with check (public.has_org_role(id, array['owner','admin']::public.org_role[]));

create policy organizations_delete on public.organizations
  for delete to authenticated
  using (public.has_org_role(id, array['owner']::public.org_role[]));

-- ---------------------------------------------------------------------------
-- organization_members
-- ---------------------------------------------------------------------------
create policy organization_members_select on public.organization_members
  for select to authenticated
  using (public.is_org_member(organization_id));

create policy organization_members_insert on public.organization_members
  for insert to authenticated
  with check (public.has_org_role(organization_id, array['owner','admin']::public.org_role[]));

create policy organization_members_update on public.organization_members
  for update to authenticated
  using (public.has_org_role(organization_id, array['owner','admin']::public.org_role[]))
  with check (public.has_org_role(organization_id, array['owner','admin']::public.org_role[]));

create policy organization_members_delete on public.organization_members
  for delete to authenticated
  using (public.has_org_role(organization_id, array['owner','admin']::public.org_role[]));

-- ---------------------------------------------------------------------------
-- marketplace_accounts
-- ---------------------------------------------------------------------------
create policy marketplace_accounts_select on public.marketplace_accounts
  for select to authenticated
  using (public.is_org_member(organization_id));

create policy marketplace_accounts_insert on public.marketplace_accounts
  for insert to authenticated
  with check (public.has_org_role(organization_id, array['owner','admin']::public.org_role[]));

create policy marketplace_accounts_update on public.marketplace_accounts
  for update to authenticated
  using (public.has_org_role(organization_id, array['owner','admin']::public.org_role[]))
  with check (public.has_org_role(organization_id, array['owner','admin']::public.org_role[]));

create policy marketplace_accounts_delete on public.marketplace_accounts
  for delete to authenticated
  using (public.has_org_role(organization_id, array['owner','admin']::public.org_role[]));

-- ---------------------------------------------------------------------------
-- audit_events (append-only: select + insert for members; no update/delete)
-- ---------------------------------------------------------------------------
create policy audit_events_select on public.audit_events
  for select to authenticated
  using (public.is_org_member(organization_id));

create policy audit_events_insert on public.audit_events
  for insert to authenticated
  with check (
    public.is_org_member(organization_id)
    and (actor_user_id is null or actor_user_id = auth.uid())
  );
