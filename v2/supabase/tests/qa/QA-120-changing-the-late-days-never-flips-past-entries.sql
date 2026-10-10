-- QA-120 — Changing the late days never flips past entries (V97: an effective date for anything that changes numbers;
-- V400; the scenario catalogue's PRF-143): an admin moves work.late_days from 14 to 7; an update logged before that day
-- 10 days after it happened stays on time and one logged 16 days after stays late — each is read by the rule of the
-- day it was logged — while entries logged after the change take 7 (9 days late: late; 7: not). Written by the QA
-- auditor to fail until built: on v2/main work.late_days is not effective-dated (setting_def.effective_dated false) and
-- core.logged_late reads it as of today (core.setting_at('work.late_days', null, core.riyadh_today())), so the
-- 10-day update logged under the 14-day rule turns "logged late" the day the admin saves 7. The dates are relative to
-- today, the test clock (v2.test_now) set to noon Riyadh on each day an action happens.
-- Made-up values only (V101 shapes).
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.m', test.person('Test Member', 'member')::text, true);
select set_config('t.today', core.riyadh_today()::text, true);

-- forty days ago: go-live, and the organisation
select set_config('v2.test_now', (current_setting('t.today')::date - 40)::text || ' 12:00:00+03', true);
select test.as_person(current_setting('t.admin')::uuid);
select api.setting_set('app.go_live_on', null, to_jsonb((current_setting('t.today')::date - 40)::text), null,
  'made up: go-live');
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Trading QA120', 'sides',
  jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate')))) ->> 'id', true);

-- twenty days ago, under the 14-day rule: one update 10 days after it happened, one 16 days after
select set_config('v2.test_now', (current_setting('t.today')::date - 20)::text || ' 12:00:00+03', true);
select test.as_person(current_setting('t.m')::uuid);
select set_config('t.a', api.note_add('partner', current_setting('t.p')::uuid, 'update', 'made up: ten days on',
  current_setting('t.today')::date - 30) ->> 'id', true);
select set_config('t.b', api.note_add('partner', current_setting('t.p')::uuid, 'update', 'made up: sixteen days on',
  current_setting('t.today')::date - 36) ->> 'id', true);
select set_config('t.late', (select jsonb_object_agg(n ->> 'id', (n ->> 'logged_late')::boolean)
                             from jsonb_array_elements(api.notes('partner', current_setting('t.p')::uuid)) n)::text, true);
select test.eq((current_setting('t.late')::jsonb ->> current_setting('t.a'))::boolean, false,
  'on the day, 10 days after is on time under the 14-day rule');
select test.eq((current_setting('t.late')::jsonb ->> current_setting('t.b'))::boolean, true, 'and 16 days after is late');

-- ten days ago the admin saves 7
select set_config('v2.test_now', (current_setting('t.today')::date - 10)::text || ' 12:00:00+03', true);
select test.as_person(current_setting('t.admin')::uuid);
select api.setting_set('work.late_days', null, '7', null, 'made up: a week is enough');

-- today, under the 7-day rule: 9 days after and 7 days after
select set_config('v2.test_now', '', true);
select test.as_person(current_setting('t.m')::uuid);
select set_config('t.c', api.note_add('partner', current_setting('t.p')::uuid, 'update', 'made up: nine days on',
  current_setting('t.today')::date - 9) ->> 'id', true);
select set_config('t.d', api.note_add('partner', current_setting('t.p')::uuid, 'update', 'made up: seven days on',
  current_setting('t.today')::date - 7) ->> 'id', true);
select set_config('t.late', (select jsonb_object_agg(n ->> 'id', (n ->> 'logged_late')::boolean)
                             from jsonb_array_elements(api.notes('partner', current_setting('t.p')::uuid)) n)::text, true);
select test.eq((current_setting('t.late')::jsonb ->> current_setting('t.c'))::boolean, true,
  'after the change, 9 days after is late');
select test.eq((current_setting('t.late')::jsonb ->> current_setting('t.d'))::boolean, false, 'and 7 days after is not');
select test.eq((current_setting('t.late')::jsonb ->> current_setting('t.b'))::boolean, true,
  'an update late under the old rule stays late');
select test.eq((current_setting('t.late')::jsonb ->> current_setting('t.a'))::boolean, false,
  'an update logged on time under the old rule stays on time: the late days are read as of the day it was logged');
