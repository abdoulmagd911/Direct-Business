-- CALL-01 — Log call (V63): one click on a partner — an outcome from the settings list, an optional line — puts the call
-- on its timeline with its day (today unless given), no task needed; "meeting set" offers a prefilled task and a demo
-- outcome says it counts as a demo; an unknown outcome, a day still to come and an archived partner are refused; a
-- person who may not add to the partner logs no call. Every value is made up.
-- Sabotage: supabase/tests/sabotage/anyone-logs-a-call.sql.
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.viewer', test.person('Test Viewer', 'viewer')::text, true);
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.p', api.partner_create('{"trade_name_en": "Made Up Calls Co"}') ->> 'id', true);
select set_config('t.gone', api.partner_create('{"trade_name_en": "Made Up Calls Twin"}') ->> 'id', true);
select api.partner_merge(current_setting('t.p')::uuid, current_setting('t.gone')::uuid, 'made up: the same company');

select test.as_person(current_setting('t.am1')::uuid);
select set_config('t.c', api.partner_log_call(current_setting('t.p')::uuid, 'meeting_set', 'Made-up call: meeting next week')::text,
  true);
select test.eq((current_setting('t.c')::jsonb ->> 'offer_task')::boolean, true, '"meeting set" offers a prefilled task');
select set_config('t.row', (api.notes('partner', current_setting('t.p')::uuid, array['call']) -> 0)::text, true);
select test.eq(current_setting('t.row')::jsonb ->> 'outcome', 'meeting_set', 'the call is on the timeline with its outcome');
select test.eq(current_setting('t.row')::jsonb ->> 'occurred_on', core.riyadh_today()::text, 'on today''s date');
select test.eq((api.partner_log_call(current_setting('t.p')::uuid, 'demo_held', null, core.riyadh_today() - 1)
                ->> 'counts_as_demo')::boolean, true, 'a demo outcome counts as a demo; the line is optional');
select test.eq((api.partner_log_call(current_setting('t.p')::uuid, 'answered') ->> 'offer_task')::boolean, false,
  'another outcome offers no task');
select test.raises(format('select api.partner_log_call(%L, %L)', current_setting('t.p'), 'shouted'), 'P0002',
  'an outcome must be on the list', 'partner.unknown_outcome');
select test.raises(format('select api.partner_log_call(%L, %L, null, %L)', current_setting('t.p'), 'answered',
  core.riyadh_today() + 1), 'P0001', 'a call is not logged ahead of its day', 'note.date_in_future');
select test.raises(format('select api.partner_log_call(%L, %L)', current_setting('t.gone'), 'answered'), 'P0001',
  'an archived partner takes no calls', 'partner.archived');

select test.as_person(current_setting('t.viewer')::uuid);
select test.raises(format('select api.partner_log_call(%L, %L)', current_setting('t.p'), 'answered'), '42501',
  'a viewer logs no call', 'access.needs_level');
