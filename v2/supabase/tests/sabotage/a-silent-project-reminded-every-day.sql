-- Sabotage: a-silent-project-reminded-every-day
-- Breaks: sql:ALR-03
-- Expect: fourteen days silent, its owner is told once
-- The reminder's key is the day, so a silent project is reminded every day.
create or replace function notify.alert_project_no_update() returns setof notify.alert
language sql stable security definer set search_path = ''
as $$
  select a.person_id, a.alert_key, a.entity_table, a.entity_id, a.label_key, a.label_args
  from (
    select p.owner_id, 'project_no_update:' || p.id || ':' || core.riyadh_today(), 'work.project', p.id, 'alert.project_no_update',
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
