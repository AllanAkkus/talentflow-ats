-- =============================================================================
-- TalentFlow - 002_rls_policies.sql
-- Row Level Security: the actual tenant isolation boundary.
--
-- Rules enforced here (not in the frontend):
--   * A customer can only read/write rows whose organization_id equals the
--     organization_id on their own profile.
--   * A platform admin (profiles.role = 'admin') can read/write every org.
--   * The anon role gets nothing: every policy is scoped `to authenticated`.
--   * INSERT/UPDATE use WITH CHECK, so a client cannot smuggle in a foreign
--     organization_id ("org spoofing") even though the column is writable.
--
-- The three helper functions are SECURITY DEFINER so that a policy on
-- `profiles` can read `profiles` without triggering infinite policy recursion.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helper functions
-- -----------------------------------------------------------------------------
create or replace function public.tf_role()
returns text
language sql
stable
security definer
set search_path = public
as $fn$
  select p.role from public.profiles p where p.id = auth.uid()
$fn$;

create or replace function public.tf_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $fn$
  select p.organization_id from public.profiles p where p.id = auth.uid()
$fn$;

create or replace function public.tf_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select coalesce(
    (select p.role = 'admin' from public.profiles p where p.id = auth.uid()),
    false
  )
$fn$;

revoke all on function public.tf_role() from public, anon;
revoke all on function public.tf_org_id() from public, anon;
revoke all on function public.tf_is_admin() from public, anon;
grant execute on function public.tf_role() to authenticated;
grant execute on function public.tf_org_id() to authenticated;
grant execute on function public.tf_is_admin() to authenticated;

-- -----------------------------------------------------------------------------
-- Enable RLS everywhere. No table in `public` is readable without a policy.
-- -----------------------------------------------------------------------------
alter table public.organizations enable row level security;
alter table public.profiles      enable row level security;
alter table public.jobs          enable row level security;
alter table public.candidates    enable row level security;
alter table public.applications  enable row level security;

-- -----------------------------------------------------------------------------
-- organizations
--   Customers may read only their own org (needed to show its name in the UI).
--   Only platform admins may create/rename/delete organizations.
-- -----------------------------------------------------------------------------
drop policy if exists organizations_select on public.organizations;
create policy organizations_select on public.organizations
  for select to authenticated
  using (public.tf_is_admin() or id = public.tf_org_id());

drop policy if exists organizations_insert on public.organizations;
create policy organizations_insert on public.organizations
  for insert to authenticated
  with check (public.tf_is_admin());

drop policy if exists organizations_update on public.organizations;
create policy organizations_update on public.organizations
  for update to authenticated
  using (public.tf_is_admin())
  with check (public.tf_is_admin());

drop policy if exists organizations_delete on public.organizations;
create policy organizations_delete on public.organizations
  for delete to authenticated
  using (public.tf_is_admin());

-- -----------------------------------------------------------------------------
-- profiles
--   Everyone can read their own profile (the app needs it to resolve role).
--   Customers can also read colleagues in the same organization.
--   Writes are admin-only; in practice they happen through the service-role
--   key in /api/admin/users, which bypasses RLS entirely.
-- -----------------------------------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or public.tf_is_admin()
    or (public.tf_org_id() is not null and organization_id = public.tf_org_id())
  );

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert to authenticated
  with check (public.tf_is_admin());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated
  using (public.tf_is_admin())
  with check (public.tf_is_admin());

drop policy if exists profiles_delete on public.profiles;
create policy profiles_delete on public.profiles
  for delete to authenticated
  using (public.tf_is_admin());

-- -----------------------------------------------------------------------------
-- jobs
-- -----------------------------------------------------------------------------
drop policy if exists jobs_select on public.jobs;
create policy jobs_select on public.jobs
  for select to authenticated
  using (public.tf_is_admin() or organization_id = public.tf_org_id());

drop policy if exists jobs_insert on public.jobs;
create policy jobs_insert on public.jobs
  for insert to authenticated
  with check (public.tf_is_admin() or organization_id = public.tf_org_id());

drop policy if exists jobs_update on public.jobs;
create policy jobs_update on public.jobs
  for update to authenticated
  using (public.tf_is_admin() or organization_id = public.tf_org_id())
  with check (public.tf_is_admin() or organization_id = public.tf_org_id());

drop policy if exists jobs_delete on public.jobs;
create policy jobs_delete on public.jobs
  for delete to authenticated
  using (public.tf_is_admin() or organization_id = public.tf_org_id());

-- -----------------------------------------------------------------------------
-- candidates
-- -----------------------------------------------------------------------------
drop policy if exists candidates_select on public.candidates;
create policy candidates_select on public.candidates
  for select to authenticated
  using (public.tf_is_admin() or organization_id = public.tf_org_id());

drop policy if exists candidates_insert on public.candidates;
create policy candidates_insert on public.candidates
  for insert to authenticated
  with check (public.tf_is_admin() or organization_id = public.tf_org_id());

drop policy if exists candidates_update on public.candidates;
create policy candidates_update on public.candidates
  for update to authenticated
  using (public.tf_is_admin() or organization_id = public.tf_org_id())
  with check (public.tf_is_admin() or organization_id = public.tf_org_id());

drop policy if exists candidates_delete on public.candidates;
create policy candidates_delete on public.candidates
  for delete to authenticated
  using (public.tf_is_admin() or organization_id = public.tf_org_id());

-- -----------------------------------------------------------------------------
-- applications
-- -----------------------------------------------------------------------------
drop policy if exists applications_select on public.applications;
create policy applications_select on public.applications
  for select to authenticated
  using (public.tf_is_admin() or organization_id = public.tf_org_id());

drop policy if exists applications_insert on public.applications;
create policy applications_insert on public.applications
  for insert to authenticated
  with check (public.tf_is_admin() or organization_id = public.tf_org_id());

drop policy if exists applications_update on public.applications;
create policy applications_update on public.applications
  for update to authenticated
  using (public.tf_is_admin() or organization_id = public.tf_org_id())
  with check (public.tf_is_admin() or organization_id = public.tf_org_id());

drop policy if exists applications_delete on public.applications;
create policy applications_delete on public.applications
  for delete to authenticated
  using (public.tf_is_admin() or organization_id = public.tf_org_id());
