-- ALR-01 — the alerts job (§3.3, V61): every notify.alert_<kind>() is asked; each alert becomes one notification per
-- person, key and Riyadh day — a second run the same day makes nothing new, the next day it fires again; a kind that
-- fails does not stop the others; a kind switched off makes nothing; where pg_cron exists the job runs daily at 06:00
-- Riyadh (03:00 UTC); nobody is told of a record they may not see (V143).
-- Sabotages: supabase/tests/sabotage/alerts-fire-every-run.sql, supabase/tests/sabotage/alerts-ignore-who-may-see.sql.
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.am2', test.person('Test Second Manager', 'member')::text, true);
select set_config('v2.test_now', '2027-03-10 09:00:00+03', true);

-- two made-up alert kinds, and one that fails — standing in for the real ones, which come back with the test's
-- rollback
create or replace function notify.alert_kpi_behind() returns setof notify.alert
language sql stable set search_path = '' as $$
  select current_setting('t.am1')::uuid, 'kpi:made-up-one', null::text, null::uuid, 'alert.kpi_behind', null::jsonb
  union all
  select current_setting('t.am2')::uuid, 'kpi:made-up-one', null, null, 'alert.kpi_behind', null
$$;
create or replace function notify.alert_contract_expiring() returns setof notify.alert
language plpgsql stable set search_path = '' as $$
begin
  raise exception 'a made-up failure';
end
$$;
create or replace function notify.alert_invoice_unpaid() returns setof notify.alert
language sql stable set search_path = '' as $$
  select current_setting('t.am1')::uuid, 'invoice:made-up-two', null::text, null::uuid, 'alert.invoice_unpaid',
         null::jsonb
$$;

select test.eq(notify.generate_alerts(), 3, 'the first run makes three alerts, though one kind failed');
select test.eq((select count(*)::int from notify.notification where person_id = current_setting('t.am1')::uuid
                and kind = 'alert_kpi_behind' and alert_day = '2027-03-10'), 1,
  'each alert is a notification of its kind, for its Riyadh day');
select test.eq(notify.generate_alerts(), 0, 'a second run the same day makes nothing new');
select set_config('v2.test_now', '2027-03-11 09:00:00+03', true);
select test.eq(notify.generate_alerts(), 3, 'the next day they fire again');

insert into core.setting (key, department_id, value, valid_from, reason)
values ('notify.kinds_enabled', null, '["assigned", "alert_invoice_unpaid"]', '2027-03-12', 'made up for a test');
select set_config('v2.test_now', '2027-03-12 09:00:00+03', true);
select test.eq(notify.generate_alerts(), 1, 'a kind switched off makes nothing');

-- nobody is told of a record they may not see (V143, QA): the job asks the same question as everything else
select set_config('t.outsider', test.person('Test Outsider', 'member')::text, true);
insert into core.person_page_level (person_id, page_key, level, reason)
values (current_setting('t.outsider')::uuid, 'clients', 'none', 'made up: no clients'),
       (current_setting('t.outsider')::uuid, 'suppliers_partners', 'none', 'made up: no suppliers');
insert into core.setting (key, department_id, value, valid_from, reason)
values ('auth.device_idle_days', null, '365', core.riyadh_today(), 'made up: the test''s devices stay signed in');
select test.act(current_setting('t.am1')::uuid);
insert into partner.partner (number, trade_name_en) values ('DK-P-9901', 'Made Up Alert Co');
select set_config('t.org', (select id::text from partner.partner where number = 'DK-P-9901'), true);
select test.done();
create or replace function notify.alert_quiet_client() returns setof notify.alert
language sql stable set search_path = '' as $$
  select x.p, 'quiet:made-up-three', 'partner.partner', current_setting('t.org')::uuid, 'alert.quiet_client', null::jsonb
  from (values (current_setting('t.am1')::uuid), (current_setting('t.outsider')::uuid)) x(p)
$$;
insert into core.setting (key, department_id, value, valid_from, reason)
values ('notify.kinds_enabled', null, '["alert_quiet_client"]', '2027-03-13', 'made up for a test');
select set_config('v2.test_now', '2027-03-13 09:00:00+03', true);
select notify.generate_alerts();
select test.eq((select array_agg(person_id) from notify.notification where kind = 'alert_quiet_client'),
  array[current_setting('t.am1')::uuid], 'an alert about a record reaches only those who may see it');

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform test.eq((select schedule from cron.job where jobname = 'notify-generate-alerts'), '0 3 * * *',
      'pg_cron runs the job at 06:00 Riyadh');
    perform test.eq((select command from cron.job where jobname = 'notify-generate-alerts'),
      'select notify.generate_alerts()', 'and the job is the alerts job');
  end if;
end $$;
