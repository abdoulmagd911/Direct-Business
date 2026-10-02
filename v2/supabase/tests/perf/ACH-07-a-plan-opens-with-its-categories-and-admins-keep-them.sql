-- ACH-07 — plans and categories (§3.8, §5a; V66, V76, V90, V99, V505). An admin opens a department's plan for a year:
-- the first one starts with the starting categories, each with its Arabic name and sentence; the next copies the
-- nearest year's, sub-categories under their copied parents; one plan per department and year. Only admins change
-- categories; a code is kept; a category in use is retired, never removed, and a retired one takes no new
-- achievement; a deal value stays where values are typed; a name never carries a banned word. Every value is made up.
-- Sabotage: supabase/tests/sabotage/a-plan-opens-without-its-categories.sql.
select set_config('v2.test_now', '2026-10-01 09:00:00+03', true);
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.mgr', test.person('Test Manager', 'manager')::text, true);
select test.as_person(current_setting('t.mgr')::uuid);
select test.raises(format('select api.plan_open(%L, 2026)', test.department('commercial')), '42501',
  'only an admin opens a plan', 'access.needs_level');

select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.p26', api.plan_open(test.department('commercial'), 2026) ->> 'id', true);
select test.eq((select array_agg(x ->> 'code' order by x ->> 'code') from jsonb_array_elements(
  api.achievement_categories(current_setting('t.p26')::uuid)) x),
  array['AWARD', 'CASHBACK', 'CONTRACT', 'COST', 'INTEGRATION', 'MOU', 'PROBLEM'], 'the first plan starts with the starting categories');
select test.eq((select count(*)::int from jsonb_array_elements(api.achievement_categories(current_setting('t.p26')::uuid)) x
                where x ->> 'name_ar' = '' or x ->> 'line_template_ar' not like '%{title}%'), 0,
  'each with its Arabic name and sentence (V76)');
select test.eq((select array_agg(x ->> 'code' order by x ->> 'code') from jsonb_array_elements(
  api.achievement_categories(current_setting('t.p26')::uuid)) x where (x ->> 'has_deal_value')::boolean),
  array['CONTRACT', 'MOU'], 'Contract signed and MoU carry a deal value (V505)');
select test.raises(format('select api.plan_open(%L, 2026)', test.department('commercial')), '23505',
  'one plan per department and year', 'plan.year_taken');

select set_config('t.gov', api.achievement_category_save(null, current_setting('t.p26')::uuid,
  '{"code": "GOV-CONTRACT", "name_en": "Government contract", "name_ar": "عقد حكومي", "parent": "CONTRACT",
    "has_deal_value": true}') ->> 'id', true);
select test.raises(format('select api.achievement_category_save(null, %L, %L::jsonb)', current_setting('t.p26'),
  '{"code": "gov-contract", "name_en": "Again", "name_ar": "مرة أخرى"}'), '23505', 'a code once per plan',
  'achievement_category.code_taken');
select test.raises(format('select api.achievement_category_save(%L, null, %L::jsonb, 1)', current_setting('t.gov'),
  '{"code": "OTHER"}'), 'P0001', 'a code is kept', 'achievement_category.code_fixed');
select test.raises(format('select api.achievement_category_save(null, %L, %L::jsonb)', current_setting('t.p26'),
  jsonb_build_object('code', 'BANNED', 'name_en', 'Made-up ' || 'B2B' || ' deals', 'name_ar', 'صفقات')), 'P0001',
  'a name never carries a banned word (V404)');

select test.raises(format('select api.achievement_category_save(%L, null, %L::jsonb, %s)',
  (select x ->> 'id' from jsonb_array_elements(api.achievement_categories(current_setting('t.p26')::uuid)) x
   where x ->> 'code' = 'CONTRACT'), '{"parent": "MOU"}',
  (select x ->> 'version' from jsonb_array_elements(api.achievement_categories(current_setting('t.p26')::uuid)) x
   where x ->> 'code' = 'CONTRACT')), 'P0001', 'one level of sub-categories only', 'achievement_category.parent_invalid');
select set_config('t.p25', api.plan_open(test.department('commercial'), 2025) ->> 'id', true);
select test.eq((select x ->> 'parent_code' from jsonb_array_elements(api.achievement_categories(current_setting('t.p25')::uuid)) x
                where x ->> 'code' = 'GOV-CONTRACT'), 'CONTRACT', 'the next plan copies the nearest, sub-categories and all');
select test.eq((select x ->> 'copied_from_plan_id' from jsonb_array_elements(api.plans()) x where (x ->> 'year')::int = 2025),
  current_setting('t.p26'), 'and says which');

select test.as_person(current_setting('t.mgr')::uuid);
select test.raises(format('select api.achievement_category_save(%L, null, %L::jsonb, 1)', current_setting('t.gov'),
  '{"name_en": "Made up"}'), '42501', 'only an admin changes a category', 'access.needs_level');
select set_config('t.a', api.achievement_log('{"category": "GOV-CONTRACT", "title": "Made-up sub-category deal",
  "happened_on": "2026-09-10", "deal_value": 1000}') ->> 'id', true);
select test.eq(api.achievement(current_setting('t.a')::uuid) ->> 'parent_category', 'CONTRACT',
  'a sub-category''s achievement names its parent');
select test.eq((api.achievements(jsonb_build_object('category', 'CONTRACT')) ->> 'total')::int, 1,
  'and is found under it');

select test.as_person(current_setting('t.admin')::uuid);
select test.raises(format('select api.achievement_categories_remove(array[%L]::uuid[])', current_setting('t.gov')),
  'P0001', 'a category in use is never removed', 'list.in_use');
select test.raises(format('select api.achievement_category_save(%L, null, %L::jsonb, %s)', current_setting('t.gov'),
  '{"has_deal_value": false}', (select x ->> 'version' from jsonb_array_elements(api.achievement_categories(current_setting('t.p26')::uuid)) x where x ->> 'code' = 'GOV-CONTRACT')),
  'P0001', 'a deal value stays where values are typed', 'achievement_category.deal_values_held');
select test.runs(format('select api.achievement_category_save(%L, null, %L::jsonb, %s)', current_setting('t.gov'),
  '{"active": false}', (select x ->> 'version' from jsonb_array_elements(api.achievement_categories(current_setting('t.p26')::uuid)) x where x ->> 'code' = 'GOV-CONTRACT')),
  'it is retired instead');
select test.as_person(current_setting('t.mgr')::uuid);
select test.raises($$select api.achievement_log('{"category": "GOV-CONTRACT", "title": "Made up",
  "happened_on": "2026-09-11"}')$$, 'P0001', 'a retired category takes no new achievement', 'achievement.category_retired');
select test.eq(api.achievement(current_setting('t.a')::uuid) ->> 'category', 'GOV-CONTRACT', 'its past ones keep it');
