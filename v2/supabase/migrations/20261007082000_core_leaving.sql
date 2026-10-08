-- P3-8c (part 2) · leaving and switching off (V452, V463), the active check on every person column (V465, OLD-006).
--  · Nobody is switched off, marked as left or removed while they still hold open work — open tasks, open projects,
--    open action items, or a side they own today or later — unless the same request hands it to a named person; a
--    department's head goes only once a new head is chosen (OLD-004, OLD-005). The rule sits on core.person itself, so
--    every door meets it: Switch off, the record's Left on, a removal, an Undo.
--  · api.person_leave: the day they left, the hand-over and the switch-off in one request with the count, one Undo (V452).
--    api.person_switch takes the same reassign-to person when switching off.
--  · A left_on on or before today refuses sign-in, whatever can_sign_in says (V463, ACC-008).
--  · Work changes hands with its notice: the new owner of a task, a project, an action item or a side is told (V456).
--  · Reports-to is never oneself or someone who cannot work here; a home team is active; a person assists only an active
--    team that is not their home team, and only while they can work here; the test account is never named (V465).
-- Recurring templates, KPI lead rows and report editing join the hand-over when their tables land (P5-1, P5-4, P6-1).

-- ================================================================ what a person still holds (V463)
-- Open tasks and projects they own, open action items on open tasks, and each side they own today or from a later day,
-- on an organisation that is live with that side on.
create function core.open_work(p_person uuid) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'tasks', (select pg_catalog.count(*) from work.task t
              where t.owner_id = p_person and t.deleted_at is null and t.closed_at is null),
    'projects', (select pg_catalog.count(*) from work.project p
                 where p.owner_id = p_person and p.deleted_at is null and p.closed_at is null),
    'action_items', (select pg_catalog.count(*) from work.action_item a join work.task t on t.id = a.task_id
                     where a.owner_id = p_person and a.deleted_at is null and a.done_on is null
                       and t.deleted_at is null and t.closed_at is null),
    'sides', (select pg_catalog.count(*) from partner.side_owner m join partner.partner p on p.id = m.partner_id
              where m.person_id = p_person and m.deleted_at is null
                and (m.effective_to is null or m.effective_to > core.riyadh_today())
                and p.deleted_at is null and p.archived_at is null and partner.side_on(m.partner_id, m.side)))
$$;
create function core.open_work_count(p_work jsonb) returns int
language sql immutable set search_path = ''
as $$ select coalesce((select pg_catalog.sum(v::int) from pg_catalog.jsonb_each_text(p_work) x (k, v)), 0)::int $$;

-- ================================================================ handing it over (V452)
-- Inside the caller's request: every open item `p_from` holds goes to `p_to` — a person who can work here and is a team
-- member — each new owner told (V456; past work tells nobody, V491). A side keeps its dates: one owned since before
-- today is ended today and continued by `p_to` from today; one starting today or later passes to `p_to` whole.
create function core.hand_over(p_from uuid, p_to uuid) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  today date := core.riyadh_today();
  t work.task;
  p work.project;
  a record;
  m partner.side_owner;
  k_tasks int := 0;
  k_projects int := 0;
  k_items int := 0;
  k_sides int := 0;
  told uuid[] := '{}';
begin
  if p_to = p_from then
    raise exception using errcode = 'P0001', message = 'person.hand_over_to_self';
  end if;
  if not exists (select 1 from core.person x where x.id = p_to and x.kind = 'staff' and x.deleted_at is null) then
    raise exception using errcode = 'P0002', message = 'common.not_found', detail = p_to::text;
  end if;
  perform work.require_person(p_to);
  for t in select * from work.task x where x.owner_id = p_from and x.deleted_at is null and x.closed_at is null
           order by x.number loop
    update work.task set owner_id = p_to, assigned_by = case when p_to <> me then me end where id = t.id;
    if not work.task_is_past(t) then
      perform notify.push_assigned(p_to, 'assigned', 'work.task', t.id);
    end if;
    k_tasks := k_tasks + 1;
  end loop;
  for p in select * from work.project x where x.owner_id = p_from and x.deleted_at is null and x.closed_at is null
           order by x.number loop
    update work.project set owner_id = p_to where id = p.id;
    if not work.is_past(p.happened_on) then
      perform notify.push_assigned(p_to, 'assigned', 'work.project', p.id);
    end if;
    k_projects := k_projects + 1;
  end loop;
  for a in select i.id, x as task from work.action_item i join work.task x on x.id = i.task_id
           where i.owner_id = p_from and i.deleted_at is null and i.done_on is null
             and x.deleted_at is null and x.closed_at is null
           order by x.number, i.sort, i.id loop
    update work.action_item set owner_id = p_to where id = a.id;
    if not work.task_is_past(a.task) then
      perform notify.push_assigned(p_to, 'assigned', 'work.action_item', a.id);
    end if;
    k_items := k_items + 1;
  end loop;
  for m in select x.* from partner.side_owner x join partner.partner o on o.id = x.partner_id
           where x.person_id = p_from and x.deleted_at is null and (x.effective_to is null or x.effective_to > today)
             and o.deleted_at is null and o.archived_at is null and partner.side_on(x.partner_id, x.side)
           order by x.partner_id, x.side, x.effective_from loop
    if m.effective_from >= today then
      update partner.side_owner set deleted_at = pg_catalog.now(), deleted_by = me, delete_reason = 'handed over'
      where id = m.id;
      insert into partner.side_owner (partner_id, side, person_id, effective_from, effective_to, reason)
      values (m.partner_id, m.side, p_to, m.effective_from, m.effective_to, 'handed over');
    else
      update partner.side_owner set effective_to = today where id = m.id;
      insert into partner.side_owner (partner_id, side, person_id, effective_from, effective_to, reason)
      values (m.partner_id, m.side, p_to, today, m.effective_to, 'handed over');
    end if;
    if not (m.partner_id = any (told)) then
      perform notify.push_assigned(p_to, 'assigned', 'partner.partner', m.partner_id);
      told := told || m.partner_id;
    end if;
    k_sides := k_sides + 1;
  end loop;
  return pg_catalog.jsonb_build_object('tasks', k_tasks, 'projects', k_projects, 'action_items', k_items,
                                       'sides', k_sides);
end
$$;

-- ================================================================ nobody goes while holding work (V463)
-- Switching someone off, setting a leaving day that has come, taking them off the active list or removing them is
-- refused while they head a department (choose the new head first) or hold open work (hand it over in the same request).
-- A leaving day still to come is accepted: on that day sign-in stops and what they hold stays, for an admin to hand over.
create function core.person_keep_work() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  today date := core.riyadh_today();
  d core.department;
  w jsonb;
begin
  if new.kind <> 'staff' then
    return new;
  end if;
  if not ((old.can_sign_in and not new.can_sign_in) or (old.active and not new.active)
          or (old.deleted_at is null and new.deleted_at is not null)
          or coalesce(new.left_on <= today and (old.left_on is null or old.left_on > today), false)) then
    return new;
  end if;
  select * into d from core.department x where x.head_person_id = new.id and x.deleted_at is null and x.active
  order by x.name_en limit 1;
  if d.id is not null then
    raise exception using errcode = 'P0001', message = 'person.head_needs_successor', detail = d.name_en;
  end if;
  w := core.open_work(new.id);
  if core.open_work_count(w) > 0 then
    raise exception using errcode = 'P0001', message = 'person.open_work', detail = w::text;
  end if;
  return new;
end
$$;
create trigger keep_work before update of can_sign_in, active, deleted_at, left_on on core.person
  for each row execute function core.person_keep_work();

-- ================================================================ switching off with a hand-over (V463)
-- core.person_switch as P3-6c wrote it, plus: switching off may name who takes the person's open work, in the same
-- request (the count on it, one Undo); a person whose leaving day has come is not switched back on until it is cleared.
drop function api.person_switch(uuid, boolean, text);
drop function core.person_switch(uuid, boolean, text);
create function core.person_switch(p_id uuid, p_on boolean, p_reason text, p_reassign_to uuid default null)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := core.person_guard_write(p_id);
  why text := core.access_reason(p_reason);
  req uuid;
  ended int := 0;
  handed jsonb;
  n int := 0;
begin
  if p_id = me then
    raise exception using errcode = '42501', message = 'access.not_your_own';
  end if;
  if p_on and exists (select 1 from core.person p where p.id = p_id and p.left_on <= core.riyadh_today()) then
    raise exception using errcode = 'P0001', message = 'person.has_left';
  end if;
  if p_on and p_reassign_to is not null then
    raise exception using errcode = 'P0001', message = 'person.reassign_needs_off';
  end if;
  if p_reassign_to is not null then
    n := core.open_work_count(core.open_work(p_id));
  end if;
  req := audit.begin('ui', case when p_on then 'person.switched_on' else 'person.switched_off' end,
                     case when p_reassign_to is not null then pg_catalog.jsonb_build_object('count', n) end, why);
  if p_reassign_to is not null then
    handed := core.hand_over(p_id, p_reassign_to);
  end if;
  update core.person set can_sign_in = p_on where id = p_id;
  if not p_on then
    ended := core.end_devices(p_id, null, null, 'switched_off', me);
  end if;
  perform audit.end();
  return pg_catalog.jsonb_build_object('can_sign_in', p_on, 'devices_ended', ended, 'handed_over', handed,
                                       'request_id', req);
end
$$;

-- ================================================================ leaving (V452)
-- The day they left (today unless named; never later — a leaving day still to come goes on the record), the hand-over
-- of everything they hold to the named person, and the switch-off: one request, the count on it, one Undo — an admin's
-- (a sign-in change, V128). With nothing to hand over no reassign-to is needed; with something, it is (V463).
create function core.person_leave(p_id uuid, p_left_on date, p_reassign_to uuid, p_reason text) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := core.person_guard_write(p_id);
  why text := core.access_reason(p_reason);
  today date := core.riyadh_today();
  d date := coalesce(p_left_on, core.riyadh_today());
  p core.person;
  w jsonb;
  req uuid;
  handed jsonb;
  ended int;
begin
  if p_id = me then
    raise exception using errcode = '42501', message = 'access.not_your_own';
  end if;
  select * into p from core.person where id = p_id;
  if d > today then
    raise exception using errcode = 'P0001', message = 'person.left_on_future';
  end if;
  if p.joined_on is not null and d < p.joined_on then
    raise exception using errcode = 'P0001', message = 'person.left_before_joined';
  end if;
  w := core.open_work(p_id);
  if p.left_on is not null and p.left_on <= today and not p.can_sign_in and core.open_work_count(w) = 0 then
    raise exception using errcode = 'P0001', message = 'person.already_left';
  end if;
  req := audit.begin('ui', 'person.left', pg_catalog.jsonb_build_object('count', core.open_work_count(w)), why);
  if p_reassign_to is not null then
    handed := core.hand_over(p_id, p_reassign_to);
  end if;
  update core.person set left_on = d, can_sign_in = false where id = p_id;
  ended := core.end_devices(p_id, null, null, 'switched_off', me);
  perform audit.end();
  return pg_catalog.jsonb_build_object('left_on', d, 'handed_over', coalesce(handed, pg_catalog.jsonb_build_object(
                                         'tasks', 0, 'projects', 0, 'action_items', 0, 'sides', 0)),
                                       'devices_ended', ended, 'request_id', req);
end
$$;

-- What a person holds, for the Leave and Switch off dialogs: Organization & access · View.
create function core.person_open_work(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform authz.require('settings.org', 'view');
  if not exists (select 1 from core.person p where p.id = p_id and p.kind = 'staff' and p.deleted_at is null) then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  return core.open_work(p_id) || pg_catalog.jsonb_build_object(
    'heads', (select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id', x.id, 'name_en', x.name_en,
                                                                        'name_ar', x.name_ar) order by x.name_en)
              from core.department x where x.head_person_id = p_id and x.deleted_at is null and x.active));
end
$$;

-- ================================================================ a leaving day that has come refuses sign-in (V463)
-- core.sign_in_state as P3-2 wrote it, authz.me() as P3-2f wrote it and core.me() as P3-2f wrote it — each also
-- treating a person whose left_on is today or earlier as switched off (ACC-008).
create or replace function core.sign_in_state(p_email text) returns text
language sql stable security definer set search_path = ''
as $$
  select coalesce((
    select case when p.kind = 'staff' and p.active and p.can_sign_in and p.deleted_at is null
                     and (p.left_on is null or p.left_on > core.riyadh_today())
                then 'allowed' else 'switched_off' end
    from core.person_email e join core.person p on p.id = e.person_id
    where e.email operator(extensions.=) p_email::extensions.citext and e.deleted_at is null), 'not_listed')
$$;

create or replace function authz.me() returns uuid
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
  select * into r from core.role where id = p.role_id;
  select * into pr from core.person_profile where person_id = p.id;
  return pg_catalog.jsonb_build_object(
    'status', 'ok',
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

-- ================================================================ the active check on every person column (V465)
-- core.person_available as P3-6f wrote it, and never the test account (V445): every owner, helper, mention, credited
-- person and assist row asks this, so the test account is named by none of them.
create or replace function core.person_available(p_person uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from core.person p
                 where p.id = p_person and p.kind = 'staff' and p.active and p.can_sign_in and p.deleted_at is null
                   and p.account <> 'test_account'
                   and (p.left_on is null or p.left_on > core.riyadh_today()))
$$;

-- core.person_guard as P3-2b wrote it, plus OLD-006: nobody reports to someone who cannot work here (nor to themselves —
-- the chain check), and a home team is an active one.
create or replace function core.person_guard() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  cur uuid := new.manager_id;
  hops int := 0;
begin
  if new.account <> 'team_member' and (new.team_id is not null or new.manager_id is not null) then
    raise exception using errcode = 'P0001', message = 'person.account_in_no_team', detail = new.account;
  end if;
  if new.team_id is not null
     and not exists (select 1 from core.team t where t.id = new.team_id and t.department_id = new.department_id) then
    raise exception using errcode = 'P0001', message = 'person.team_outside_department';
  end if;
  if new.team_id is distinct from old.team_id and new.team_id is not null
     and not exists (select 1 from core.team t where t.id = new.team_id and t.active) then
    raise exception using errcode = 'P0001', message = 'person.team_inactive';
  end if;
  if new.manager_id is distinct from old.manager_id and new.manager_id is not null
     and not core.is_team_member(new.manager_id) then
    raise exception using errcode = 'P0001', message = 'person.manager_not_team_member';
  end if;
  if new.manager_id is distinct from old.manager_id and new.manager_id is not null
     and not core.person_available(new.manager_id) then
    raise exception using errcode = 'P0001', message = 'person.manager_unavailable';
  end if;
  while cur is not null and hops < 1000 loop
    if cur = new.id then
      raise exception using errcode = 'P0001', message = 'person.manager_cycle';
    end if;
    select p.manager_id into cur from core.person p where p.id = cur;
    hops := hops + 1;
  end loop;
  return new;
end
$$;

-- A person assists an active team that is not their home team, and only while they can work here (OLD-006, V465).
create function core.person_assist_guard() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.deleted_at is not null or (tg_op = 'UPDATE' and old.deleted_at is null and new.team_id = old.team_id
                                    and new.person_id = old.person_id) then
    return new;
  end if;
  if not exists (select 1 from core.team t where t.id = new.team_id and t.active) then
    raise exception using errcode = 'P0001', message = 'person.assist_team_inactive';
  end if;
  if exists (select 1 from core.person p where p.id = new.person_id and p.team_id = new.team_id) then
    raise exception using errcode = 'P0001', message = 'person.assist_home_team';
  end if;
  if not core.person_available(new.person_id) then
    raise exception using errcode = 'P0001', message = 'person.unavailable', detail = new.person_id::text;
  end if;
  return new;
end
$$;
create trigger guard before insert or update on core.person_team_assist
  for each row execute function core.person_assist_guard();

-- ================================================================ the doors (V124)
revoke all on function core.open_work(uuid), core.open_work_count(jsonb), core.hand_over(uuid, uuid),
  core.person_keep_work(), core.person_assist_guard(), core.person_switch(uuid, boolean, text, uuid),
  core.person_leave(uuid, date, uuid, text), core.person_open_work(uuid) from public;
grant execute on function core.person_switch(uuid, boolean, text, uuid), core.person_leave(uuid, date, uuid, text),
  core.person_open_work(uuid) to authenticated;

create function api.person_switch(p_id uuid, p_on boolean, p_reason text, p_reassign_to uuid default null)
returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select core.person_switch(p_id, p_on, p_reason, p_reassign_to) $$;
create function api.person_leave(p_id uuid, p_reason text, p_left_on date default null,
                                 p_reassign_to uuid default null) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select core.person_leave(p_id, p_left_on, p_reassign_to, p_reason) $$;
create function api.person_open_work(p_id uuid) returns jsonb
language sql stable security invoker set search_path = ''
as $$ select core.person_open_work(p_id) $$;
grant execute on function api.person_switch(uuid, boolean, text, uuid), api.person_leave(uuid, text, date, uuid),
  api.person_open_work(uuid) to authenticated;
