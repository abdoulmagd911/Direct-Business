-- Phase 5 — Need help (Escalate renamed in place): a task carries its flag, the owner's direct manager is told,
-- and the manager acknowledges it. Forward-only (V103): nothing already on v2/main is edited here.

-- ================================================================ the flag on the task
alter table work.task add column escalated boolean not null default false;
alter table work.task add column escalated_at timestamptz;
alter table work.task add column escalated_by uuid references core.person (id);
alter table work.task add column escalated_to uuid references core.person (id);
comment on column work.task.escalated is
  'Phase 5: the task needs help — flagged until its manager acknowledges it; ownership, status and priority do not change.';
create index task_escalated_to on work.task (escalated, escalated_to);

-- ================================================================ Escalate, re-issued (internal name kept)
-- On a task the recipient is the owner's direct manager by default: no picker in the dialog, which shows who will be
-- told; an explicit person still works (partner escalations and the old callers keep it). Flagging sets the flag with
-- its time, flagger and manager, writes the escalation timeline note, adds the follow row, and tells the manager at
-- once. Re-flagging after acknowledgement is allowed: the flag is simply set again.
create or replace function core.escalate(p_entity text, p_id uuid, p_to uuid, p_note text) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  e core.entity := core.can_see_record(p_entity, p_id);
  nid uuid;
  req uuid;
  me uuid := authz.me();
  -- the person told: the one named, else the task owner's direct manager
  told uuid := p_to;
begin
  if e.table_name not in ('work.task', 'partner.partner') then
    raise exception using errcode = 'P0001', message = 'escalation.not_here', detail = p_entity;
  end if;
  if not core.may_write(e.table_name, p_id) then
    raise exception using errcode = '42501', message = 'access.needs_level',
      detail = pg_catalog.jsonb_build_object('page', e.page_key, 'level', 'own')::text;
  end if;
  if nullif(pg_catalog.btrim(p_note), '') is null then
    raise exception using errcode = 'P0001', message = 'escalation.note_required';
  end if;
  if told is null and e.table_name = 'work.task' then
    select p.manager_id into told
    from work.task t join core.person p on p.id = t.owner_id
    where t.id = p_id;
  end if;
  if told is null or not work.person_ok(told) then
    raise exception using errcode = 'P0001', message = 'person.unavailable', detail = told::text;
  end if;
  if told = me then
    raise exception using errcode = 'P0001', message = 'escalation.to_yourself';
  end if;
  if not authz.can_see_as(told, e.table_name, p_id) then
    raise exception using errcode = 'P0001', message = 'escalation.cannot_see', detail = told::text;
  end if;
  req := audit.begin('ui', 'escalation.raised', pg_catalog.jsonb_build_object('entity', e.key));
  insert into core.note (entity_table, entity_id, kind, body) values (e.table_name, p_id, 'escalation', pg_catalog.btrim(p_note))
  returning id into nid;
  insert into notify.follow (person_id, entity_table, entity_id) values (told, e.table_name, p_id) on conflict do nothing;
  perform notify.push_assigned(told, 'escalated', e.table_name, p_id, pg_catalog.jsonb_build_object('note_id', nid));
  if e.table_name = 'work.task' then
    update work.task set escalated = true, escalated_at = pg_catalog.now(), escalated_by = me, escalated_to = told
    where id = p_id;
  end if;
  perform audit.end();
  return pg_catalog.jsonb_build_object('note_id', nid, 'request_id', req);
end
$$;
comment on function core.escalate(text, uuid, uuid, text) is
  'Phase 5: tell someone about a record, with a note — on a task the owner''s direct manager by default — and flag the task until they acknowledge it.';

-- ================================================================ Acknowledge
-- The manager the task was flagged to taps Acknowledge, on the task or in their "Waiting on me" section: the flag
-- clears, the acknowledgement is the task's timeline note, and the person who flagged it is told (kind
-- escalation_acknowledged). Only the manager it was flagged to acknowledges it; a task that does not need help raises
-- escalation.not_escalated. Re-flagging after acknowledgement is allowed (core.escalate sets the flag again).
create function work.escalation_acknowledge(p_id uuid) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  t work.task;
  nid uuid;
  req uuid;
begin
  select * into t from work.task where id = p_id and deleted_at is null;
  if me is null or t.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  if not t.escalated then
    raise exception using errcode = 'P0001', message = 'escalation.not_escalated';
  end if;
  if t.escalated_to is distinct from me then
    raise exception using errcode = '42501', message = 'access.needs_level',
      detail = pg_catalog.jsonb_build_object('page', 'tasks', 'level', 'own')::text;
  end if;
  req := audit.begin('ui', 'escalation.acknowledged', pg_catalog.jsonb_build_object('number', t.number));
  insert into core.note (entity_table, entity_id, kind, body)
  values ('work.task', p_id, 'escalation', 'Acknowledged the need for help')
  returning id into nid;
  update work.task set escalated = false, escalated_at = null, escalated_by = null, escalated_to = null
  where id = p_id;
  if t.escalated_by is not null and t.escalated_by <> me then
    perform notify.push_assigned(t.escalated_by, 'escalation_acknowledged', 'work.task', p_id,
      pg_catalog.jsonb_build_object('record', work.comment_record_label('work.task', p_id)));
  end if;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', p_id, 'request_id', req, 'note_id', nid);
end
$$;
comment on function work.escalation_acknowledge(uuid) is
  'Phase 5: the manager a task was flagged to acknowledges it — the flag clears and the flagger is told.';

create function api.escalate_acknowledge(p_id uuid) returns jsonb
language sql volatile security invoker set search_path = '' as $$ select work.escalation_acknowledge(p_id) $$;
comment on function api.escalate_acknowledge(uuid) is
  'Phase 5: acknowledge a task flagged as needing help.';

-- ================================================================ the manager's list
-- The tasks flagged as needing help and addressed to me, newest flag first — the Need-help part of "Waiting on me".
-- Only where I can still see the task.
create function work.escalated_tasks() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  return coalesce((
    select pg_catalog.jsonb_agg(work.task_row(t, me) order by t.escalated_at desc nulls last, t.number)
    from work.task t
    where t.escalated and t.escalated_to = me and t.deleted_at is null
      and work.row_level('work.task', t.id, me) >= 'view'), '[]'::jsonb);
end
$$;
comment on function work.escalated_tasks() is
  'Phase 5: the tasks flagged as needing help and addressed to me, newest flag first.';

create function api.escalated_tasks() returns jsonb
language sql stable security invoker set search_path = '' as $$ select work.escalated_tasks() $$;
comment on function api.escalated_tasks() is
  'Phase 5: the tasks flagged as needing help and addressed to me.';

-- ================================================================ the row, re-issued with the flag
-- work.task_row, re-issued with four fields added to the Phase 1 body (20261107120000, copied exactly otherwise):
-- 'escalated', 'escalated_at', 'escalated_by' and 'escalated_to', so the record and the manager's list read the flag.
create or replace function work.task_row(t work.task, p_reader uuid) returns jsonb
language sql stable security definer set search_path = ''
as $$
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
    'escalated', t.escalated, 'escalated_at', t.escalated_at, 'escalated_by', t.escalated_by,
    'escalated_to', t.escalated_to,
    'can_edit', work.can_edit_task(p_reader, t),
    'open_action_items', (select pg_catalog.count(*)::int from work.action_item a
                          where a.task_id = t.id and a.deleted_at is null and a.done_on is null),
    'helpers', coalesce((select pg_catalog.jsonb_agg(h.person_id order by h.created_at, h.person_id)
                         from work.task_helper h where h.task_id = t.id and h.deleted_at is null), '[]'::jsonb)
  ) || work.task_flags(t)
  from work.task_status s
  left join work.priority pr on pr.id = t.priority_id
  left join work.task_type ty on ty.id = t.type_id
  where s.id = t.status_id
$$;

-- ================================================================ the list, re-issued with the two flag filters
-- work.task_list, re-issued with two filter keys added to the 20261002010000 body (copied exactly otherwise):
-- 'escalated' and 'starred'. A flagged list orders by the flag's time, newest first — the escalated saved view.
create or replace function work.task_list(p_filter jsonb default null, p_limit int default 50, p_offset int default 0) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.require('tasks', 'view');
  f jsonb := coalesce(p_filter, '{}'::jsonb);
  lim int := greatest(1, least(coalesce(p_limit, 50), 200));
  off int := greatest(coalesce(p_offset, 0), 0);
  q text := norm.fold(f ->> 'q');
  past boolean := coalesce((f ->> 'past_work')::boolean, false) or coalesce((f ->> 'needs_owner')::boolean, false);
  rows jsonb;
  total int;
begin
  with hits as (
    select t, work.task_flags(t) as fl, pr.meaning as directive, s.meaning
    from work.task t
    join work.task_status s on s.id = t.status_id
    left join work.priority pr on pr.id = t.priority_id
    where t.deleted_at is null and work.row_level('work.task', t.id, me) >= 'view'
      and work.task_is_past(t) = past
      and (not coalesce((f ->> 'needs_owner')::boolean, false) or t.owner_id is null)
      and (not coalesce((f ->> 'escalated')::boolean, false) or t.escalated)
      and (not coalesce((f ->> 'starred')::boolean, false) or t.starred)
      and case coalesce(f ->> 'scope', 'all')
            when 'mine' then t.owner_id = me
            when 'my_work' then work.in_my_work(t, me)
            else true end
      and (f -> 'meanings' is null or s.meaning in (select pg_catalog.jsonb_array_elements_text(f -> 'meanings')))
      and (nullif(f ->> 'owner_id', '') is null or t.owner_id = (f ->> 'owner_id')::uuid)
      and (nullif(f ->> 'partner_id', '') is null or t.partner_id = (f ->> 'partner_id')::uuid)
      and (nullif(f ->> 'project_id', '') is null or t.project_id = (f ->> 'project_id')::uuid)
      and (nullif(f ->> 'type', '') is null or t.type_id = work.list_id('work.task_type', f ->> 'type'))
      and (q is null or norm.fold(t.title) like '%' || q || '%' or norm.fold(t.number) like '%' || q || '%')
  ), flagged as (
    select * from hits
    where (not coalesce((f ->> 'overdue')::boolean, false) or (fl ->> 'overdue')::boolean)
      and (not coalesce((f ->> 'stale')::boolean, false) or (fl ->> 'stale')::boolean)
      and (not coalesce((f ->> 'blocked')::boolean, false) or (fl ->> 'blocked')::boolean)
  )
  select (select pg_catalog.count(*)::int from flagged),
         coalesce((select pg_catalog.jsonb_agg(work.task_row(x.t, me) order by x.o)
                   from (select y.t, pg_catalog.row_number() over (
                                  order by (case when coalesce((f ->> 'escalated')::boolean, false)
                                                then (y.t).escalated_at end) desc nulls last,
                                           (y.directive is not null) desc, (y.meaning in ('done', 'cancelled')),
                                           (y.t).due_on nulls last, (y.t).number) o
                         from flagged y) x
                   where x.o > off and x.o <= off + lim), '[]'::jsonb)
    into total, rows;
  return pg_catalog.jsonb_build_object('rows', rows, 'total', total, 'more', total > off + lim);
end
$$;

-- ================================================================ the notification kinds, re-issued with the new kind
alter table notify.notification drop constraint notification_kind_check;
alter table notify.notification add constraint notification_kind_check check (kind in (
  'assigned', 'helper_added', 'mentioned', 'changed_by_other', 'followed_change', 'decision_needed', 'report_issued',
  'report_for_review', 'appraisal_step', 'import_done', 'alert_contract_expiring', 'alert_kpi_behind',
  'alert_invoice_unpaid', 'alert_kpi_checkin', 'escalated', 'alert_quiet_client', 'alert_project_no_update',
  'alert_activity_stale', 'alert_file_review', 'reminder', 'note_mention', 'alert_contact_reconfirm',
  'alert_due_tomorrow', 'task_commented', 'commented', 'asked', 'escalation_acknowledged'));

-- ================================================================ the doors (V124)
revoke all on function work.escalation_acknowledge(uuid), api.escalate_acknowledge(uuid),
  work.escalated_tasks(), api.escalated_tasks() from public;
grant execute on function work.escalation_acknowledge(uuid), api.escalate_acknowledge(uuid),
  work.escalated_tasks(), api.escalated_tasks() to authenticated;
