-- STALE-01 — an organisation gone stale (V401, V151): it goes stale partner.stale_after_days (21) after its latest
-- activity — by the day the activity happened, not the day it was logged (V400) — or, with none yet, after its side came
-- on; an open next step keeps it fresh until the day after it; the card and the list flag it, the list filters by it,
-- and the alerts job tells its side's owner once, the day it goes stale; a side marked Lost is never stale. Every value
-- is made up.
-- Sabotage: supabase/tests/sabotage/stale-ignores-the-next-step.sql.
select set_config('v2.test_now', '2027-03-10 09:00:00+03', true);
-- the test's devices stay signed in across the weeks it walks through
insert into core.setting (key, department_id, value, valid_from, reason)
values ('auth.device_idle_days', null, '365', core.riyadh_today(), 'made up for a test');
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.lost', (select id::text from partner.side_status_reason where status = 'lost' order by sort limit 1), true);

select test.as_person(current_setting('t.head')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Quiet Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate',
                                                'owner_id', current_setting('t.am1'))))) ->> 'id', true);
select test.eq(api.partner(current_setting('t.p')::uuid) ->> 'stale_on', '2027-03-31',
  'with no activity yet, it goes stale 21 days after its side came on');

select set_config('v2.test_now', '2027-03-30 09:00:00+03', true);
select test.eq(api.partner(current_setting('t.p')::uuid) -> 'flags', '[]'::jsonb, 'the day before, it is not stale');
select set_config('v2.test_now', '2027-03-31 09:00:00+03', true);
select test.eq(api.partner(current_setting('t.p')::uuid) -> 'flags', '["stale"]'::jsonb, 'on the day, the card flags it');
select test.eq(api.partners('{"side": "client", "stale": true}') -> 'rows' -> 0 -> 'flags', '["stale"]'::jsonb,
  'so does the list, which filters by it');
select test.as_owner();
select notify.generate_alerts();
select test.eq((select count(*)::int from notify.notification where kind = 'alert_activity_stale'
                and person_id = current_setting('t.am1')::uuid and entity_id = current_setting('t.p')::uuid), 1,
  'the alerts job tells its owner');
select notify.generate_alerts();
select test.eq((select count(*)::int from notify.notification where kind = 'alert_activity_stale'), 1, 'once');

select test.as_person(current_setting('t.am1')::uuid);
select api.activity_log(current_setting('t.p')::uuid, 'call', 'answered');
select test.eq(api.partner(current_setting('t.p')::uuid) ->> 'stale_on', '2027-04-21', 'an activity makes it fresh again');
select api.activity_log(current_setting('t.p')::uuid, 'call', 'meeting_set', null, null, 'Made-up meeting', '2027-05-01');
select test.eq(api.partner(current_setting('t.p')::uuid) ->> 'stale_on', '2027-05-02',
  'an open next step keeps it fresh until the day after it');
select test.eq(api.partner(current_setting('t.p')::uuid) -> 'next_step' ->> 'on', '2027-05-01', 'the card shows the next step');

select set_config('v2.test_now', '2027-05-01 09:00:00+03', true);
select test.eq(api.partner(current_setting('t.p')::uuid) -> 'flags', '[]'::jsonb, 'on the next step''s day it is fresh');
select set_config('v2.test_now', '2027-05-02 09:00:00+03', true);
select test.eq(api.partner(current_setting('t.p')::uuid) -> 'flags', '["stale"]'::jsonb, 'the day after, stale again');
select api.activity_log(current_setting('t.p')::uuid, 'visit', 'visit_done', '2027-04-01');
select test.eq(api.partner(current_setting('t.p')::uuid) -> 'flags', '["stale"]'::jsonb,
  'an activity logged today but dated 1 April does not make it fresh: it counts on the day it happened');
select test.eq(api.partner(current_setting('t.p')::uuid) ->> 'last_activity_on', '2027-04-01', 'its last activity');
select test.as_owner();
select notify.generate_alerts();
select test.eq((select count(*)::int from notify.notification where kind = 'alert_activity_stale'), 2,
  'the day it goes stale again, its owner is told again');

select test.as_person(current_setting('t.am1')::uuid);
select api.partner_status_set(current_setting('t.p')::uuid, 'client', 'lost', null, current_setting('t.lost')::uuid,
  'made up: went elsewhere');
select test.eq(api.partner(current_setting('t.p')::uuid) -> 'flags', '[]'::jsonb, 'a side marked Lost is never stale');
select test.eq(api.partner(current_setting('t.p')::uuid) ->> 'stale_on', null::text, 'and has no day to go stale');
