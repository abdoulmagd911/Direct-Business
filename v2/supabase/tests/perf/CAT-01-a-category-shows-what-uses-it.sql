-- CAT-01 — a category shows what uses it (FIX-23, the list-editor "usage / used-in" control): the count of live
-- records on the category — its achievements and its sub-categories — and where they are. Only admins read it; a
-- missing category reads as not found. Every value is made up.
select set_config('v2.test_now', '2026-10-01 09:00:00+03', true);
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.mgr', test.person('Test Manager', 'manager')::text, true);
select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.p26', api.plan_open(test.department('commercial'), 2026) ->> 'id', true);
select set_config('t.problem', (select x ->> 'id' from jsonb_array_elements(
  api.achievement_categories(current_setting('t.p26')::uuid)) x where x ->> 'code' = 'PROBLEM'), true);
select set_config('t.contract', (select x ->> 'id' from jsonb_array_elements(
  api.achievement_categories(current_setting('t.p26')::uuid)) x where x ->> 'code' = 'CONTRACT'), true);

select test.eq(api.achievement_category_usage(current_setting('t.problem')::uuid) ->> 'total', '0',
  'an unused category is used nowhere');
select test.eq(api.achievement_category_usage(current_setting('t.problem')::uuid) ->> 'uses', '[]',
  'and names nowhere');

select test.as_person(current_setting('t.mgr')::uuid);
select api.achievement_log('{"category": "PROBLEM", "title": "Made-up fix one", "happened_on": "2026-09-10"}');
select api.achievement_log('{"category": "PROBLEM", "title": "Made-up fix two", "happened_on": "2026-09-11"}');
select test.raises(format('select api.achievement_category_usage(%L)', current_setting('t.problem')),
  '42501', 'only an admin reads usage', 'access.needs_level');

select test.as_person(current_setting('t.admin')::uuid);
select test.eq(api.achievement_category_usage(current_setting('t.problem')::uuid) ->> 'total', '2',
  'two achievements use it');
select test.eq((select x ->> 'count' from jsonb_array_elements(
  api.achievement_category_usage(current_setting('t.problem')::uuid) -> 'uses') x
  where x ->> 'table' = 'perf.achievement' and x ->> 'column' = 'category_id'), '2',
  'counted where they are');
select api.achievement_category_save(null, current_setting('t.p26')::uuid,
  '{"code": "GOV-CONTRACT", "name_en": "Government contract", "name_ar": "عقد حكومي", "parent": "CONTRACT",
    "has_deal_value": true}');
select test.eq(api.achievement_category_usage(current_setting('t.contract')::uuid) ->> 'total', '1',
  'a sub-category counts as a use of its parent');
select test.eq((select x ->> 'count' from jsonb_array_elements(
  api.achievement_category_usage(current_setting('t.contract')::uuid) -> 'uses') x
  where x ->> 'table' = 'perf.achievement_category' and x ->> 'column' = 'parent_id'), '1',
  'counted where it is');
select test.raises('select api.achievement_category_usage(''00000000-0000-0000-0000-000000000000'')',
  'P0002', 'a missing category reads as not found', 'common.not_found');
