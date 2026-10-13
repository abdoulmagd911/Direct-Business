-- PIPE-04 — the board (§3.7a; V96, OLD-WRK-066): each stage of the board in order with its cards, their count and value;
-- one partnerships board for both sides with a side filter; the whole team of the card's department sees it, another
-- department does not; a removal hides it and Undo brings it back. Every value is made up.
-- Sabotage: supabase/tests/sabotage/the-board-shows-other-departments.sql.
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.am1', test.person('Test Partnerships', 'member')::text, true);
select set_config('t.am2', test.person('Test Colleague', 'member')::text, true);
select set_config('t.ops', test.person('Test Operations', 'member', 'operations')::text, true);
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Airline Partner',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate')))) ->> 'id', true);

select test.as_person(current_setting('t.am1')::uuid);
select set_config('t.s', api.opportunity_save(null, jsonb_build_object('title', 'Made-up supply deal',
  'partner_id', current_setting('t.p'), 'side', 'supplier_partner', 'type', 'airline', 'source', 'outbound',
  'expected_value_sar', 40000)) ->> 'id', true);
select set_config('t.c', api.opportunity_save(null, jsonb_build_object('title', 'Made-up client deal',
  'partner_id', current_setting('t.p'), 'side', 'client', 'type', 'corporate', 'source', 'referral',
  'expected_value_sar', 60000)) ->> 'id', true);
select api.pipeline_move('opportunity', current_setting('t.c')::uuid, 'demo');

select test.as_person(current_setting('t.am2')::uuid);
select test.eq((select jsonb_agg(s ->> 'stage') from jsonb_array_elements(api.pipeline_board('opportunity')) s),
  '["contacted", "demo", "proposal", "signed", "handed_over", "onboarded", "lost"]'::jsonb, 'every stage, in order');
select test.eq((select jsonb_object_agg(s ->> 'stage', jsonb_build_array((s ->> 'count')::int, (s ->> 'value_sar')::numeric))
                from jsonb_array_elements(api.pipeline_board('opportunity')) s where s ->> 'stage' in ('contacted', 'demo')),
  '{"contacted": [1, 40000], "demo": [1, 60000]}'::jsonb, 'each with its cards'' count and value, for the whole team');
select test.eq((select jsonb_agg(c ->> 'title') from jsonb_array_elements(api.pipeline_board('opportunity',
                '{"side": "client"}')) s, jsonb_array_elements(s -> 'cards') c),
  '["Made-up client deal"]'::jsonb, 'one board for both sides, with a side filter');
select test.as_person(current_setting('t.ops')::uuid);
select test.eq((select sum((s ->> 'count')::int)::int from jsonb_array_elements(api.pipeline_board('opportunity')) s), 0,
  'another department sees none of them');
select test.raises(format('select api.pipeline_card(%L, %L)', 'opportunity', current_setting('t.s')), 'P0002',
  'nor one by its id', 'common.not_found');

select test.as_person(current_setting('t.am1')::uuid);
select set_config('t.rm', api.pipeline_remove('opportunity', array[current_setting('t.s')::uuid], 'made up: duplicate')
  ->> 'request_id', true);
select test.eq((select sum((s ->> 'count')::int)::int from jsonb_array_elements(api.pipeline_board('opportunity')) s), 1,
  'a removed card leaves the board');
select api.undo(current_setting('t.rm')::uuid);
select test.eq((select sum((s ->> 'count')::int)::int from jsonb_array_elements(api.pipeline_board('opportunity')) s), 2,
  'and Undo brings it back');
