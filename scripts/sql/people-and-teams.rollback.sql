-- people-and-teams.rollback.sql — undoes scripts/sql/people-and-teams.sql. The two teams added (Business Solutions,
-- Tenders) are RETIRED, not deleted (teams are never deleted — any task or achievement that named them keeps them),
-- the two renamed teams get their old names back, and the old rules return (renaming/retiring for admins only, a
-- task's team copied from its owner). Names typed as first/last stay in full_name/name_ar; the new columns are dropped.
drop trigger if exists report_entries_team_guard on public.report_entries;
drop function if exists public.report_entries_team_guard();
drop trigger if exists team_members_home_guard on public.team_members;
drop function if exists public.team_members_home_guard();
drop function if exists public.person_save(uuid, jsonb);
drop function if exists public.team_retire(uuid, uuid);
drop table if exists public.team_member_assists;
drop function if exists public.team_member_assists_guard();

create or replace function public.tasks_guard() returns trigger language plpgsql security definer set search_path to 'public' as $$
declare p record; parent record; owner_active boolean; v_done boolean;
begin
  if tg_op='INSERT' and new.owner_id is null then
    new.owner_id := coalesce((select owner_id from projects where id = new.project_id),
                             company_owner_member(coalesce(new.business_id, (select business_id from projects where id = new.project_id))),
                             my_member_id());
  end if;
  if (tg_op='INSERT' or new.owner_id is distinct from old.owner_id) then
    if not can_assign_to(new.owner_id) then
      raise exception 'Only an admin, a manager or the department head can assign tasks to someone else'; end if;
    if new.owner_id is distinct from my_member_id() then new.assigned_by := my_member_id(); new.assigned_at := now();
    elsif tg_op='UPDATE' then new.assigned_by := null; new.assigned_at := null; end if;
  end if;
  select active into owner_active from team_members where id = new.owner_id;
  if tg_op='INSERT' or new.owner_id is distinct from old.owner_id then
    if not coalesce(owner_active,false) then raise exception 'Owner is not an active team member'; end if;
    if tg_op='INSERT' or old.status not in (select ts.code from task_statuses ts where ts.is_done) then
      select department_id into new.department_id from team_members where id=new.owner_id;
    end if;
  end if;
  if tg_op='UPDATE' and old.done_at is not null
     and (new.done_at is distinct from old.done_at or new.status is distinct from old.status or new.deleted_at is distinct from old.deleted_at)
     and exists (select 1 from periods pr where pr.kind='month' and pr.locked_at is not null
                 and (old.done_at at time zone 'Asia/Riyadh')::date between pr.start_date and pr.end_date) then
    raise exception 'Task % is counted in an issued month — record a correction instead of editing it', old.code;
  end if;
  if new.project_id is not null then
    select * into p from projects where id=new.project_id;
    if p.deleted_at is not null then raise exception 'Project % is deleted', p.code; end if;
    if new.business_id is null then new.business_id := p.business_id;
    elsif p.business_id is not null and new.business_id <> p.business_id then
      raise exception 'Task company must match its project''s company'; end if;
  end if;
  if new.work_type <> 'internal' and new.business_id is null and new.project_id is null then
    raise exception 'Client work needs a company or a project'; end if;
  if new.contact_id is not null and not exists (select 1 from contacts c where c.id=new.contact_id and c.business_id is not distinct from new.business_id) then
    raise exception 'That contact belongs to a different company'; end if;
  if new.parent_task_id is not null then
    select * into parent from tasks where id=new.parent_task_id;
    if parent.parent_task_id is not null then raise exception 'Subtasks go one level deep only'; end if;
    if parent.project_id is distinct from new.project_id then raise exception 'Subtask must sit in its parent''s project'; end if;
  end if;
  if new.plan_entry_id is not null and (select section from report_entries where id=new.plan_entry_id) <> 'next_month_plan' then
    raise exception 'A task can only deliver a planned item (a "next month plan" line)'; end if;
  select s.is_done into v_done from task_statuses s where s.code=new.status;
  if v_done then
    if new.done_at is null then new.done_at := now(); end if;
    if new.done_by is null then new.done_by := my_member_id(); end if;
    if exists (select 1 from tasks c where c.parent_task_id=new.id and c.deleted_at is null
               and c.status not in (select ts.code from task_statuses ts where ts.is_closed)) then
      raise exception 'Close the open subtasks first'; end if;
  else new.done_at := null; new.done_by := null; end if;
  if tg_op='INSERT' and new.created_by is null then new.created_by := my_member_id(); end if;
  new.updated_at := now();
  return new;
end $$;

create or replace function public.departments_guard() returns trigger language plpgsql security definer set search_path to 'public' as $$
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
create trigger departments_guard before update on public.departments for each row execute function public.departments_guard();
drop trigger if exists departments_no_delete on public.departments;
drop policy if exists departments_insert on public.departments;
create policy departments_insert on public.departments for insert to authenticated with check (public.app_role() = 'admin');
drop policy if exists departments_delete on public.departments;
create policy departments_delete on public.departments for delete to authenticated using (public.app_role() = 'admin');

update public.departments set name_en = 'Business', name_ar = 'الأعمال' where code = 'business';
update public.departments set name_en = 'Partnership' where code = 'partnership';
update public.departments set active = false where code in ('business_solutions','tenders');

-- (a view cannot drop columns in place; recreate it, with the grant it had)
drop view if exists public.team_directory;
drop function if exists public.team_roster();
create view public.team_directory with (security_invoker = on) as select id, email, full_name, name_ar, nickname, role, active from public.app_users;
grant select on public.team_directory to authenticated;
alter table public.app_users drop column if exists first_name_en, drop column if exists last_name_en,
  drop column if exists first_name_ar, drop column if exists last_name_ar;
