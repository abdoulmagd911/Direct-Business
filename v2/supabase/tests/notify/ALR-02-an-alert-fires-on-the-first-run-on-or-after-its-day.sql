-- ALR-02 — an alert fires on the first run on or after its day (WRK-124): a day the daily job did not run loses
-- nothing — the contract reminder due that day and an organisation gone stale that day are told on the next run, once,
-- and never again for the same day's reason. A reminder day from before the contract was added is never caught up.
-- Made up.
-- Sabotage: supabase/tests/sabotage/a-missed-run-loses-the-alert.sql.
select set_config('v2.test_now', now()::text, true);
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.d0', core.riyadh_today()::text, true);
select test.as_person(current_setting('t.am1')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Late Runs Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate',
                                                'owner_id', current_setting('t.am1'))))) ->> 'id', true);
select set_config('t.k', api.contract_save(current_setting('t.p')::uuid, null, jsonb_build_object('side', 'client',
  'title', 'Made-up Late', 'start_on', current_setting('t.d0')::date - 300, 'end_on', current_setting('t.d0')::date + 31))
  ->> 'id', true);
select test.as_owner();
select test.eq((select count(*)::int from notify.alert_contract_expiring() a where a.entity_id = current_setting('t.k')::uuid),
  0, 'added 31 days before its end: the 60-day reminder, from before it existed, is not caught up');

-- the job does not run tomorrow, the 30-day reminder's day; it runs the day after
select set_config('v2.test_now', (now() + interval '2 days')::text, true);
select notify.generate_alerts();
select test.eq((select count(*)::int from notify.notification where kind = 'alert_contract_expiring'
                and entity_id = current_setting('t.k')::uuid), 1, 'the reminder a missed run did not send comes on the next');
select test.eq((select (label_args ->> 'days')::int from notify.notification where kind = 'alert_contract_expiring'
                and entity_id = current_setting('t.k')::uuid), 29, 'saying the days left now');
select set_config('v2.test_now', (now() + interval '3 days')::text, true);
select notify.generate_alerts();
select test.eq((select count(*)::int from notify.notification where kind = 'alert_contract_expiring'
                and entity_id = current_setting('t.k')::uuid), 1, 'and only once');

-- the organisation goes stale on a day with no run
select set_config('v2.test_now', (now() + interval '40 days')::text, true);
select notify.generate_alerts();
select test.eq((select count(*)::int from notify.notification where kind = 'alert_activity_stale'
                and entity_id = current_setting('t.p')::uuid), 1, 'gone stale on a day with no run, it is told on the next');
select set_config('v2.test_now', (now() + interval '41 days')::text, true);
select notify.generate_alerts();
select test.eq((select count(*)::int from notify.notification where kind = 'alert_activity_stale'
                and entity_id = current_setting('t.p')::uuid), 1, 'and once');
