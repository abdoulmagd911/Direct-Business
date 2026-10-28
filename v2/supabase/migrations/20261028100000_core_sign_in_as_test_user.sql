-- V656 (2): the owner-only "Sign in as test user" switch, the server side (Builder A's lane; the banner and button are
-- Builder D's). For testing only; it goes with the TEST users before go-live (V656 (5)).
--  - Who may switch: the people in core.test_switch_holder, and only while they hold the admin role. The table has no
--    door: the owner's own account is added once in the database's SQL editor, so no real id is in this repository
--    (rule 7). Any other admin is refused.
--  - To whom: a person marked TEST in the data (core.person.is_test), active and not removed. Anyone else is refused.
--  - The switch belongs to the signed-in device (core.device_session.as_person_id): it ends when that device signs out,
--    is idle past its days or its session ends, and a new device starts unswitched. Leaving the holder list or the
--    admin role ends it at once. No switching on to another person while switched.
--  - While switched, authz.me() is the TEST person: every read and write is theirs. Every request is logged as the TEST
--    person with the owner named (audit.request.switched_by); the switch itself is logged both ways.
--  - No access change while switched: whatever needs the admin role (settings, e-mails, sign-ins, people, roles) or an
--    org.* capability is refused.
-- authz.real_me() is the former authz.me(), unchanged: the signed-in person behind the session. Forward-only (V103).

alter table core.person add column is_test boolean not null default false;
comment on column core.person.is_test is 'V656: a TEST user, seeded for testing and removed before go-live; the switch only reaches these.';

create table core.test_switch_holder (
  person_id uuid primary key references core.person (id),
  added_at timestamptz not null default now(),
  note text
);
alter table core.test_switch_holder enable row level security;
revoke all on core.test_switch_holder from anon, authenticated;
comment on table core.test_switch_holder is
  'V656: the accounts that may switch to a TEST user (the owner''s own). No door: added in the SQL editor, never in the repo.';

alter table core.device_session add column as_person_id uuid references core.person (id);
alter table core.device_session add column as_since timestamptz;
alter table core.device_session add constraint device_session_as_since check ((as_person_id is null) = (as_since is null));
create index device_session_as_person on core.device_session (as_person_id);
comment on column core.device_session.as_person_id is 'V656: the TEST person this device is switched to, if any.';

alter table audit.request add column switched_by uuid references core.person (id);
create index audit_request_switched_by on audit.request (switched_by);
comment on column audit.request.switched_by is 'V656: who had switched to the TEST person this request is logged as.';

-- the six TEST users of 20261026210000 are marked in the data
do $$
begin
  if exists (select 1 from core.person p where p.id = core.test_id('person', 1)) then
    perform audit.begin('system', 'test_users.marked');
    update core.person set is_test = true
    where id in (select core.test_id('person', n) from pg_catalog.generate_series(1, 6) n);
    perform audit.end();
  end if;
end
$$;

create function authz.real_me() returns uuid
language sql stable security definer set search_path = ''
as $$
  select p.id
  from core.person_auth a
  join core.person p on p.id = a.person_id
  where a.auth_user_id = auth.uid()
    and not a.must_change_password
    and p.kind = 'staff' and p.active and p.can_sign_in and p.deleted_at is null
    and (p.left_on is null or p.left_on > core.riyadh_today())
    and exists (select 1 from core.person_email e
                where e.person_id = p.id and e.email operator(extensions.=) a.email and e.deleted_at is null)
    and (core.live_device()).id is not null
$$;


-- The TEST person a signed-in person has switched this device to, while every condition still holds; else null.
create function authz.switch_target(p_real uuid) returns uuid
language sql stable security definer set search_path = ''
as $$
  select d.as_person_id
  from core.device_session d
  join core.person t on t.id = d.as_person_id
  where p_real is not null
    and d.id = (core.live_device()).id and d.person_id = p_real
    and t.is_test and t.active and t.deleted_at is null
    and exists (select 1 from core.test_switch_holder h join core.person o on o.id = h.person_id
                join core.role r on r.id = o.role_id
                where h.person_id = p_real and r.is_admin)
$$;
revoke all on function authz.switch_target(uuid) from public;

-- Who the session acts as: the TEST person while switched (V656), else the signed-in person.
create or replace function authz.me() returns uuid
language sql stable security definer set search_path = ''
as $$
  select coalesce(authz.switch_target(x.id), x.id) from (select authz.real_me() as id) x
$$;

-- The signed-in person, when they have switched to a TEST person; else null.
create function authz.switched_by() returns uuid
language sql stable security definer set search_path = ''
as $$
  select x.id from (select authz.real_me() as id) x where authz.switch_target(x.id) is not null
$$;
grant execute on function authz.real_me(), authz.switched_by() to authenticated;

create or replace function audit.begin(p_kind text default 'ui', p_label_key text default null, p_label_args jsonb default null,
                            p_reason text default null) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  depth int := coalesce(nullif(pg_catalog.current_setting('app.request_depth', true), '')::int, 0);
  r uuid;
  actor uuid;
begin
  if depth > 0 then
    perform pg_catalog.set_config('app.request_depth', (depth + 1)::text, true);
    return nullif(pg_catalog.current_setting('app.request_id', true), '')::uuid;
  end if;
  actor := case p_kind
             when 'import' then core.import_person_id()
             when 'job' then core.system_person_id()
             when 'system' then core.system_person_id()
             else authz.me()
           end;
  if actor is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person',
      detail = 'This sign-in has no active person behind it.';
  end if;
  -- V656: a write while switched to a TEST user is the TEST user's, naming who switched
  insert into audit.request (actor_id, kind, label_key, label_args, reason, switched_by)
  values (actor, p_kind, p_label_key, p_label_args, p_reason, case when p_kind = 'ui' then authz.switched_by() end)
  returning id into r;
  perform pg_catalog.set_config('app.request_id', r::text, true);
  perform pg_catalog.set_config('app.request_depth', '1', true);
  return r;
end
$$;

create or replace function authz.require(p_page text, p_level core.level) returns uuid
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  -- V656: no access change while switched to a TEST user: nothing above view on a Settings page but one's own profile
  if p_page like 'settings.%' and p_page <> 'settings.profile' and p_level > 'view' and authz.switched_by() is not null then
    raise exception using errcode = '42501', message = 'test_switch.no_access_change';
  end if;
  if authz.level_of(me, p_page) < p_level then
    raise exception using errcode = '42501', message = 'access.needs_level',
      detail = pg_catalog.jsonb_build_object('page', p_page, 'level', p_level)::text;
  end if;
  return me;
end
$$;

create or replace function authz.require_admin() returns uuid
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  -- V656: no access change while switched to a TEST user
  if authz.switched_by() is not null then
    raise exception using errcode = '42501', message = 'test_switch.no_access_change';
  end if;
  if not authz.is_admin() then
    raise exception using errcode = '42501', message = 'access.needs_admin';
  end if;
  return me;
end
$$;

create or replace function authz.require_capability(p_capability text) returns uuid
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  -- V656: no access change while switched to a TEST user (the org.* capabilities are access)
  if p_capability like 'org.%' and authz.switched_by() is not null then
    raise exception using errcode = '42501', message = 'test_switch.no_access_change';
  end if;
  if not authz.can_of(me, p_capability) then
    raise exception using errcode = '42501', message = 'access.needs_capability',
      detail = pg_catalog.jsonb_build_object('capability', p_capability)::text;
  end if;
  return me;
end
$$;

create or replace function core.me() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  a core.person_auth;
  p core.person;
  r core.role;
  pr core.person_profile;
  d core.device_session;
  sw uuid;
begin
  if uid is null then
    raise exception using errcode = '42501', message = 'auth.not_signed_in';
  end if;
  select * into a from core.person_auth where auth_user_id = uid;
  if a.id is null or not exists (select 1 from core.person_email e
                                 where e.person_id = a.person_id and e.email operator(extensions.=) a.email
                                   and e.deleted_at is null) then
    return pg_catalog.jsonb_build_object('status', 'not_listed');
  end if;
  select * into p from core.person where id = a.person_id;
  if p.kind <> 'staff' or not p.active or not p.can_sign_in or p.deleted_at is not null
     or p.left_on <= core.riyadh_today() then
    return pg_catalog.jsonb_build_object('status', 'switched_off');
  end if;
  select * into d from core.device_session s where s.auth_session_id = core.jwt_session_id() and s.auth_user_id = uid;
  if d.id is null then
    return pg_catalog.jsonb_build_object('status', 'signed_out', 'reason', 'unknown');
  end if;
  if d.signed_out_at is not null then
    return pg_catalog.jsonb_build_object('status', 'signed_out', 'reason', d.sign_out_reason);
  end if;
  if d.last_seen_at <= core.clock() - pg_catalog.make_interval(days => core.device_idle_days()) then
    return pg_catalog.jsonb_build_object('status', 'signed_out', 'reason', 'inactive');
  end if;
  if a.must_change_password then
    return pg_catalog.jsonb_build_object('status', 'must_change_password',
      'session', pg_catalog.jsonb_build_object('device_id', d.id, 'email', a.email));
  end if;
  -- V656: switched to a TEST user, the session reads as them; 'test_switch' names who switched (the banner)
  sw := authz.switched_by();
  if sw is not null then
    select * into p from core.person where id = authz.me();
  end if;
  select * into r from core.role where id = p.role_id;
  select * into pr from core.person_profile where person_id = p.id;
  return pg_catalog.jsonb_build_object(
    'status', 'ok',
    'test_switch', case when sw is null then null else (
      select pg_catalog.jsonb_build_object('by_id', b.id, 'by_name_en', b.full_name_en, 'by_name_ar', b.full_name_ar,
                                           'since', d.as_since)
      from core.person b where b.id = sw) end,
    'session', pg_catalog.jsonb_build_object(
      'device_id', d.id, 'signed_in_at', d.signed_in_at, 'last_seen_at', d.last_seen_at, 'email', a.email),
    'person', pg_catalog.jsonb_build_object(
      'id', p.id, 'kind', p.kind, 'version', p.version,
      'full_name_en', p.full_name_en, 'full_name_ar', p.full_name_ar,
      'nickname_en', p.nickname_en, 'nickname_ar', p.nickname_ar,
      'job_title_en', p.job_title_en, 'job_title_ar', p.job_title_ar,
      'department_id', p.department_id, 'team_id', p.team_id, 'manager_id', p.manager_id,
      'role', case when r.id is null then null else pg_catalog.jsonb_build_object(
        'id', r.id, 'key', r.key, 'name_en', r.name_en, 'name_ar', r.name_ar, 'is_admin', r.is_admin) end),
    'levels', coalesce((
      select pg_catalog.jsonb_object_agg(pg.key, authz.level_of(p.id, pg.key))
      from core.page pg where pg.active), '{}'::jsonb),
    'capabilities', coalesce((
      select pg_catalog.jsonb_agg(c.key order by c.key)
      from core.capability c where c.active and authz.can_of(p.id, c.key)), '[]'::jsonb),
    'departments', (
      select pg_catalog.jsonb_agg(ds.dep order by ds.dep)
      from (select p.department_id as dep
            union
            select pd.department_id from core.person_department pd
            where pd.person_id = p.id and pd.deleted_at is null) ds),
    'profile', case when pr.id is null then null else pg_catalog.jsonb_build_object(
      'display_name_en', pr.display_name_en, 'display_name_ar', pr.display_name_ar,
      'avatar_file_id', pr.avatar_file_id, 'avatar_color', pr.avatar_color,
      'badge_kind', pr.badge_kind, 'badge_value', pr.badge_value,
      'theme', pr.theme, 'density', pr.density, 'locale', pr.locale, 'start_page', pr.start_page,
      'drawer_pinned', pr.drawer_pinned, 'notify', pr.notify, 'version', pr.version) end
  );
end
$$;

create or replace function core.test_users_seed() returns jsonb
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
                             joined_on, is_test)
    values (core.test_id('person', i), nm[i], nm_ar[i], 'Test user', dep, case when team_of[i] is null then null else team_ids[team_of[i]] end,
            (select r.id from core.role r where r.key = role_key[i]), true, day, true);
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


-- The switch (V656 (2)). Refusals: test_switch.not_allowed (not on the list, or not an admin), test_switch.not_a_test_user
-- (not marked TEST, inactive or removed), test_switch.already_switched (no switching on), auth.no_active_person.
create function core.test_switch_start(p_person uuid) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  holder uuid := authz.real_me();
  dev uuid := (core.live_device()).id;
begin
  if holder is null or dev is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  if not exists (select 1 from core.test_switch_holder h join core.person o on o.id = h.person_id
                 join core.role r on r.id = o.role_id where h.person_id = holder and r.is_admin) then
    raise exception using errcode = '42501', message = 'test_switch.not_allowed';
  end if;
  if authz.switch_target(holder) is not null then
    raise exception using errcode = 'P0001', message = 'test_switch.already_switched';
  end if;
  if not exists (select 1 from core.person t where t.id = p_person and t.is_test and t.active and t.deleted_at is null) then
    raise exception using errcode = '42501', message = 'test_switch.not_a_test_user';
  end if;
  update core.device_session set as_person_id = p_person, as_since = pg_catalog.now() where id = dev;
  -- logged as the TEST person, the owner named
  perform audit.begin('ui', 'test_switch.started', pg_catalog.jsonb_build_object('person_id', p_person));
  perform audit.end();
  return pg_catalog.jsonb_build_object('person_id', p_person);
end
$$;

-- Back to my account: ends this device's switch; false when it was not switched.
create function core.test_switch_end() returns boolean
language plpgsql volatile security definer set search_path = ''
as $$
declare
  holder uuid := authz.real_me();
  t uuid := authz.switch_target(holder);
begin
  if t is null then
    -- a lapsed switch (the list or the role changed) is cleared without a log row: nothing was done as anyone
    update core.device_session set as_person_id = null, as_since = null
    where id = (core.live_device()).id and as_person_id is not null;
    return false;
  end if;
  perform audit.begin('ui', 'test_switch.ended', pg_catalog.jsonb_build_object('person_id', t));
  perform audit.end();
  update core.device_session set as_person_id = null, as_since = null where id = (core.live_device()).id;
  return true;
end
$$;
revoke all on function core.test_switch_start(uuid), core.test_switch_end() from public;
grant execute on function core.test_switch_start(uuid), core.test_switch_end() to authenticated;

create function api.test_switch_start(p_person uuid) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select core.test_switch_start(p_person) $$;
comment on function api.test_switch_start(uuid) is 'V656: the owner switches this device to a TEST user (logged).';
create function api.test_switch_end() returns boolean
language sql volatile security invoker set search_path = ''
as $$ select core.test_switch_end() $$;
comment on function api.test_switch_end() is 'V656: back to my account (logged).';
revoke all on function api.test_switch_start(uuid), api.test_switch_end() from public;
grant execute on function api.test_switch_start(uuid), api.test_switch_end() to authenticated;

-- QA-612: a device's own sign-outs and list belong to the signed-in person, not the TEST person they are switched to,
-- so signing out ends the switch (V656 (2)). Ending a device also clears its switch.
create or replace function core.my_devices() returns table (id uuid, device_label text, signed_in_at timestamptz,
                                                            last_seen_at timestamptz, this_device boolean)
language sql stable security definer set search_path = ''
as $$
  select d.id, d.device_label, d.signed_in_at, d.last_seen_at, d.auth_session_id = core.jwt_session_id()
  from core.device_session d
  where d.person_id = authz.real_me() and d.signed_out_at is null
    and d.last_seen_at > core.clock() - pg_catalog.make_interval(days => core.device_idle_days())
  order by d.last_seen_at desc
$$;
create or replace function core.device_sign_out(p_device uuid default null) returns int
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.real_me();
  n int;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  n := core.end_devices(me, coalesce(p_device, (core.live_device()).id), null, 'person', me);
  if n = 0 then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  return n;
end
$$;
create or replace function core.device_sign_out_others() returns int
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.real_me();
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  return core.end_devices(me, null, (core.live_device()).id, 'person', me);
end
$$;

create or replace function core.end_devices(p_person uuid, p_device uuid, p_except uuid, p_reason text, p_by uuid) returns int
language plpgsql volatile security definer set search_path = ''
as $$
declare
  d core.device_session;
  n int := 0;
begin
  for d in
    update core.device_session s
    set signed_out_at = pg_catalog.now(), signed_out_by = p_by, sign_out_reason = p_reason, as_person_id = null,
        as_since = null
    where s.person_id = p_person and s.signed_out_at is null
      and (p_device is null or s.id = p_device)
      and (p_except is null or s.id <> p_except)
    returning s.*
  loop
    delete from auth.sessions where id = d.auth_session_id;
    insert into core.sign_in_log (person_id, auth_user_id, auth_session_id, email, provider, result, detail)
    values (d.person_id, d.auth_user_id, d.auth_session_id,
            (select a.email from core.person_auth a where a.auth_user_id = d.auth_user_id), 'email', 'signed_out',
            p_reason);
    n := n + 1;
  end loop;
  return n;
end
$$;
