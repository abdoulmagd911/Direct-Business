-- Team & Access → the team list (oversight, 2026-09-25, "before release 2"): who is on the team list,
-- in which department, who heads each department, who is active — changed by an ADMIN OR A MANAGER
-- only, enforced here in the database, and every change recorded in record_history (the trigger
-- trg_record_history already sits on team_members and departments since release 1).
--
-- What changes:
--   1. team_members: admin OR manager may add a person and change their department / active; removing a
--      row outright stays admin-only (a person who leaves is made inactive, which keeps their history).
--   2. departments: admin OR manager may set a department's head; only an admin may rename, move,
--      add or remove a department (guard below — the row rule alone would let a manager rename).
--   3. Guards, for everyone including admins: a head must be an active person on the team list; a
--      person who heads a department cannot be made inactive until someone else heads it; a team-list
--      row is never re-pointed to another login; a new row needs an active login. Making someone
--      inactive stamps left_on (the table's own check requires it) and making them active clears it.
-- Direct database work (no signed-in person) is not refused by the admin-only column guard — imports
-- and repairs by SQL stay possible, and are recorded with no actor, as today.
-- Rollback: scripts/sql/team-list-editing.rollback.sql

-- 1. team_members — who may write
drop policy if exists team_members_write on public.team_members;
drop policy if exists team_members_insert on public.team_members;
drop policy if exists team_members_update on public.team_members;
drop policy if exists team_members_delete on public.team_members;
create policy team_members_insert on public.team_members for insert to authenticated
  with check (public.app_role() in ('admin','manager'));
create policy team_members_update on public.team_members for update to authenticated
  using (public.app_role() in ('admin','manager')) with check (public.app_role() in ('admin','manager'));
create policy team_members_delete on public.team_members for delete to authenticated
  using (public.app_role() = 'admin');

-- 2. departments — who may write
drop policy if exists departments_write on public.departments;
drop policy if exists departments_insert on public.departments;
drop policy if exists departments_update on public.departments;
drop policy if exists departments_delete on public.departments;
create policy departments_insert on public.departments for insert to authenticated
  with check (public.app_role() = 'admin');
create policy departments_update on public.departments for update to authenticated
  using (public.app_role() in ('admin','manager')) with check (public.app_role() in ('admin','manager'));
create policy departments_delete on public.departments for delete to authenticated
  using (public.app_role() = 'admin');

-- 3. guards
create or replace function public.departments_guard() returns trigger
language plpgsql security definer set search_path to public as $$
begin
  if auth.uid() is not null and public.app_role() is distinct from 'admin'
     and (new.code, new.name_en, new.name_ar, new.parent_id, new.active, new.sort)
         is distinct from (old.code, old.name_en, old.name_ar, old.parent_id, old.active, old.sort) then
    raise exception 'Only an admin can rename, move or switch off a department; a manager may set who heads it';
  end if;
  if new.head_member_id is not null and new.head_member_id is distinct from old.head_member_id
     and not exists (select 1 from team_members where id = new.head_member_id and active) then
    raise exception 'A department head must be an active person on the team list';
  end if;
  return new;
end $$;
drop trigger if exists departments_guard on public.departments;
create trigger departments_guard before update on public.departments
  for each row execute function public.departments_guard();

create or replace function public.team_list_guard() returns trigger
language plpgsql security definer set search_path to public as $$
declare d text;
begin
  if tg_op = 'UPDATE' and new.user_id is distinct from old.user_id then
    raise exception 'A team-list entry stays with its login; add the other login as its own entry instead';
  end if;
  if tg_op = 'INSERT' and not exists (select 1 from app_users where id = new.user_id and active) then
    raise exception 'Only an active login can be added to the team list';
  end if;
  if tg_op = 'UPDATE' and old.active and not new.active then
    select string_agg(name_en, ', ' order by sort) into d from departments where head_member_id = new.id;
    if d is not null then
      raise exception 'This person heads % — choose a new head first, then make them inactive', d;
    end if;
    if new.left_on is null then new.left_on := current_date; end if;
  end if;
  if tg_op = 'UPDATE' and not old.active and new.active then new.left_on := null; end if;
  return new;
end $$;
drop trigger if exists team_list_guard on public.team_members;
create trigger team_list_guard before insert or update on public.team_members
  for each row execute function public.team_list_guard();

revoke all on function public.departments_guard() from public, anon;
revoke all on function public.team_list_guard() from public, anon;
