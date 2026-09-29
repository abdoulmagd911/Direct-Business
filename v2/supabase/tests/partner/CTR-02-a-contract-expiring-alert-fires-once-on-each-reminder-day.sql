-- CTR-02 — the contract-expiring alert (V56, §3.3): on each reminder day before a contract's end (60 · 30 · 7 by
-- default, or the contract's own days) the alerts job tells its side's owner — the account manager on the Client side —
-- and whoever follows the organisation or the contract, once; the head of that owner's department (the commercial
-- manager) only when partner.contract_notify says so; nothing on other days, nothing when its reminders are off; the
-- list flags the organisation while a contract is expiring. Every value is made up.
-- Sabotage: supabase/tests/sabotage/contract-alerts-every-day.sql.
select set_config('v2.test_now', now()::text, true);
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.f1', test.person('Test Partner Follower', 'member')::text, true);
select set_config('t.f2', test.person('Test Contract Follower', 'member')::text, true);
update core.department set head_person_id = current_setting('t.head')::uuid where code = 'commercial';
select set_config('t.d0', core.riyadh_today()::text, true);

select test.as_person(current_setting('t.head')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Renewals Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate',
                                                'owner_id', current_setting('t.am1'))))) ->> 'id', true);
select set_config('t.a', api.contract_save(current_setting('t.p')::uuid, null, jsonb_build_object('side', 'client', 'title', 'Made-up A',
  'start_on', current_setting('t.d0')::date - 300, 'end_on', current_setting('t.d0')::date + 30)) ->> 'id', true);
select set_config('t.b', api.contract_save(current_setting('t.p')::uuid, null, jsonb_build_object('side', 'client', 'title', 'Made-up B',
  'start_on', current_setting('t.d0')::date - 300, 'end_on', current_setting('t.d0')::date + 31)) ->> 'id', true);
select set_config('t.c', api.contract_save(current_setting('t.p')::uuid, null, jsonb_build_object('side', 'client', 'title', 'Made-up C',
  'start_on', current_setting('t.d0')::date - 300, 'end_on', current_setting('t.d0')::date + 46, 'reminder_days', '[45]'::jsonb))
  ->> 'id', true);
select set_config('t.d', api.contract_save(current_setting('t.p')::uuid, null, jsonb_build_object('side', 'client', 'title', 'Made-up D',
  'start_on', current_setting('t.d0')::date - 300, 'end_on', current_setting('t.d0')::date + 31, 'reminders_on', false))
  ->> 'id', true);
select test.as_person(current_setting('t.f1')::uuid);
select api.follow('partner', current_setting('t.p')::uuid, true);
select test.as_person(current_setting('t.f2')::uuid);
select api.follow('contract', current_setting('t.a')::uuid, true);
select test.eq(api.partners('{"q": "renewals"}') -> 'rows' -> 0 -> 'flags', '["contract_expiring"]'::jsonb,
  'the list flags an organisation whose contract is expiring');

select test.as_owner();
select set_config('t.n1', notify.generate_alerts()::text, true);
select test.eq((select array_agg(person_id order by person_id) from notify.notification
                where kind = 'alert_contract_expiring' and entity_id = current_setting('t.a')::uuid),
  (select array_agg(x order by x) from unnest(array[current_setting('t.am1')::uuid, current_setting('t.f1')::uuid,
                                                    current_setting('t.f2')::uuid]) x),
  '30 days before its end: the account manager and the followers of the partner and of the contract');
select test.eq(current_setting('t.n1')::int, 3, 'and nothing else: not 31 days before, not its own other days, not when off');
select test.eq((select (label_args ->> 'days')::int from notify.notification
                where kind = 'alert_contract_expiring' and person_id = current_setting('t.am1')::uuid), 30, 'saying how many days');
select test.eq(notify.generate_alerts(), 0, 'a second run the same day tells nobody again');

select test.as_person(current_setting('t.admin')::uuid);
select api.setting_set('partner.contract_notify', null,
  '{"account_manager": true, "followers": true, "commercial_manager": true}', null, 'made up: tell the head too');
select test.as_owner();
select test.eq(notify.generate_alerts(), 1, 'with partner.contract_notify saying so, the commercial manager is told too');
select test.eq((select count(*)::int from notify.notification where person_id = current_setting('t.head')::uuid
                and kind = 'alert_contract_expiring'), 1, 'the head of the account manager''s department');

select set_config('v2.test_now', (now() + interval '1 day')::text, true);
select test.eq(notify.generate_alerts(), 6, 'the next day: B reaches 30 days and C its own 45, three people each');
select test.eq((select count(*)::int from notify.notification where kind = 'alert_contract_expiring' and entity_id = current_setting('t.b')::uuid), 3,
  'B is told to the account manager, the partner''s follower and the head');
select test.eq((select count(*)::int from notify.notification where kind = 'alert_contract_expiring' and entity_id = current_setting('t.c')::uuid), 3,
  'C on its own reminder day');
select test.eq((select count(*)::int from notify.notification where kind = 'alert_contract_expiring' and entity_id = current_setting('t.a')::uuid), 4,
  'A, 29 days before its end, is not told again');
select test.eq((select count(*)::int from notify.notification where kind = 'alert_contract_expiring' and entity_id = current_setting('t.d')::uuid), 0,
  'D, its reminders off, never');
