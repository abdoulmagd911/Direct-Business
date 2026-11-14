-- D-myday (13 Nov): the Thursday bell's job keeps Riyadh's Thursday, and asks only the weekly bell.
-- pg_cron reads its schedule in UTC (cron.timezone is GMT on the Supabase stack), so the hourly job of
-- 20261107160000 ('0 * * * 4') ran over UTC's Thursday — Riyadh's Thursday from 03:00 to Friday 02:59. A nudge time set
-- between 00:00 and 02:59 (nudge.weekly_time) therefore never rang: in those Riyadh hours it is still Wednesday in UTC.
-- And each run called notify.generate_alerts(), so every daily alert of the app was also asked every hour of a
-- Thursday, and from 03:00 Riyadh, before the daily 06:00 job. The job now runs every hour of UTC's Wednesday and
-- Thursday (which holds all of Riyadh's Thursday) and asks the weekly bell alone; the bell's own guards (a Thursday in
-- Riyadh, the hour of the nudge time read from settings) and the one-per-person-and-day key are unchanged, and the
-- daily notify.generate_alerts() still asks it as before. Forward-only (V103).

-- notify.generate_alerts()'s insert, for notify.alert_weekly_unlogged() alone (the same kind, guards and dedup)
create function notify.generate_weekly_unlogged() returns integer
language plpgsql volatile security definer set search_path = ''
as $$
declare
  k int;
begin
  insert into notify.notification (person_id, kind, entity_table, entity_id, label_key, label_args, alert_key, alert_day)
  select a.person_id, 'alert_weekly_unlogged', a.entity_table, a.entity_id, a.label_key, a.label_args, a.alert_key,
         core.riyadh_today()
  from notify.alert_weekly_unlogged() a
  where a.alert_key is not null and notify.may_notify(a.person_id, 'alert_weekly_unlogged')
    and (a.entity_table is null or authz.can_see_as(a.person_id, a.entity_table, a.entity_id))
  on conflict do nothing;
  get diagnostics k = row_count;
  return k;
end
$$;
comment on function notify.generate_weekly_unlogged() is
  'D-myday: the Thursday bell alone — what notify.generate_alerts() makes of notify.alert_weekly_unlogged(), for its hourly job.';
revoke all on function notify.generate_weekly_unlogged() from public;

-- the same job name, re-scheduled (pg_cron updates a job scheduled again under its name)
do $$
begin
  if exists (select 1 from pg_catalog.pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('notify-weekly-unlogged', '0 * * * 3,4', 'select notify.generate_weekly_unlogged()');
  end if;
end $$;
