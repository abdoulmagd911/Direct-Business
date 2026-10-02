-- P5-1 · what follows from work (TECH-SPEC §3.3, §3.4, §3.7; V91, V401, V406; OLD-WRK-044): an activity's next step
-- becomes one task, "demo set" the demo task; Escalate tells a person, makes them a follower and writes it on the
-- timeline; the team load beside every person picker; the daily reminders for a project with no health update and a
-- task coming due. V197–V199. Every function the Data API reaches is a security-invoker wrapper (V124). Forward-only.

-- ================================================================ an activity's next step becomes one task (V401, V406)
-- An activity on an organisation logged with a next step makes one task for its author, due on the next step's day,
-- dated the day the activity happened, linked to the organisation and the activity — in the activity's own request, so
-- one Undo takes back both. "Demo set" makes the demo task the same way (titled from the next step, else "Demo"), with
-- the author's manager as helper. Editing the next step changes that task while it is open, never makes another; a
-- next step taken off leaves its task to its owner. Nobody available (an import, a person with no team, or one below Own
-- on Tasks — QA-241) → no task; the next step stays on the activity. Undo restores rows itself: the trigger stands
-- aside inside an undo request.
alter table core.note add constraint note_next_step_task_fk foreign key (next_step_task_id) references work.task (id);
create index note_next_step_task on core.note (next_step_task_id);

create function work.next_step_task() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  demo boolean := exists (select 1 from partner.activity_outcome o where o.id = new.outcome_id and o.meaning = 'demo_set');
  heading text;
  team uuid;
  mgr uuid;
begin
  if new.kind <> 'activity' or new.entity_table <> 'partner.partner' or new.deleted_at is not null
     or new.next_step_on is null or (new.next_step is null and not demo)
     or (select r.kind from audit.request r
         where r.id = nullif(pg_catalog.current_setting('app.request_id', true), '')::uuid) is distinct from 'ui' then
    return new;
  end if;
  heading := pg_catalog.left(coalesce(new.next_step, 'Demo'), 300);
  if new.next_step_task_id is not null then
    update work.task t set title = heading, due_on = new.next_step_on
    where t.id = new.next_step_task_id and t.closed_at is null and t.deleted_at is null
      and (t.title is distinct from heading or t.due_on is distinct from new.next_step_on);
    return new;
  end if;
  select p.team_id, p.manager_id into team, mgr from core.person p where p.id = new.created_by;
  -- QA-241: an author below Own on Tasks (the pilot's stage 0) could neither open nor close it — no task for them
  if team is null or not work.person_ok(new.created_by) or authz.level_of(new.created_by, 'tasks') < 'own' then
    return new;
  end if;
  insert into work.task (number, title, owner_id, team_id, department_id, status_id, work_type, partner_id, due_on,
                         origin, happened_on)
  values (core.format_number('TSK', pg_catalog.date_part('year', new.happened_on)::int,                   -- V531
                             core.next_number('task', pg_catalog.date_part('year', new.happened_on)::int)),
          heading, new.created_by, team, (select t.department_id from core.team t where t.id = team),
          (select s.id from work.task_status s where s.is_default and s.deleted_at is null),
          'client', new.entity_id, new.next_step_on, 'next_step', new.happened_on)
  returning id into new.next_step_task_id;
  if demo and mgr is not null and work.person_ok(mgr) then
    insert into work.task_helper (task_id, person_id) values (new.next_step_task_id, mgr);
    if not work.is_past(new.happened_on) then
      perform notify.push_assigned(mgr, 'helper_added', 'work.task', new.next_step_task_id);
    end if;
  end if;
  return new;
end
$$;
-- After `stamp` (triggers run by name), so the author is already set.
create trigger stamp_next_step_task before insert or update of next_step, next_step_on, outcome_id on core.note
  for each row execute function work.next_step_task();

-- An organisation's next step is open while its task is (V151 after P5-1); one without a task, until its day passes.
create or replace function partner.stale_on(p_partner uuid) returns date
language sql stable security definer set search_path = ''
as $$
  select case when p.archived_at is null and p.deleted_at is null
                   and exists (select 1 from partner.partner_side s where s.partner_id = p.id and s.deleted_at is null
                               and partner.side_on(p.id, s.side)
                               and partner.status_of(p.id, s.side) is distinct from 'lost')
              then greatest(coalesce(a.last_on, sd.since_on)
                              + coalesce((core.setting_at('partner.stale_after_days', null, core.riyadh_today()) #>> '{}')::int, 21),
                            a.next_on + 1) end
  from partner.partner p
  left join lateral (
    select pg_catalog.max(n.happened_on) as last_on,
           pg_catalog.max(case when t.id is null then n.next_step_on
                               when t.closed_at is null and t.deleted_at is null
                                 then greatest(n.next_step_on, core.riyadh_today()) end) as next_on
    from core.note n left join work.task t on t.id = n.next_step_task_id
    where n.entity_table = 'partner.partner' and n.entity_id = p.id and n.kind = 'activity' and n.deleted_at is null) a
    on true
  left join lateral (select pg_catalog.min(s.since) as since_on from partner.partner_side s
                     where s.partner_id = p.id and s.deleted_at is null and partner.side_on(p.id, s.side)) sd on true
  where p.id = p_partner
$$;

-- ================================================================ Escalate (V401)
-- On a task or an organisation (a challenge joins with P5-6): the person escalated to is told ('escalated') — at once,
-- whatever the work's date — follows the record from then on, and the escalation is its timeline's note and its
-- change log's request. Whoever may add a note to the record escalates, to someone else who can work here and see it.
create function core.escalate(p_entity text, p_id uuid, p_to uuid, p_note text) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  e core.entity := core.can_see_record(p_entity, p_id);
  nid uuid;
  req uuid;
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
  if p_to is null or not work.person_ok(p_to) then
    raise exception using errcode = 'P0001', message = 'person.unavailable', detail = p_to::text;
  end if;
  if p_to = authz.me() then
    raise exception using errcode = 'P0001', message = 'escalation.to_yourself';
  end if;
  if not authz.can_see_as(p_to, e.table_name, p_id) then
    raise exception using errcode = 'P0001', message = 'escalation.cannot_see', detail = p_to::text;
  end if;
  req := audit.begin('ui', 'escalation.raised', pg_catalog.jsonb_build_object('entity', e.key));
  insert into core.note (entity_table, entity_id, kind, body) values (e.table_name, p_id, 'escalation', pg_catalog.btrim(p_note))
  returning id into nid;
  insert into notify.follow (person_id, entity_table, entity_id) values (p_to, e.table_name, p_id) on conflict do nothing;
  perform notify.push_assigned(p_to, 'escalated', e.table_name, p_id, pg_catalog.jsonb_build_object('note_id', nid));
  perform audit.end();
  return pg_catalog.jsonb_build_object('note_id', nid, 'request_id', req);
end
$$;

-- ================================================================ team load (V91)
-- Per person, beside every picker and as the managers' Team load view: open tasks, overdue, open action items,
-- organisations owned (the Client side's account manager) and prospects assigned (a side of theirs at Prospect). Live
-- work only — past work is never load (V491). The people who can be named (V465) in the reader's departments.
create function work.team_load(p_people uuid[] default null) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.require('tasks', 'view');
  today date := core.riyadh_today();
begin
  return coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'person_id', p.id, 'full_name_en', p.full_name_en, 'full_name_ar', p.full_name_ar,
      'open_tasks', w.open_tasks, 'overdue', w.overdue,
      'open_action_items', (select pg_catalog.count(*)::int from work.action_item a join work.task t on t.id = a.task_id
                            where a.owner_id = p.id and a.deleted_at is null and a.done_on is null
                              and t.deleted_at is null and t.closed_at is null and not work.task_is_past(t)),
      'partners_owned', (select pg_catalog.count(distinct m.partner_id)::int from partner.side_owner m
                         join partner.partner x on x.id = m.partner_id
                         where m.person_id = p.id and m.side = 'client' and m.deleted_at is null
                           and m.effective_from <= today and (m.effective_to is null or m.effective_to > today)
                           and x.deleted_at is null and x.archived_at is null and partner.side_on(x.id, 'client')),
      'prospects_assigned', (select pg_catalog.count(distinct m.partner_id)::int from partner.side_owner m
                             join partner.partner x on x.id = m.partner_id
                             where m.person_id = p.id and m.deleted_at is null
                               and m.effective_from <= today and (m.effective_to is null or m.effective_to > today)
                               and x.deleted_at is null and x.archived_at is null and partner.side_on(x.id, m.side)
                               and partner.status_of(x.id, m.side, today) = 'prospect'))
      order by pg_catalog.lower(p.full_name_en))
    from core.person p
    cross join lateral (
      select pg_catalog.count(*)::int as open_tasks,
             (pg_catalog.count(*) filter (where t.due_on < today))::int as overdue
      from work.task t join work.task_status s on s.id = t.status_id
      where t.owner_id = p.id and t.deleted_at is null and s.meaning not in ('done', 'cancelled')
        and not work.task_is_past(t)) w
    where work.person_ok(p.id) and work.sees_department(me, p.department_id)
      and (p_people is null or p.id = any (p_people))), '[]'::jsonb);
end
$$;

-- ================================================================ the daily reminders (V401; OLD-WRK-044)
-- A live project (status in the Active category) with no health update for `work.project_update_days` tells its owner
-- once for that silence, on the job's first run on or after the day it falls due; an update starts the count again. A
-- project dated before go-live is past work and tells nobody (V491, QA-240).
create function notify.alert_project_no_update() returns setof notify.alert
language sql stable security definer set search_path = ''
as $$
  select a.person_id, a.alert_key, a.entity_table, a.entity_id, a.label_key, a.label_args
  from (
    select p.owner_id, 'project_no_update:' || p.id || ':' || x.last_on, 'work.project', p.id, 'alert.project_no_update',
           pg_catalog.jsonb_build_object('number', p.number, 'name', p.name, 'last_on', x.last_on)
    from work.project p
    join work.project_status s on s.id = p.status_id
    cross join lateral (select greatest(p.happened_on, (select pg_catalog.max(h.happened_on) from work.project_health h
                                                        where h.project_id = p.id and h.deleted_at is null)) as last_on) x
    where p.deleted_at is null and p.owner_id is not null and s.category = 'active'
      and not work.is_past(p.happened_on)                                  -- QA-240: past work tells nobody (V491)
      and x.last_on + coalesce((core.setting_at('work.project_update_days', p.department_id, core.riyadh_today())
                                #>> '{}')::int, 14) <= core.riyadh_today()
  ) a (person_id, alert_key, entity_table, entity_id, label_key, label_args)
  where not exists (select 1 from notify.notification n where n.person_id = a.person_id and n.alert_key = a.alert_key)
$$;

-- A live task coming due tells its owner once for that due day, `work.reminder_days_before_due` days before it (1: the
-- day before — the spec's "due tomorrow"; 0: the day itself). The daily job names a kind by its function, so the kind is
-- alert_due_tomorrow.
create function notify.alert_due_tomorrow() returns setof notify.alert
language sql stable security definer set search_path = ''
as $$
  select a.person_id, a.alert_key, a.entity_table, a.entity_id, a.label_key, a.label_args
  from (
    select t.owner_id, 'due_tomorrow:' || t.id || ':' || t.due_on, 'work.task', t.id, 'alert.due_tomorrow',
           pg_catalog.jsonb_build_object('number', t.number, 'title', t.title, 'due_on', t.due_on)
    from work.task t join work.task_status s on s.id = t.status_id
    where t.deleted_at is null and t.owner_id is not null and t.due_on >= core.riyadh_today()
      and s.meaning not in ('done', 'cancelled') and not work.task_is_past(t)
      and t.due_on - coalesce((core.setting_at('work.reminder_days_before_due', t.department_id, core.riyadh_today())
                               #>> '{}')::int, 1) <= core.riyadh_today()
  ) a (person_id, alert_key, entity_table, entity_id, label_key, label_args)
  where not exists (select 1 from notify.notification n where n.person_id = a.person_id and n.alert_key = a.alert_key)
$$;

-- Every kind the spec names (§3.3), the due reminder under its job's name.
alter table notify.notification drop constraint notification_kind_check;
alter table notify.notification add constraint notification_kind_check check (kind in (
  'assigned', 'helper_added', 'mentioned', 'changed_by_other', 'followed_change', 'decision_needed', 'report_issued',
  'report_for_review', 'appraisal_step', 'import_done', 'alert_contract_expiring', 'alert_kpi_behind',
  'alert_invoice_unpaid', 'alert_kpi_checkin', 'escalated', 'alert_quiet_client', 'alert_project_no_update',
  'alert_activity_stale', 'alert_file_review', 'reminder', 'note_mention', 'alert_contact_reconfirm',
  'alert_due_tomorrow'));

-- ================================================================ the doors (V124)
revoke all on function work.next_step_task(), core.escalate(text, uuid, uuid, text), work.team_load(uuid[]),
  notify.alert_project_no_update(), notify.alert_due_tomorrow() from public;
grant execute on function core.escalate(text, uuid, uuid, text), work.team_load(uuid[]) to authenticated;
create function api.escalate(p_entity text, p_id uuid, p_to uuid, p_note text) returns jsonb
language sql volatile security invoker set search_path = '' as $$ select core.escalate(p_entity, p_id, p_to, p_note) $$;
create function api.team_load(p_people uuid[] default null) returns jsonb
language sql stable security invoker set search_path = '' as $$ select work.team_load(p_people) $$;
grant execute on function api.escalate(text, uuid, uuid, text), api.team_load(uuid[]) to authenticated;
