-- Landing 33 (B3) — hand-over: one Responsible, an optional deputy, a reason every time, and only your own jobs.
--
--   * O-3: a task is handed over by its Responsible only. A manager, a head or an admin may not hand over a team
--     member's task, and nobody takes a task from its Responsible. A task with no Responsible yet is still placed by
--     whoever may give work out (tasks.assign); a leaver's work is moved by an admin through core.hand_over, as before.
--   * Every hand-over carries a reason of at most 120 characters. No reason, nothing moves.
--   * The new Responsible must be able to see the task AND the partner it belongs to.
--   * A task may have one deputy: a helper (so the task is under their Helping) who may also act — move its status,
--     mark it done, tick its steps — but never hand it over or edit it. The Responsible still owns the outcome.
--   * The task keeps who had it, when it moved, and why: read back from the audit trail that already records it.
--
-- Forward-only; the functions below are the newest definitions made again with these rules.

alter table work.task_helper add column is_deputy boolean not null default false;
create unique index task_helper_one_deputy on work.task_helper (task_id) where is_deputy and deleted_at is null;

create function work.is_deputy(p_person uuid, p_task uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from work.task_helper h
                 where h.task_id = p_task and h.person_id = p_person and h.is_deputy and h.deleted_at is null)
$$;

-- Whoever may ACT on a task (move its status): whoever may edit it, or its deputy.
create function work.task_actable(p_id uuid) returns work.task
language plpgsql stable security definer set search_path = '' as $$
declare
  me uuid := authz.me();
  t work.task;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  select * into t from work.task where id = p_id and deleted_at is null;
  if t.id is null or work.row_level('work.task', p_id, me) < 'view' then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  if not (work.can_edit_task(me, t)
          or (work.is_deputy(me, p_id) and authz.level_of(me, 'tasks') >= 'own')) then
    raise exception using errcode = '42501', message = 'access.needs_level',
      detail = pg_catalog.jsonb_build_object('page', 'tasks', 'level', 'own')::text;
  end if;
  return t;
end
$$;

create or replace function work.task_status_set(p_id uuid, p_status text, p_happened_on date default null,
  p_reason text default null, p_close_items boolean default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := authz.me();
  t work.task := work.task_actable(p_id);
  s work.task_status := work.status_of(p_status);
  cur work.task_status;
  day date := coalesce(p_happened_on, core.riyadh_today());
  blocked boolean := nullif(pg_catalog.btrim(p_reason), '') is not null;
  is_block boolean := blocked and s.meaning = 'in_progress';
  is_cancel boolean := blocked and s.meaning = 'cancelled';
  open_items int;
  req uuid;
  what text;
begin
  if s.id is null then
    raise exception using errcode = 'P0002', message = 'list.unknown_value', detail = p_status;
  end if;
  select * into cur from work.task_status where id = t.status_id;
  if blocked and not (is_block or is_cancel) then
    raise exception using errcode = 'P0001', message = 'task.only_in_progress_blocks';
  end if;
  if day < t.happened_on then
    raise exception using errcode = 'P0001', message = 'task.status_before_raised';
  end if;
  select pg_catalog.count(*)::int into open_items from work.action_item a
  where a.task_id = p_id and a.deleted_at is null and a.done_on is null;
  if s.meaning = 'done' and open_items > 0 and not coalesce(p_close_items, false) then
    raise exception using errcode = 'P0001', message = 'task.open_action_items', detail = open_items::text;
  end if;
  if s.id = cur.id and blocked = (t.blocked_reason is not null) and not blocked then
    raise exception using errcode = 'P0001', message = 'task.status_unchanged';
  end if;
  req := audit.begin('ui', 'task.status_set', pg_catalog.jsonb_build_object('number', t.number, 'status', s.key,
                                                                             'blocked', is_block));
  perform audit.happened(p_happened_on);
  perform work.quiet_if_past(array[p_id]);
  begin
    insert into work.task_status_change (task_id, from_status_id, to_status_id, blocked, reason, happened_on)
    values (p_id, t.status_id, s.id, is_block, nullif(pg_catalog.btrim(p_reason), ''), day);
    if s.meaning = 'done' and open_items > 0 then
      update work.action_item set done_on = greatest(day, happened_on), done_by = me
      where task_id = p_id and deleted_at is null and done_on is null;
    end if;
    update work.task set
      status_id = s.id,
      blocked_reason = case when is_block then pg_catalog.btrim(p_reason) end,
      blocked_on = case when is_block then day end,
      cancelled_reason = case when is_cancel then pg_catalog.btrim(p_reason) end,
      closed_at = case when s.meaning in ('done', 'cancelled') then core.clock() end,
      closed_by = case when s.meaning in ('done', 'cancelled') then me end
    where id = p_id;
  exception when check_violation then
    get stacked diagnostics what = constraint_name;
    raise exception using errcode = 'P0001', message = work.task_refused(what);
  end;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', p_id, 'request_id', req, 'status', s.key, 'meaning', s.meaning,
                                       'blocked', is_block, 'items_closed', case when s.meaning = 'done' then open_items else 0 end);
end
$$;

create or replace function work.action_item_done(p_id uuid, p_done boolean, p_on date default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := authz.me();
  a work.action_item;
  t work.task;
  req uuid;
  what text;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  select * into a from work.action_item where id = p_id and deleted_at is null;
  if a.id is null or work.row_level('work.action_item', p_id, me) < 'view' then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  select * into t from work.task where id = a.task_id;
  if not (me = a.owner_id
          or exists (select 1 from work.action_item_helper h where h.action_item_id = p_id and h.person_id = me
                       and h.deleted_at is null)
          or work.can_edit_task(me, t)
          or work.is_deputy(me, t.id))
     or work.row_level('work.action_item', p_id, me) < 'own' then
    raise exception using errcode = '42501', message = 'action_item.not_yours';
  end if;
  if p_done is null then
    raise exception using errcode = 'P0001', message = 'common.invalid';
  end if;
  req := audit.begin('ui', case when p_done then 'action_item.done' else 'action_item.reopened' end,
                     pg_catalog.jsonb_build_object('number', t.number));
  perform audit.happened(p_on);
  perform work.quiet_if_past(array[t.id]);
  begin
    update work.action_item set done_on = case when p_done then coalesce(p_on, core.riyadh_today()) end,
                                done_by = case when p_done then me end
    where id = p_id;
  exception when check_violation then
    get stacked diagnostics what = constraint_name;
    raise exception using errcode = 'P0001', message = work.task_refused(what);
  end;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', p_id, 'request_id', req);
end
$$;

-- The helpers list never drops the deputy: the deputy is changed by task_deputy_set alone.
create or replace function work.task_helpers_set(p_id uuid, p_people uuid[]) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  t work.task := work.task_editable(p_id);
  who uuid;
  req uuid;
  k int := 0;
begin
  req := audit.begin('ui', 'task.helpers_set', pg_catalog.jsonb_build_object('number', t.number));
  perform work.quiet_if_past(array[p_id]);
  update work.task_helper set deleted_at = core.clock(), deleted_by = authz.me()
  where task_id = p_id and deleted_at is null and not is_deputy
    and not (person_id = any (coalesce(p_people, '{}')));
  foreach who in array coalesce(p_people, '{}') loop
    continue when who is null or exists (select 1 from work.task_helper h
                                         where h.task_id = p_id and h.person_id = who and h.deleted_at is null);
    insert into work.task_helper (task_id, person_id) values (p_id, who);
    if not work.task_is_past(t) then
      perform notify.push_assigned(who, 'helper_added', 'work.task', p_id);
    end if;
    k := k + 1;
  end loop;
  perform audit.end();
  return pg_catalog.jsonb_build_object('added', k, 'request_id', req);
end
$$;

create or replace function work.tasks_assign(p_ids uuid[], p_owner uuid, p_reason text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := authz.me();
  i uuid;
  t work.task;
  req uuid;
  k int := 0;
  why text := nullif(pg_catalog.btrim(p_reason), '');
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  if p_ids is null or pg_catalog.cardinality(p_ids) = 0 then
    raise exception using errcode = 'P0001', message = 'common.nothing_selected';
  end if;
  if p_owner is null then
    raise exception using errcode = 'P0001', message = 'task.owner_required';
  end if;
  foreach i in array p_ids loop
    select * into t from work.task where id = i and deleted_at is null;
    if t.id is null or work.row_level('work.task', i, me) < 'view' then
      raise exception using errcode = 'P0002', message = 'common.not_found';
    end if;
    if t.owner_id is null then
      -- nobody's yet: whoever may give work out places it
      if not authz.can('tasks.assign') then
        raise exception using errcode = '42501', message = 'access.needs_capability', detail = 'tasks.assign';
      end if;
    elsif t.owner_id is distinct from p_owner then
      -- O-3: a hand-over is the Responsible's own act
      if t.owner_id <> me or not work.can_edit_task(me, t)
         or not (authz.can('tasks.assign') or authz.can('tasks.assign_own')) then
        raise exception using errcode = '42501', message = 'task.hand_over_not_yours';
      end if;
      if why is null then
        raise exception using errcode = 'P0001', message = 'task.hand_over_reason_required';
      end if;
      if pg_catalog.length(why) > 120 then
        raise exception using errcode = 'P0001', message = 'task.hand_over_reason_too_long';
      end if;
    end if;
    -- the new owner must be able to see the task (its department, and a level on Tasks)
    if work.person_ok(p_owner) and not authz.can_see_as(p_owner, 'work.task', i) then
      raise exception using errcode = 'P0001', message = 'task.owner_cannot_see', detail = p_owner::text;
    end if;
    -- and the partner the task belongs to
    if t.partner_id is not null and t.owner_id is distinct from p_owner
       and partner.level_of(p_owner, t.partner_id) < 'view' then
      raise exception using errcode = 'P0001', message = 'task.owner_cannot_see_partner', detail = p_owner::text;
    end if;
  end loop;
  req := audit.begin('ui', 'task.assigned', pg_catalog.jsonb_build_object('count', pg_catalog.cardinality(p_ids)), why);
  perform work.quiet_if_past(p_ids);
  for t in select * from work.task x where x.id = any (p_ids) and x.owner_id is distinct from p_owner loop
    update work.task set owner_id = p_owner, assigned_by = case when p_owner <> me then me end where id = t.id;
    -- the new Responsible is no longer the task's deputy
    update work.task_helper set is_deputy = false
    where task_id = t.id and person_id = p_owner and is_deputy and deleted_at is null;
    if not work.task_is_past(t) then
      perform notify.push_assigned(p_owner, 'assigned', 'work.task', t.id);
    end if;
    k := k + 1;
  end loop;
  perform audit.end();
  return pg_catalog.jsonb_build_object('count', k, 'request_id', req);
end
$$;

create or replace function work.task_delegate(p_id uuid, p_to uuid, p_note text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := authz.me();
  t work.task := work.task_editable(p_id);
  note jsonb;
  req uuid;
  why text := nullif(pg_catalog.btrim(p_note), '');
begin
  if why is null then
    raise exception using errcode = 'P0001', message = 'task.hand_over_reason_required';
  end if;
  if pg_catalog.length(why) > 120 then
    raise exception using errcode = 'P0001', message = 'task.hand_over_reason_too_long';
  end if;
  if t.owner_id is not null and t.owner_id <> me then
    raise exception using errcode = '42501', message = 'task.hand_over_not_yours';
  end if;
  if p_to is null or not work.person_ok(p_to) then
    raise exception using errcode = 'P0001', message = 'person.unavailable', detail = p_to::text;
  end if;
  if p_to = me then
    raise exception using errcode = 'P0001', message = 'task.delegate_to_yourself';
  end if;
  if not authz.can_see_as(p_to, 'work.task', p_id) then
    raise exception using errcode = 'P0001', message = 'task.delegate_cannot_see', detail = p_to::text;
  end if;
  req := audit.begin('ui', 'task.delegated', pg_catalog.jsonb_build_object('number', t.number), why);
  -- the reason is written while the task is still theirs to write on (a member who did not create the task may
  -- not add to it once it has moved)
  note := core.note_add('task', p_id, 'update', why);
  perform work.tasks_assign(array[p_id], p_to, why);
  insert into notify.follow (person_id, entity_table, entity_id) values (me, 'work.task', p_id)
    on conflict do nothing;
  if not exists (select 1 from work.task_helper h
                 where h.task_id = p_id and h.person_id = me and h.deleted_at is null) then
    insert into work.task_helper (task_id, person_id) values (p_id, me);
  end if;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', p_id, 'request_id', req, 'note_id', note ->> 'id', 'owner_id', p_to);
end
$$;

-- Name the deputy, or clear it (p_person null). Whoever may edit the task does this.
create function work.task_deputy_set(p_id uuid, p_person uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := authz.me();
  t work.task := work.task_editable(p_id);
  req uuid;
  had uuid;
begin
  select h.person_id into had from work.task_helper h
  where h.task_id = p_id and h.is_deputy and h.deleted_at is null;
  if had is not distinct from p_person then
    raise exception using errcode = 'P0001', message = 'task.deputy_unchanged';
  end if;
  if p_person is not null then
    if not work.person_ok(p_person) then
      raise exception using errcode = 'P0001', message = 'person.unavailable', detail = p_person::text;
    end if;
    if p_person = t.owner_id then
      raise exception using errcode = 'P0001', message = 'task.deputy_is_responsible';
    end if;
    if not authz.can_see_as(p_person, 'work.task', p_id) then
      raise exception using errcode = 'P0001', message = 'task.deputy_cannot_see', detail = p_person::text;
    end if;
  end if;
  req := audit.begin('ui', case when p_person is null then 'task.deputy_cleared' else 'task.deputy_set' end,
                     pg_catalog.jsonb_build_object('number', t.number));
  perform work.quiet_if_past(array[p_id]);
  update work.task_helper set is_deputy = false where task_id = p_id and is_deputy and deleted_at is null;
  if p_person is not null then
    if exists (select 1 from work.task_helper h
               where h.task_id = p_id and h.person_id = p_person and h.deleted_at is null) then
      update work.task_helper set is_deputy = true
      where task_id = p_id and person_id = p_person and deleted_at is null;
    else
      insert into work.task_helper (task_id, person_id, is_deputy) values (p_id, p_person, true);
    end if;
    if not work.task_is_past(t) then
      perform notify.push_assigned(p_person, 'helper_added', 'work.task', p_id);
    end if;
  end if;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', p_id, 'deputy_id', p_person, 'request_id', req);
end
$$;

create function api.task_deputy_set(p_id uuid, p_person uuid) returns jsonb
language sql security invoker set search_path = '' as $$ select work.task_deputy_set(p_id, p_person) $$;

-- Who had the task, when it moved and why: every change of the Responsible, newest first, from the audit trail.
create function work.task_handovers(p_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'at', r.at, 'happened_on', r.happened_on, 'by', r.actor_id,
           'from', c.before ->> 'owner_id', 'to', c.after ->> 'owner_id', 'reason', r.reason)
           order by c.id desc), '[]'::jsonb)
  from audit.change c join audit.request r on r.id = c.request_id
  where c.table_name = 'work.task' and c.row_id = p_id and c.action = 'update'
    and 'owner_id' = any (c.fields) and r.undone_at is null and r.kind <> 'undo'
$$;

-- The row says who the deputy is, whether the reader may act or hand over, and how many steps the task has
-- (with open_action_items that is its progress).
create or replace function work.task_row(t work.task, p_reader uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $fn$
#variable_conflict use_column
begin
  return (
      select pg_catalog.jsonb_build_object(
        'id', t.id, 'number', t.number, 'title', t.title, 'owner_id', t.owner_id, 'team_id', t.team_id,
        'priority', pr.key, 'priority_en', pr.name_en, 'priority_ar', pr.name_ar, 'executive_directive', pr.meaning is not null,
        'status', s.key, 'status_en', s.name_en, 'status_ar', s.name_ar, 'meaning', s.meaning,
        'type', ty.key, 'type_en', ty.name_en, 'type_ar', ty.name_ar, 'work_type', t.work_type,
        'start_on', t.start_on, 'due_on', t.due_on, 'partner_id', t.partner_id, 'project_id', t.project_id,
        'origin', t.origin, 'happened_on', t.happened_on, 'logged_at', t.logged_at, 'closed_at', t.closed_at,
        'blocked_reason', t.blocked_reason, 'blocked_on', t.blocked_on, 'cancelled_reason', t.cancelled_reason, 'version', t.version,
        'starred', t.starred, 'dismissed_from_nudge', t.dismissed_from_nudge,
        'has_achievement', exists (select 1 from perf.achievement a
                                   where a.source_task_id = t.id and a.deleted_at is null),
        'achievement_id', ach.id, 'achievement_number', ach.number, 'achievement_title', ach.title,
        'escalated', t.escalated, 'escalated_at', t.escalated_at, 'escalated_by', t.escalated_by,
        'escalated_to', t.escalated_to,
        'escalated_note', esc.body,
        'can_edit', work.can_edit_task(p_reader, t),
        'deputy_id', (select h.person_id from work.task_helper h
                      where h.task_id = t.id and h.is_deputy and h.deleted_at is null),
        'can_act', work.can_edit_task(p_reader, t)
                   or (work.is_deputy(p_reader, t.id) and authz.level_of(p_reader, 'tasks') >= 'own'),
        'can_hand_over', t.owner_id = p_reader and work.can_edit_task(p_reader, t),
        'action_items_total', (select pg_catalog.count(*)::int from work.action_item a
                               where a.task_id = t.id and a.deleted_at is null),
        'open_action_items', (select pg_catalog.count(*)::int from work.action_item a
                              where a.task_id = t.id and a.deleted_at is null and a.done_on is null),
        'helpers', coalesce((select pg_catalog.jsonb_agg(h.person_id order by h.created_at, h.person_id)
                             from work.task_helper h where h.task_id = t.id and h.deleted_at is null), '[]'::jsonb)
      ) || work.task_flags(t)
      from work.task_status s
      left join work.priority pr on pr.id = t.priority_id
      left join work.task_type ty on ty.id = t.type_id
      left join lateral (select a.id, a.number, a.title
                         from perf.achievement a
                         where a.source_task_id = t.id and a.deleted_at is null
                           and perf.sees_achievement(p_reader, a)
                         order by a.logged_at, a.id limit 1) ach on true
      left join lateral (select n.body
                         from core.note n
                         where n.entity_table = 'work.task' and n.entity_id = t.id
                           and n.kind = 'escalation' and n.deleted_at is null
                         order by n.created_at desc, n.id desc limit 1) esc on true
      where s.id = t.status_id
  );
end
$fn$;

create or replace function work.task_get(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  me uuid := authz.me();
  t work.task;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  select * into t from work.task where id = p_id and deleted_at is null;
  if t.id is null or work.row_level('work.task', p_id, me) < 'view' then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  return work.task_row(t, me) || pg_catalog.jsonb_build_object(
    'notes', t.notes, 'assigned_by', t.assigned_by, 'closed_by', t.closed_by, 'created_by', t.created_by,
    'action_items', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', a.id, 'text', a.text, 'owner_id', a.owner_id, 'due_on', a.due_on, 'done_on', a.done_on, 'done_by', a.done_by,
        'sort', a.sort, 'source_note_id', a.source_note_id, 'happened_on', a.happened_on, 'version', a.version,
        'starred', a.starred,
        'overdue', not work.task_is_past(t) and a.done_on is null and a.due_on < core.riyadh_today(),
        'helpers', coalesce((select pg_catalog.jsonb_agg(h.person_id order by h.created_at)
                             from work.action_item_helper h where h.action_item_id = a.id and h.deleted_at is null),
                            '[]'::jsonb)) order by a.sort, a.created_at)
      from work.action_item a where a.task_id = p_id and a.deleted_at is null), '[]'::jsonb),
    'refs', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', r.id, 'system', s.key, 'system_en', s.name_en, 'system_ar', s.name_ar, 'value', r.value) order by r.created_at)
      from work.task_ref r join work.ref_system s on s.id = r.system_id
      where r.task_id = p_id and r.deleted_at is null), '[]'::jsonb),
    'contacts', coalesce((select pg_catalog.jsonb_agg(c.contact_id order by c.created_at)
      from work.task_contact c where c.task_id = p_id and c.deleted_at is null), '[]'::jsonb),
    'handovers', work.task_handovers(p_id),
    'status_history', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'from', f.key, 'to', s.key, 'meaning', s.meaning, 'blocked', c.blocked, 'reason', c.reason,
        'happened_on', c.happened_on, 'logged_at', c.logged_at, 'by', c.created_by)
        order by c.happened_on desc, c.logged_at desc)
      from work.task_status_change c join work.task_status s on s.id = c.to_status_id
      left join work.task_status f on f.id = c.from_status_id
      where c.task_id = p_id and c.deleted_at is null), '[]'::jsonb));
end
$$;

revoke all on function work.is_deputy(uuid, uuid), work.task_actable(uuid), work.task_handovers(uuid),
  work.task_deputy_set(uuid, uuid), api.task_deputy_set(uuid, uuid) from public;
grant execute on function work.task_deputy_set(uuid, uuid) to authenticated;
grant execute on function api.task_deputy_set(uuid, uuid) to authenticated;
