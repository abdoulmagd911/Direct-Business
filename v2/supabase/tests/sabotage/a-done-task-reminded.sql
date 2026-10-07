-- Sabotage: a-done-task-reminded
-- Breaks: sql:ALR-03
-- Expect: the done task never
-- A task done early is still reminded of its due day.
create or replace function notify.alert_due_tomorrow() returns setof notify.alert
language sql stable security definer set search_path = ''
as $$
  select a.person_id, a.alert_key, a.entity_table, a.entity_id, a.label_key, a.label_args
  from (
    select t.owner_id, 'due_tomorrow:' || t.id || ':' || t.due_on, 'work.task', t.id, 'alert.due_tomorrow',
           pg_catalog.jsonb_build_object('number', t.number, 'title', t.title, 'due_on', t.due_on)
    from work.task t join work.task_status s on s.id = t.status_id
    where t.deleted_at is null and t.owner_id is not null and t.due_on >= core.riyadh_today()
      and not work.task_is_past(t)
      and t.due_on - coalesce((core.setting_at('work.reminder_days_before_due', t.department_id, core.riyadh_today())
                               #>> '{}')::int, 1) <= core.riyadh_today()
  ) a (person_id, alert_key, entity_table, entity_id, label_key, label_args)
  where not exists (select 1 from notify.notification n where n.person_id = a.person_id and n.alert_key = a.alert_key)
$$;
