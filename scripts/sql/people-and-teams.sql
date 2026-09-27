-- people-and-teams.sql (2026-09-27) — the owner's order of 26 Sep, part 2: one admin page for People & teams.
-- Words as agreed on the Drive home page "00 — START HERE (Direct · All In)" §3: the DEPARTMENT is Commercial; a TEAM is
-- a unit inside it (Business Development, Business Solutions, Partnerships, Tenders, Quality, Complaints, Strategy,
-- Integrity). Teams are a setting: an admin or a manager adds, renames or retires them — never deletes; a retired team's
-- history stays and its open work moves to another team. Every person has ONE home team and may ASSIST other teams.
-- Everyone reports to Othman Al Sharafi (the head of Commercial) for now; the field stays for when the team grows.
-- Only an admin or a manager changes people and teams — enforced HERE; a user can only sign in and out.
--
-- In the tables: a team is a `departments` row under the Commercial row (parent_id); a person's home team is
-- team_members.department_id; the teams they assist are rows of the new team_member_assists.
-- A task's / an achievement's team is chosen (home team + assisted teams offered first on screen); the database only
-- insists it is an active team, and fills the owner's home team when none is given.
-- Rollback: scripts/sql/people-and-teams.rollback.sql.

-- ---------------------------------------------------------------------------------------------------------------
-- 1. names: first and last, in English and Arabic (full_name / name_ar stay, composed from them — the rest of the app
--    and the ownership matching read those)
-- ---------------------------------------------------------------------------------------------------------------
alter table public.app_users add column if not exists first_name_en text;
alter table public.app_users add column if not exists last_name_en text;
alter table public.app_users add column if not exists first_name_ar text;
alter table public.app_users add column if not exists last_name_ar text;
update public.app_users set
  first_name_en = coalesce(first_name_en, nullif(split_part(trim(full_name), ' ', 1), '')),
  last_name_en  = coalesce(last_name_en,  nullif(trim(substr(trim(full_name), length(split_part(trim(full_name), ' ', 1)) + 1)), '')),
  first_name_ar = coalesce(first_name_ar, nullif(split_part(trim(name_ar), ' ', 1), '')),
  last_name_ar  = coalesce(last_name_ar,  nullif(trim(substr(trim(name_ar), length(split_part(trim(name_ar), ' ', 1)) + 1)), ''))
 where first_name_en is null or first_name_ar is null;

-- The roster every people list reads (Tasks, achievements, KPIs, "Assigned to", ownership matching). Found by the
-- audit of 2026-09-27: the view reads the login table with the READER's rights (every view here must — N13), and a
-- non-admin may read only their own login row — so since the view was switched to security_invoker, a team member
-- and the manager saw ONE name in every people list (themselves), and only admins saw the team. js/33 says the roster
-- is "readable by every signed-in user"; that is restored here without giving up N13: the rows come from a
-- security-definer FUNCTION that answers only an active signed-in person, the view stays security_invoker, and a
-- view over a function cannot be written through.
create or replace function public.team_roster()
returns table (id uuid, email text, full_name text, name_ar text, nickname text, role public.user_role, active boolean,
               first_name_en text, last_name_en text, first_name_ar text, last_name_ar text)
language sql stable security definer set search_path to 'public' as $$
  select u.id, u.email, u.full_name, u.name_ar, u.nickname, u.role, u.active,
         u.first_name_en, u.last_name_en, u.first_name_ar, u.last_name_ar
    from public.app_users u where public.app_role() is not null
$$;
revoke all on function public.team_roster() from public, anon;
grant execute on function public.team_roster() to authenticated;
drop view if exists public.team_directory;
create view public.team_directory with (security_invoker = on) as select * from public.team_roster();
revoke all on public.team_directory from anon;
grant select on public.team_directory to authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- 2. teams: admins AND managers add / rename / retire; nobody deletes
-- ---------------------------------------------------------------------------------------------------------------
drop policy if exists departments_insert on public.departments;
create policy departments_insert on public.departments for insert to authenticated
  with check (public.app_role() in ('admin','manager'));
drop policy if exists departments_delete on public.departments;          -- no delete policy: nobody deletes a team
drop trigger if exists departments_no_delete on public.departments;
create trigger departments_no_delete before delete on public.departments for each row execute function public.block_hard_delete();

create or replace function public.departments_guard() returns trigger language plpgsql security definer
set search_path to 'public' as $$
declare top uuid; n int;
begin
  -- WHO may change a team is the row rules' job (departments_insert / departments_update: admin or manager);
  -- this guard says WHAT a change may be
  new.name_en := nullif(trim(new.name_en), ''); new.name_ar := nullif(trim(new.name_ar), '');
  if new.name_en is null or new.name_ar is null then
    raise exception 'A team needs a name in English and in Arabic'; end if;
  if tg_op = 'INSERT' then
    select id into top from departments where parent_id is null and active order by sort, name_en limit 1;
    new.parent_id := coalesce(new.parent_id, top);
    if not exists (select 1 from departments where id = new.parent_id and parent_id is null and active) then
      raise exception 'A new team goes under the department (Commercial)'; end if;
    if new.code is null or trim(new.code) = '' then
      new.code := trim(both '_' from regexp_replace(lower(new.name_en), '[^a-z0-9]+', '_', 'g'));
      if new.code = '' then new.code := 'team'; end if;
      select count(*) into n from departments where code = new.code or code like new.code || '\_%';
      if n > 0 then new.code := new.code || '_' || (n + 1); end if;
    end if;
    if coalesce(new.sort, 0) = 0 then new.sort := (select coalesce(max(sort), 0) + 1 from departments); end if;   -- last, unless an order is given
    new.active := coalesce(new.active, true);
  else
    if new.code is distinct from old.code then raise exception 'A team''s code never changes — rename it instead'; end if;
    if new.parent_id is distinct from old.parent_id then raise exception 'A team stays in its department'; end if;
    if old.parent_id is null and not new.active then raise exception 'The department itself cannot be retired'; end if;
    if old.active and not new.active then
      if exists (select 1 from tasks t join task_statuses s on s.code = t.status
                  where t.department_id = old.id and t.deleted_at is null and not s.is_closed)
         or exists (select 1 from projects where department_id = old.id and deleted_at is null and status not in ('done','cancelled'))
         or exists (select 1 from team_members where department_id = old.id and active) then
        raise exception 'This team still has open work or people — use Retire, which moves them to another team first'; end if;
    end if;
  end if;
  if new.active and exists (select 1 from departments d where d.id <> new.id and d.active
       and (lower(d.name_en) = lower(new.name_en) or d.name_ar = new.name_ar)) then
    raise exception 'Another active team already has that name'; end if;
  if new.head_member_id is not null and (tg_op = 'INSERT' or new.head_member_id is distinct from old.head_member_id)
     and not exists (select 1 from team_members where id = new.head_member_id and active) then
    raise exception 'A department head must be an active person on the team list'; end if;
  return new;
end $$;
drop trigger if exists departments_guard on public.departments;
create trigger departments_guard before insert or update on public.departments
  for each row execute function public.departments_guard();

-- retire a team: its open tasks and projects, and the people whose home team it is, move to another team first
create or replace function public.team_retire(p_team uuid, p_move_to uuid) returns jsonb language plpgsql security definer
set search_path to 'public' as $$
declare t record; m record; nt int; np int; nm int; na int;
begin
  if coalesce(public.app_role()::text, '') not in ('admin','manager') then
    raise exception 'Only an admin or a manager can change teams' using errcode = '42501'; end if;
  select * into t from departments where id = p_team;
  if not found or t.parent_id is null then raise exception 'That is not a team'; end if;
  if not t.active then raise exception 'That team is already retired'; end if;
  select * into m from departments where id = p_move_to;
  if not found or not m.active or m.id = p_team then
    raise exception 'Choose another active team to move its open work to'; end if;
  update tasks set department_id = p_move_to where department_id = p_team and deleted_at is null
     and status not in (select code from task_statuses where is_closed);
  get diagnostics nt = row_count;
  update projects set department_id = p_move_to where department_id = p_team and deleted_at is null
     and status not in ('done','cancelled');
  get diagnostics np = row_count;
  update team_members set department_id = p_move_to where department_id = p_team;
  get diagnostics nm = row_count;
  delete from team_member_assists a where a.team_id = p_team
     or (a.team_id = p_move_to and a.member_id in (select id from team_members where department_id = p_move_to));
  get diagnostics na = row_count;
  update departments set active = false where id = p_team;
  return jsonb_build_object('team', t.name_en, 'moved_to', m.name_en, 'tasks', nt, 'projects', np, 'people', nm, 'assists_ended', na);
end $$;
revoke all on function public.team_retire(uuid, uuid) from public, anon;
grant execute on function public.team_retire(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- 3. the teams a person assists
-- ---------------------------------------------------------------------------------------------------------------
create table if not exists public.team_member_assists (
  member_id uuid not null references public.team_members(id) on delete restrict,
  team_id   uuid not null references public.departments(id) on delete restrict,
  added_at  timestamptz not null default now(),
  added_by  uuid,
  id uuid not null default gen_random_uuid() unique,
  primary key (member_id, team_id));
alter table public.team_member_assists enable row level security;
drop policy if exists tma_read on public.team_member_assists;
create policy tma_read on public.team_member_assists for select to authenticated using (public.app_role() is not null);
drop policy if exists tma_insert on public.team_member_assists;
create policy tma_insert on public.team_member_assists for insert to authenticated with check (public.app_role() in ('admin','manager'));
drop policy if exists tma_delete on public.team_member_assists;
create policy tma_delete on public.team_member_assists for delete to authenticated using (public.app_role() in ('admin','manager'));
grant select, insert, delete on public.team_member_assists to authenticated;

create or replace function public.team_member_assists_guard() returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if not exists (select 1 from departments where id = new.team_id and parent_id is not null and active) then
    raise exception 'A person can only assist an active team'; end if;
  if not exists (select 1 from team_members where id = new.member_id and active) then
    raise exception 'Only an active person on the team list can assist a team'; end if;
  if exists (select 1 from team_members where id = new.member_id and department_id = new.team_id) then
    raise exception 'That is already their home team'; end if;
  new.added_by := coalesce(new.added_by, auth.uid()); new.added_at := now();
  return new;
end $$;
drop trigger if exists team_member_assists_guard on public.team_member_assists;
create trigger team_member_assists_guard before insert on public.team_member_assists
  for each row execute function public.team_member_assists_guard();
drop trigger if exists trg_record_history on public.team_member_assists;
create trigger trg_record_history after insert or update or delete on public.team_member_assists
  for each row execute function public.record_history_write();

-- a person's home team must be an active team or the department itself
create or replace function public.team_members_home_guard() returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if (tg_op = 'INSERT' or new.department_id is distinct from old.department_id)
     and not exists (select 1 from departments where id = new.department_id and active) then
    raise exception 'A home team must be an active team'; end if;
  if new.reports_to is not null and (tg_op = 'INSERT' or new.reports_to is distinct from old.reports_to) then
    if new.reports_to = new.id then raise exception 'Nobody reports to themselves'; end if;
    if not exists (select 1 from team_members where id = new.reports_to and active) then
      raise exception 'Reports-to must be an active person on the team list'; end if;
  end if;
  if tg_op = 'UPDATE' and new.department_id is distinct from old.department_id then
    delete from team_member_assists where member_id = new.id and team_id = new.department_id;   -- home now, not assisted
  end if;
  return new;
end $$;
drop trigger if exists team_members_home_guard on public.team_members;
create trigger team_members_home_guard before insert or update of department_id, reports_to on public.team_members
  for each row execute function public.team_members_home_guard();

-- ---------------------------------------------------------------------------------------------------------------
-- 4. saving a person — the only way names, home team, assisted teams, reports-to and job titles change.
--    Role and page levels keep their own guarded paths (admin-users set_role; set_page_levels).
-- ---------------------------------------------------------------------------------------------------------------
create or replace function public.person_save(p_user uuid, p jsonb) returns jsonb language plpgsql security definer
set search_path to 'public' as $$
declare me text := coalesce(public.app_role()::text, ''); u app_users%rowtype; mid uuid; home uuid; rep uuid;
        fe text; le text; fa text; la text; a uuid; before jsonb; after jsonb;
begin
  if me not in ('admin','manager') then
    raise exception 'Only an admin or a manager can change people' using errcode = '42501'; end if;
  select * into u from app_users where id = p_user;
  if not found then raise exception 'No such person' using errcode = 'P0002'; end if;
  if u.role = 'admin' and me <> 'admin' then
    raise exception 'Only an admin can change an admin''s details' using errcode = '42501'; end if;
  if p is null or jsonb_typeof(p) <> 'object' then raise exception 'Nothing to save'; end if;

  before := jsonb_build_object('first_name_en', u.first_name_en, 'last_name_en', u.last_name_en,
                               'first_name_ar', u.first_name_ar, 'last_name_ar', u.last_name_ar);
  if p ?| array['first_name_en','last_name_en','first_name_ar','last_name_ar'] then
    fe := nullif(trim(coalesce(p->>'first_name_en', u.first_name_en)), '');
    le := nullif(trim(coalesce(p->>'last_name_en',  u.last_name_en)), '');
    fa := nullif(trim(coalesce(p->>'first_name_ar', u.first_name_ar)), '');
    la := nullif(trim(coalesce(p->>'last_name_ar',  u.last_name_ar)), '');
    if fe is null or fa is null then raise exception 'A first name is needed in English and in Arabic'; end if;
    update app_users set first_name_en = fe, last_name_en = le, first_name_ar = fa, last_name_ar = la,
           full_name = trim(fe || ' ' || coalesce(le, '')), name_ar = trim(fa || ' ' || coalesce(la, ''))
     where id = p_user;
    after := jsonb_build_object('first_name_en', fe, 'last_name_en', le, 'first_name_ar', fa, 'last_name_ar', la);
    if after is distinct from before then
      insert into record_history(actor, actor_name, table_name, record_id, action, before_row, after_row)
      values (auth.uid(), (select coalesce(nullif(full_name, ''), email) from app_users where id = auth.uid()),
              'app_users', p_user, 'edit', before || jsonb_build_object('email', u.email), after || jsonb_build_object('email', u.email));
    end if;
  end if;

  select id into mid from team_members where user_id = p_user;
  if p ? 'home_team' then
    home := nullif(p->>'home_team', '')::uuid;
    if home is null then raise exception 'Choose a home team'; end if;
    if mid is null then
      insert into team_members(user_id, department_id, active) values (p_user, home, true) returning id into mid;
    else
      update team_members set department_id = home where id = mid;
    end if;
  end if;
  if mid is null and (p ? 'reports_to' or p ? 'assists' or p ? 'job_title_en' or p ? 'job_title_ar') then
    raise exception 'Choose a home team first — that puts them on the team list'; end if;
  if p ? 'reports_to' then
    rep := nullif(p->>'reports_to', '')::uuid;
    update team_members set reports_to = rep where id = mid;
  end if;
  if p ? 'job_title_en' or p ? 'job_title_ar' then
    update team_members set job_title_en = coalesce(nullif(trim(p->>'job_title_en'), ''), case when p ? 'job_title_en' then null else job_title_en end),
                            job_title_ar = coalesce(nullif(trim(p->>'job_title_ar'), ''), case when p ? 'job_title_ar' then null else job_title_ar end)
     where id = mid;
  end if;
  if p ? 'assists' then
    if jsonb_typeof(p->'assists') <> 'array' then raise exception 'Assisted teams must be a list'; end if;
    delete from team_member_assists where member_id = mid
       and team_id not in (select (x #>> '{}')::uuid from jsonb_array_elements(p->'assists') x);
    for a in select distinct (x #>> '{}')::uuid from jsonb_array_elements(p->'assists') x loop
      if not exists (select 1 from team_member_assists where member_id = mid and team_id = a) then
        insert into team_member_assists(member_id, team_id) values (mid, a);
      end if;
    end loop;
  end if;
  return (select jsonb_build_object('user', p_user, 'member', mid, 'full_name', full_name, 'name_ar', name_ar) from app_users where id = p_user);
end $$;
revoke all on function public.person_save(uuid, jsonb) from public, anon;
grant execute on function public.person_save(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- 5. a task's and an achievement's team is CHOSEN: it must be an active team; none given → the owner's home team
-- ---------------------------------------------------------------------------------------------------------------
create or replace function public.tasks_guard() returns trigger language plpgsql security definer set search_path to 'public' as $$
declare p record; parent record; owner_active boolean; v_done boolean;
begin
  -- who does it: given → project owner → company's account manager → whoever creates it
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
  end if;
  -- the team the work is done for (people & teams, 2026-09-27): chosen; the owner's home team when none is given
  if tg_op='INSERT' and new.department_id is null then
    select department_id into new.department_id from team_members where id=new.owner_id;
  end if;
  if (tg_op='INSERT' or new.department_id is distinct from old.department_id)
     and not exists (select 1 from departments where id = new.department_id and active) then
    raise exception 'Choose an active team for this task'; end if;
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

create or replace function public.report_entries_team_guard() returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if (tg_op = 'INSERT' or new.department_id is distinct from old.department_id)
     and not exists (select 1 from departments where id = new.department_id and active) then
    raise exception 'Choose an active team for this achievement'; end if;
  return new;
end $$;
drop trigger if exists report_entries_team_guard on public.report_entries;
create trigger report_entries_team_guard before insert or update of department_id on public.report_entries
  for each row execute function public.report_entries_team_guard();

-- ---------------------------------------------------------------------------------------------------------------
-- 6. the teams as agreed on the home page (§3), in its order; everyone reports to the head of Commercial for now
-- ---------------------------------------------------------------------------------------------------------------
update public.departments set name_en = 'Business Development', name_ar = 'تطوير الأعمال' where code = 'business' and name_en = 'Business';
update public.departments set name_en = 'Partnerships' where code = 'partnership' and name_en = 'Partnership';
insert into public.departments(code, name_en, name_ar, parent_id, sort)
  select 'business_solutions', 'Business Solutions', 'حلول الأعمال', (select id from public.departments where code = 'commercial'), 2
   where not exists (select 1 from public.departments where code = 'business_solutions');
insert into public.departments(code, name_en, name_ar, parent_id, sort)
  select 'tenders', 'Tenders', 'المناقصات', (select id from public.departments where code = 'commercial'), 4
   where not exists (select 1 from public.departments where code = 'tenders');
update public.departments d set sort = x.s from (values ('commercial',0),('business',1),('business_solutions',2),('partnership',3),
  ('tenders',4),('quality',5),('complaints',6),('strategy',7),('integrity',8)) x(c, s) where d.code = x.c and d.sort is distinct from x.s;
update public.team_members m set reports_to = h.head
  from (select head_member_id head from public.departments where code = 'commercial') h
 where h.head is not null and m.id <> h.head and m.reports_to is null;
