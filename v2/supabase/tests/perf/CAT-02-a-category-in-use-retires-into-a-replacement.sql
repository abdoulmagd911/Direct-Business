-- CAT-02 — a category in use retires into a replacement (FIX-23, the list-editor "retire with replacement"
-- control): its live achievements move to a same-plan active category, in one change with one Undo, and the
-- category is archived. A reason is required; the replacement must be a live category of the same plan, never the
-- category itself or one of its sub-categories; a category with live sub-categories is refused, its tree is never
-- rewritten by a retire; and a deal value stays where values are typed, so a replacement that carries none is
-- refused. Only admins retire. Every value is made up.
select set_config('v2.test_now', '2026-10-01 09:00:00+03', true);
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.mgr', test.person('Test Manager', 'manager')::text, true);
select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.p26', api.plan_open(test.department('commercial'), 2026) ->> 'id', true);
select set_config('t.problem', (select x ->> 'id' from jsonb_array_elements(
  api.achievement_categories(current_setting('t.p26')::uuid)) x where x ->> 'code' = 'PROBLEM'), true);
select set_config('t.cost', (select x ->> 'id' from jsonb_array_elements(
  api.achievement_categories(current_setting('t.p26')::uuid)) x where x ->> 'code' = 'COST'), true);
select set_config('t.contract', (select x ->> 'id' from jsonb_array_elements(
  api.achievement_categories(current_setting('t.p26')::uuid)) x where x ->> 'code' = 'CONTRACT'), true);
select set_config('t.mou', (select x ->> 'id' from jsonb_array_elements(
  api.achievement_categories(current_setting('t.p26')::uuid)) x where x ->> 'code' = 'MOU'), true);
select set_config('t.gov', api.achievement_category_save(null, current_setting('t.p26')::uuid,
  '{"code": "GOV-CONTRACT", "name_en": "Government contract", "name_ar": "عقد حكومي", "parent": "CONTRACT",
    "has_deal_value": true}') ->> 'id', true);

select test.as_person(current_setting('t.mgr')::uuid);
select test.raises(format('select api.achievement_category_retire(%L, %L, %L)', current_setting('t.problem'),
  current_setting('t.cost'), 'Made-up reason'), '42501', 'only an admin retires', 'access.needs_level');

select test.as_person(current_setting('t.admin')::uuid);
select test.raises(format('select api.achievement_category_retire(%L, %L, %L)', current_setting('t.problem'),
  current_setting('t.cost'), ''), 'P0001', 'a reason is required', 'common.reason_required');
select test.raises(format('select api.achievement_category_retire(%L, %L, %L)', current_setting('t.problem'),
  current_setting('t.problem'), 'Made-up reason'), 'P0001', 'never into itself', 'list.replacement_invalid');
select test.raises(format('select api.achievement_category_retire(%L, %L, %L)', current_setting('t.contract'),
  current_setting('t.gov'), 'Made-up reason'), 'P0001', 'never into one of its own sub-categories',
  'list.replacement_invalid');
select test.raises(format('select api.achievement_category_retire(%L, %L, %L)', current_setting('t.contract'),
  current_setting('t.mou'), 'Made-up reason'), 'P0001', 'a category with live sub-categories is refused',
  'list.in_use');
select test.runs(format('select api.achievement_categories_remove(array[%L]::uuid[])', current_setting('t.gov')),
  'its unused sub-category is removed first');
select test.eq(api.achievement_category_retire(current_setting('t.problem')::uuid,
  current_setting('t.cost')::uuid, 'Made-up reason') ->> 'moved', '0', 'an unused category retires with none moved');
select test.eq((select x ->> 'active' from jsonb_array_elements(api.achievement_categories(current_setting('t.p26')::uuid)) x
                where x ->> 'code' = 'PROBLEM'), 'false', 'and is archived');

select test.as_person(current_setting('t.mgr')::uuid);
select set_config('t.a', api.achievement_log('{"category": "CONTRACT", "title": "Made-up contract",
  "happened_on": "2026-09-05", "deal_value": 5000}') ->> 'id', true);
select test.as_person(current_setting('t.admin')::uuid);
select test.raises(format('select api.achievement_category_retire(%L, %L, %L)', current_setting('t.contract'),
  current_setting('t.cost'), 'Made-up reason'), 'P0001',
  'a deal value stays where values are typed', 'achievement_category.deal_values_held');
select test.eq(api.achievement_category_retire(current_setting('t.contract')::uuid,
  current_setting('t.mou')::uuid, 'Made-up reason') ->> 'moved', '1',
  'its achievement moves to the replacement');
select test.eq(api.achievement(current_setting('t.a')::uuid) ->> 'category', 'MOU', 'and names it there');
select test.eq((select x ->> 'active' from jsonb_array_elements(api.achievement_categories(current_setting('t.p26')::uuid)) x
                where x ->> 'code' = 'CONTRACT'), 'false', 'and the category is archived');
select test.eq((api.achievements(jsonb_build_object('category', 'MOU')) ->> 'total')::int, 1,
  'and is found under its new category');
