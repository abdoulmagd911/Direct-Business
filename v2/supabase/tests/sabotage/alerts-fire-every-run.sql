-- Sabotage: alerts-fire-every-run
-- Breaks: sql:ALR-01
-- Expect: a second run the same day makes nothing new
-- Alerts are not kept to one per person, key and day: every run of the job repeats them.
drop index notify.notification_alert_once;
create or replace function notify.generate_alerts() returns int
language plpgsql volatile security definer set search_path = ''
as $$
declare
  f record;
  k int;
  n int := 0;
  day date := core.riyadh_today();
begin
  for f in
    select p.proname
    from pg_catalog.pg_proc p join pg_catalog.pg_namespace s on s.oid = p.pronamespace
    where s.nspname = 'notify' and p.proname like 'alert\_%' and p.proretset
      and p.prorettype = 'notify.alert'::regtype and p.pronargs = 0
    order by p.proname
  loop
    begin
      execute pg_catalog.format(
        'insert into notify.notification (person_id, kind, entity_table, entity_id, label_key, label_args, alert_key,'
        || ' alert_day) select a.person_id, %L, a.entity_table, a.entity_id, a.label_key, a.label_args, a.alert_key, $1'
        || ' from notify.%I() a where a.alert_key is not null and notify.may_notify(a.person_id, %L)'
        || '',
        f.proname, f.proname, f.proname) using day;
      get diagnostics k = row_count;
      n := n + k;
    exception when others then
      raise warning 'notify.generate_alerts: % failed: %', f.proname, sqlerrm;
    end;
  end loop;
  return n;
end
$$;
