-- WREV-03 — D-myday (13 Nov): the Thursday bell's job keeps Riyadh's Thursday. pg_cron reads its schedule in UTC, so the
-- hourly job runs over UTC's Wednesday and Thursday, which hold all of Riyadh's Thursday: a nudge time of 01:00 Riyadh
-- (22:00 UTC on Wednesday) rings, once; Wednesday in Riyadh rings nothing. The job asks the weekly bell alone, never the
-- app's daily alerts. Days come from the test clock (Riyadh, D20). Every value is made up.
select set_config('v2.test_now', '2026-10-01 00:30:00+03', true);
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'test_wrev3', 'Test Thursday Bell Desk', 'فريق جرس الخميس');
select set_config('t.own', test.person('Test Bell Owner', 'member')::text, true);
select set_config('t.admin', test.person('Test Bell Admin', 'admin')::text, true);
update core.person set team_id = (select id from core.team where code = 'test_wrev3')
where id = current_setting('t.own')::uuid;
insert into core.setting (key, value, valid_from, reason, created_by)
values ('app.go_live_on', to_jsonb((core.riyadh_today() - 30)::text), core.riyadh_today() - 30, 'made up: go-live',
        current_setting('t.admin')::uuid);
insert into core.setting (key, department_id, value, valid_from, reason, created_by)
values ('notify.kinds_enabled', test.department('commercial'),
        (select default_value from core.setting_def where key = 'notify.kinds_enabled'),
        core.riyadh_today() - 1, 'made up: the weekly kind is on for this team', current_setting('t.admin')::uuid);
-- the nudge an hour after midnight, Riyadh: still Wednesday in UTC
insert into core.setting (key, value, valid_from, reason, created_by)
values ('nudge.weekly_time', to_jsonb('01:00'::text), core.riyadh_today() - 1, 'made up: a nudge just after midnight',
        current_setting('t.admin')::uuid);

-- one high-priority task, closed and not logged as an achievement
select test.as_person(current_setting('t.own')::uuid);
select set_config('t.task', api.task_create(jsonb_build_object('title', 'Made-up bell call', 'priority', 'high')) ->> 'id',
  true);
select api.task_status_set(current_setting('t.task')::uuid, 'done');
select test.as_owner();

-- the job's schedule, where pg_cron is installed: every hour of UTC's Wednesday and Thursday, asking the bell alone
do $$
declare
  job record;
begin
  if exists (select 1 from pg_catalog.pg_namespace where nspname = 'cron') then
    execute 'select schedule, command from cron.job where jobname = ''notify-weekly-unlogged''' into job;
    perform test.eq(job.schedule::text, '0 * * * 3,4', 'the job runs every hour of UTC''s Wednesday and Thursday');
    perform test.eq(job.command::text, 'select notify.generate_weekly_unlogged()', 'and asks the weekly bell alone');
  end if;
end $$;

-- the owner's bell items (the counts name this test's own person, so other people in a shared local database do not
-- move them)
create function pg_temp.told(p_kind text default 'alert_weekly_unlogged') returns int
language sql as $$
  select count(*)::int from notify.notification
  where person_id = current_setting('t.own')::uuid and alert_key is not null
    and (kind = p_kind or (p_kind = 'other' and kind <> 'alert_weekly_unlogged'))
$$;

-- 00:30 Thursday, Riyadh: not the nudge hour yet
select notify.generate_weekly_unlogged();
select test.eq(pg_temp.told(), 0, 'before the nudge hour nothing rings');
-- 01:00 Thursday, Riyadh — 22:00 on Wednesday in UTC, a run the old Thursday-only schedule never made
select set_config('v2.test_now', '2026-10-01 01:00:00+03', true);
select test.eq(extract(dow from core.clock() at time zone 'UTC')::int, 3, 'it is still Wednesday in UTC');
select notify.generate_weekly_unlogged();
select test.eq(pg_temp.told(), 1, 'at the nudge hour the owner is told');
select notify.generate_weekly_unlogged();
select test.eq(pg_temp.told(), 1, 'once: a second run in the same hour makes nothing new');
select test.eq(pg_temp.told('other'), 0, 'and no other alert came with it');

-- the same hour on Wednesday in Riyadh rings nothing
select set_config('v2.test_now', '2026-10-07 01:00:00+03', true);
select notify.generate_weekly_unlogged();
select test.eq(pg_temp.told(), 1, 'Wednesday in Riyadh rings nothing');
