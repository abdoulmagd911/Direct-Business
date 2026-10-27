-- The six TEST users (V656, owner's allowance of 26 Oct: hard-coded, so nobody creates accounts by hand in production).
-- Every row is named TEST and has a fixed id, so core.test_users_remove() (and v2/scripts/sql/remove-test-users.sql,
-- one step before go-live) finds exactly these and nothing else. Made-up names; no e-mail and no auth user is created
-- here, so nobody can sign in as them (they are marked able to sign in only because a task's owner must be): the owner's "Sign in as test user" switch (V656 part 2) is the only way in. Nothing is notified to anyone.
--
-- What it writes (in the commercial department, only when that department exists, and only once):
--   5 teams     TEST Admin team, TEST Head team (led by TEST Head), TEST Manager team (led by TEST Manager),
--               TEST Commercial team, TEST Viewer team
--   6 people    TEST Admin (Admin), TEST Head (Head), TEST Manager (Manager), TEST Commercial (Member, in its team),
--               TEST Member (Member, no team), TEST Viewer (Viewer, read-only); none has an e-mail or a sign-in account
--   6 notes     one private note each
--   10 tasks    each of the five non-viewers owns "a shared task" (the next person helps on it) and has one task given
--               to the next person (assigned_by); TEST Viewer helps on TEST Admin's shared task and owns none
-- The department's own head is never changed.

create function core.test_users_seed() returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  dep uuid := (select d.id from core.department d where d.code = 'commercial');
  day date := core.riyadh_today();
  who text[] := array['admin', 'head', 'manager', 'commercial', 'member', 'viewer'];
  nm text[] := array['TEST Admin', 'TEST Head', 'TEST Manager', 'TEST Commercial', 'TEST Member', 'TEST Viewer'];
  nm_ar text[] := array['تجريبي مسؤول', 'تجريبي رئيس', 'تجريبي مدير', 'تجريبي تجاري', 'تجريبي عضو', 'تجريبي مشاهد'];
  role_key text[] := array['admin', 'head', 'manager', 'member', 'member', 'viewer'];
  pid uuid[] := array[]::uuid[];
  tid uuid[] := array[null, null, null, null, null, null]::uuid[];
  team_of int[] := array[1, 2, 3, 4, null, 5];
  team_ids uuid[] := array[]::uuid[];
  team_nm text[] := array['TEST Admin team', 'TEST Head team', 'TEST Manager team', 'TEST Commercial team', 'TEST Viewer team'];
  team_code text[] := array['test_admin', 'test_head', 'test_manager', 'test_commercial', 'test_viewer'];
  status uuid := (select s.id from work.task_status s where s.is_default and s.deleted_at is null);
  i int;
  j int;
  t uuid;
  made_people int := 0;
  made_tasks int := 0;
begin
  if dep is null or status is null or exists (select 1 from core.person p where p.id = core.test_id('person', 1)) then
    return pg_catalog.jsonb_build_object('seeded', false);
  end if;
  perform audit.begin('system', 'test_users.seeded');
  -- teams (the commercial department's own head and teams are never touched)
  for i in 1 .. 5 loop
    insert into core.team (id, department_id, code, name_en, name_ar)
    values (core.test_id('team', i), dep, team_code[i], team_nm[i], 'فريق تجريبي ' || i);
    team_ids := team_ids || core.test_id('team', i);
  end loop;
  -- people
  for i in 1 .. 6 loop
    insert into core.person (id, full_name_en, full_name_ar, job_title_en, department_id, team_id, role_id, can_sign_in,
                             joined_on)
    values (core.test_id('person', i), nm[i], nm_ar[i], 'Test user', dep, case when team_of[i] is null then null else team_ids[team_of[i]] end,
            (select r.id from core.role r where r.key = role_key[i]), true, day);
    pid := pid || core.test_id('person', i);
    made_people := made_people + 1;
  end loop;
  update core.team set lead_person_id = pid[2] where id = team_ids[2];
  update core.team set lead_person_id = pid[3] where id = team_ids[3];
  -- one private note each
  for i in 1 .. 6 loop
    insert into my.note (id, person_id, kind, title, body, visibility, happened_on)
    values (core.test_id('note', i), pid[i], 'sticky', 'TEST private note of ' || nm[i],
            'A made-up private note, for testing only.', 'private', day);
  end loop;
  -- tasks: i owns "a shared task" (the next person helps); i gives a task to the next person (the viewer owns none)
  for i in 1 .. 5 loop
    j := case when i = 5 then 1 else i + 1 end;
    insert into work.task (id, number, title, notes, owner_id, team_id, department_id, status_id, work_type, happened_on)
    values (core.test_id('task', i), core.format_number('TSK', pg_catalog.date_part('year', day)::int,
              core.next_number('task', pg_catalog.date_part('year', day)::int)),
            'TEST shared task of ' || nm[i], 'A made-up task, for testing only.', pid[i],
            coalesce(team_ids[team_of[i]], team_ids[4]), dep, status, 'internal', day);
    insert into work.task_helper (task_id, person_id) values (core.test_id('task', i), pid[j]);
    made_tasks := made_tasks + 1;
    insert into work.task (id, number, title, notes, owner_id, team_id, department_id, status_id, work_type, assigned_by,
                           happened_on)
    values (core.test_id('task', i + 5), core.format_number('TSK', pg_catalog.date_part('year', day)::int,
              core.next_number('task', pg_catalog.date_part('year', day)::int)),
            'TEST task from ' || nm[i] || ' to ' || nm[j], 'A made-up task, for testing only.', pid[j],
            coalesce(team_ids[team_of[j]], team_ids[4]), dep, status, 'internal', pid[i], day);
    made_tasks := made_tasks + 1;
  end loop;
  insert into work.task_helper (task_id, person_id) values (core.test_id('task', 1), pid[6]);
  perform audit.end();
  return pg_catalog.jsonb_build_object('seeded', true, 'people', made_people, 'tasks', made_tasks, 'notes', 6, 'teams', 5);
end
$$;

-- The fixed id of the n-th TEST row of a kind: the removal finds exactly these.
create function core.test_id(p_kind text, p_n int) returns uuid
language sql immutable set search_path = ''
as $$
  select pg_catalog.format('7e570000-0000-4000-8000-%s%s',
    case p_kind when 'person' then '01' when 'team' then '02' when 'note' then '03' else '04' end,
    pg_catalog.lpad(p_n::text, 10, '0'))::uuid
$$;

-- The one-step removal, run before go-live: the TEST people, teams, notes and tasks are removed the way the app removes
-- them (soft, logged; teams retired — D11). Safe to run twice; touches nothing that is not a TEST id.
create function core.test_users_remove() returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := core.system_person_id();
  ppl uuid[] := array(select core.test_id('person', n) from pg_catalog.generate_series(1, 6) n);
  tms uuid[] := array(select core.test_id('team', n) from pg_catalog.generate_series(1, 5) n);
  nts uuid[] := array(select core.test_id('note', n) from pg_catalog.generate_series(1, 6) n);
  tks uuid[] := array(select core.test_id('task', n) from pg_catalog.generate_series(1, 10) n);
  c_t int;
  c_n int;
  c_p int;
begin
  perform audit.begin('system', 'test_users.removed');
  update work.task_helper set deleted_at = pg_catalog.now(), deleted_by = me, delete_reason = 'TEST rows removed'
    where task_id = any (tks) and deleted_at is null;
  update work.task set deleted_at = pg_catalog.now(), deleted_by = me, delete_reason = 'TEST rows removed'
    where id = any (tks) and deleted_at is null;
  get diagnostics c_t = row_count;
  update my.note set deleted_at = pg_catalog.now(), deleted_by = me, delete_reason = 'TEST rows removed'
    where id = any (nts) and deleted_at is null;
  get diagnostics c_n = row_count;
  update core.team set lead_person_id = null, active = false, retired_at = pg_catalog.now() where id = any (tms) and active;
  update core.person set can_sign_in = false, active = false, left_on = day.d, deleted_at = pg_catalog.now(), deleted_by = me,
                         delete_reason = 'TEST rows removed'
    from (select core.riyadh_today() as d) day
    where id = any (ppl) and deleted_at is null;
  get diagnostics c_p = row_count;
  perform audit.end();
  return pg_catalog.jsonb_build_object('tasks', c_t, 'notes', c_n, 'people', c_p);
end
$$;

revoke all on function core.test_users_seed(), core.test_users_remove(), core.test_id(text, int) from public;

-- Seed once on apply (a no-op where the commercial department does not exist yet, e.g. a database from zero).
select core.test_users_seed();
