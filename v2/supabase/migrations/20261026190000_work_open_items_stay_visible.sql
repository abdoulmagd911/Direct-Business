-- D (the Architect's order of 26 Oct, his recommendation, the owner not objecting): open items stay visible.
--  1. An open task with an owner is never past work, whatever its date: it shows on My work and My day, counts as
--     overdue when it is, and tells people of its changes. Past work is what is closed from before day one
--     (app.go_live_on, V609), what was added through the Past work form, and — V491/V506 still — a task from before day
--     one whose owner is Unknown, until someone takes it. Every reader of work.task_is_past follows: My day, My work,
--     the weekly review, the due and overdue alerts, the record's links, leaving.
--  2. An open task past its due day tells its owner once, "<task> is overdue" (label alert.overdue), under the due
--     alert's own setting (alert_due_tomorrow), as "coming due" does before it.
-- Forward-only (V103).

create or replace function work.task_is_past(t work.task) returns boolean
language sql stable security definer set search_path = ''
as $$
  select t.origin = 'backfill'
      or (work.is_past(t.happened_on) and (t.closed_at is not null or t.owner_id is null))
$$;

create or replace function notify.alert_due_tomorrow() returns setof notify.alert
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
    union all
    -- D: past its due day and still open, once for that due day
    select t.owner_id, 'overdue:' || t.id || ':' || t.due_on, 'work.task', t.id, 'alert.overdue',
           pg_catalog.jsonb_build_object('number', t.number, 'title', t.title, 'due_on', t.due_on)
    from work.task t join work.task_status s on s.id = t.status_id
    where t.deleted_at is null and t.owner_id is not null and t.due_on < core.riyadh_today()
      and s.meaning not in ('done', 'cancelled') and not work.task_is_past(t)
  ) a (person_id, alert_key, entity_table, entity_id, label_key, label_args)
  where not exists (select 1 from notify.notification n where n.person_id = a.person_id and n.alert_key = a.alert_key)
$$;
