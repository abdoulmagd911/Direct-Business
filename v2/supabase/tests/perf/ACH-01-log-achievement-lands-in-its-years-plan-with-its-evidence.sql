-- ACH-01 — Log achievement (§3.8; V68, V99, V400, V467, V505, V506). A member logs their own achievement in a category
-- of the plan of its day's year, with a Direct reference as its evidence, in one request; without a day it is a
-- flagged draft; a deal value only on a category that carries one; Technical integration needs its Product ticket;
-- someone else's needs Full on KPIs; a future day, a year with no plan and a day before 1 January 2025 are refused.
-- Every value is made up.
-- Sabotage: supabase/tests/sabotage/an-achievement-without-its-ticket.sql.
select set_config('v2.test_now', '2026-10-01 09:00:00+03', true);
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.mgr', test.person('Test Manager', 'manager')::text, true);
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.p26', api.plan_open(test.department('commercial'), 2026) ->> 'id', true);
select set_config('t.p25', api.plan_open(test.department('commercial'), 2025) ->> 'id', true);
select test.as_person(current_setting('t.mgr')::uuid);
select set_config('t.org', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Signing Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate',
                                                'owner_id', current_setting('t.am1'))))) ->> 'id', true);

select test.as_person(current_setting('t.am1')::uuid);
select set_config('t.a', api.achievement_log(jsonb_build_object('category', 'contract', 'title', 'Made-up framework deal',
  'happened_on', '2026-09-03', 'partner_id', current_setting('t.org'), 'deal_value', 250000),
  jsonb_build_array(jsonb_build_object('system', 'booking', 'value', 'MADE-UP-1001'))) ->> 'id', true);
select set_config('t.row', api.achievement(current_setting('t.a')::uuid)::text, true);
select test.eq(current_setting('t.row')::jsonb ->> 'category', 'CONTRACT', 'the category is found by its code');
select test.eq((current_setting('t.row')::jsonb ->> 'plan_id'), current_setting('t.p26'), 'in the plan of its year');
select test.eq((current_setting('t.row')::jsonb ->> 'owner_id'), current_setting('t.am1'), 'the person''s own');
select test.eq((current_setting('t.row')::jsonb ->> 'deal_value')::numeric, 250000::numeric, 'with its deal value');
select test.eq((current_setting('t.row')::jsonb ->> 'no_evidence')::boolean, false, 'a reference is evidence (V99)');
select test.eq(jsonb_array_length(current_setting('t.row')::jsonb -> 'refs'), 1, 'and it is listed');
select test.eq(current_setting('t.row')::jsonb ->> 'line_en', 'Contract signed with Made Up Signing Co: Made-up framework deal',
  'the line is drafted from the category''s sentence');
select test.as_owner();
select test.eq((select count(distinct c.request_id)::int from audit.change c
                where c.row_id = current_setting('t.a')::uuid
                   or c.row_id in (select id from perf.achievement_ref where achievement_id = current_setting('t.a')::uuid)),
  1, 'the achievement and its reference are one request');

select test.as_person(current_setting('t.am1')::uuid);
select set_config('t.d', api.achievement_log(jsonb_build_object('category', 'AWARD', 'title', 'Made-up award, date to come'))
  ->> 'id', true);
select test.eq((api.achievement(current_setting('t.d')::uuid) ->> 'draft')::boolean, true, 'no day: a flagged draft (V68)');
select test.eq((api.achievement(current_setting('t.d')::uuid) ->> 'no_evidence')::boolean, true, 'with no evidence yet');
select test.eq((api.achievement_log(jsonb_build_object('category', 'AWARD', 'title', 'Made-up 2025 award',
  'happened_on', '2025-06-10')) ->> 'id') is not null, true, 'a 2025 day goes to the 2025 plan');

select test.raises($$select api.achievement_log(jsonb_build_object('category', 'AWARD', 'title', 'Made up',
  'deal_value', 10))$$, 'P0001', 'a deal value only where the category carries one (V505)', 'achievement.no_deal_value');
select test.raises($$select api.achievement_log(jsonb_build_object('category', 'INTEGRATION', 'title', 'Made-up API link',
  'happened_on', '2026-09-20'))$$, 'P0001', 'an integration needs its Product ticket (V99)', 'achievement.ref_required');
select test.eq((api.achievement_log(jsonb_build_object('category', 'INTEGRATION', 'title', 'Made-up API link',
  'happened_on', '2026-09-20'), jsonb_build_array(jsonb_build_object('system', 'ticket', 'value', 'MADE-UP-T-7')))
  ->> 'id') is not null, true, 'with it, it is saved');
select set_config('t.aw', api.achievement_log(jsonb_build_object('category', 'AWARD', 'title', 'Made-up re-filed',
  'happened_on', '2026-09-21')) ->> 'id', true);
select test.raises(format('select api.achievement_update(%L, %L::jsonb, 1)', current_setting('t.aw'),
  '{"category": "INTEGRATION"}'), 'P0001', 're-filed as an integration, it needs the ticket too', 'achievement.ref_required');
select test.raises($$select api.achievement_log(jsonb_build_object('category', 'AWARD', 'title', 'Made up',
  'happened_on', '2026-10-02'))$$, 'P0001', 'never after the day it is logged (V400)', 'common.date_in_future');
select test.raises($$select api.achievement_log(jsonb_build_object('category', 'AWARD', 'title', 'Made up',
  'happened_on', '2024-12-31'))$$, 'P0001', 'no plan before 2025', 'achievement.no_plan');
select test.raises($$select api.achievement_log(jsonb_build_object('category', 'NOT-A-CODE', 'title', 'Made up'))$$,
  'P0002', 'a category of the plan only', 'list.unknown_value');
select test.raises(format('select api.achievement_log(%L::jsonb)', jsonb_build_object('category', 'AWARD',
  'title', 'Made up', 'owner_id', current_setting('t.mgr'))), '42501', 'a member logs only their own (V467)',
  'access.needs_level');
select test.raises($$select api.achievement_log(jsonb_build_object('category', 'AWARD', 'title', 'Made up',
  'colour', 'red'))$$, 'P0001', 'an unknown field is named', 'common.unknown_field');

select test.as_person(current_setting('t.mgr')::uuid);
select test.eq((api.achievement_log(jsonb_build_object('category', 'AWARD', 'title', 'Made-up credited award',
  'happened_on', '2026-09-01', 'owner_id', current_setting('t.am1'))) ->> 'id') is not null, true,
  'a manager credits someone else (V467)');

-- the database refuses a day before 1 January 2025 whatever door writes it (V506)
select test.as_owner();
select test.raises(format($$update perf.achievement set happened_on = '2024-12-31' where id = %L$$, current_setting('t.a')),
  'P0001', 'nothing is dated before 1 January 2025', 'achievement.no_plan');
select test.raises(format($$insert into perf.plan (department_id, year, name) values (%L, 2024, 'Made up')$$,
  test.department('commercial')), '23514', 'and no plan is opened for a year before 2025');

-- a project or task it names must exist (V376: work.project and work.task landed first, #140)
select test.raises(format($$update perf.achievement set project_id = gen_random_uuid() where id = %L$$,
  current_setting('t.a')), '23503', 'no made-up project');
select test.raises(format($$update perf.achievement set source_task_id = gen_random_uuid() where id = %L$$,
  current_setting('t.a')), '23503', 'no made-up task');
