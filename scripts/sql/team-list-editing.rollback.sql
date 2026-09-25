-- Rollback of scripts/sql/team-list-editing.sql: the team list goes back to admin-only writes (as release 1
-- shipped it) and the two guards are removed. Nothing in the rows themselves is changed.
drop trigger if exists team_list_guard on public.team_members;
drop trigger if exists departments_guard on public.departments;
drop function if exists public.team_list_guard();
drop function if exists public.departments_guard();
drop policy if exists team_members_insert on public.team_members;
drop policy if exists team_members_update on public.team_members;
drop policy if exists team_members_delete on public.team_members;
drop policy if exists departments_insert on public.departments;
drop policy if exists departments_update on public.departments;
drop policy if exists departments_delete on public.departments;
create policy team_members_write on public.team_members for all
  using (public.app_role() = 'admin'::user_role) with check (public.app_role() = 'admin'::user_role);
create policy departments_write on public.departments for all
  using (public.app_role() = 'admin'::user_role) with check (public.app_role() = 'admin'::user_role);
