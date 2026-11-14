-- TGT-03 — a target set on a parent category counts its sub-categories' achievements too (C-perf, 13 Nov), as the
-- Achievements list's category filter reads a parent; a target on the sub-category counts only its own. Drafts still
-- never count (V68). Every value is made up.
select set_config('v2.test_now', '2026-11-01 09:00:00+03', true);
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.mgr', test.person('Test Manager', 'manager')::text, true);
select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.p26', api.plan_open(test.department('commercial'), 2026) ->> 'id', true);
select set_config('t.contract', (select x ->> 'id' from jsonb_array_elements(
  api.achievement_categories(current_setting('t.p26')::uuid)) x where x ->> 'code' = 'CONTRACT'), true);
select set_config('t.sub', api.achievement_category_save(null, current_setting('t.p26')::uuid,
  jsonb_build_object('code', 'CONTRACT_GOV', 'name_en', 'Made-up government contract', 'name_ar', 'عقد حكومي تجريبي',
                     'parent', 'CONTRACT', 'has_deal_value', true)) ->> 'id', true);
select set_config('t.tp', api.target_save(null, current_setting('t.p26')::uuid,
  jsonb_build_object('category', current_setting('t.contract'), 'month', '2026-09-01', 'target_count', 3,
                     'target_value', 5000.00)) ->> 'id', true);
select set_config('t.ts', api.target_save(null, current_setting('t.p26')::uuid,
  jsonb_build_object('category', current_setting('t.sub'), 'month', '2026-09-01', 'target_count', 1)) ->> 'id', true);

select test.as_person(current_setting('t.mgr')::uuid);
select api.achievement_log('{"category": "CONTRACT", "title": "Made-up parent deal", "happened_on": "2026-09-05",
  "deal_value": 1000}', '[{"system": "ticket", "value": "MADE-UP-TGT3-1"}]');
select api.achievement_log('{"category": "CONTRACT_GOV", "title": "Made-up sub deal", "happened_on": "2026-09-12",
  "deal_value": 250.50}', '[{"system": "ticket", "value": "MADE-UP-TGT3-2"}]');
-- a draft (no date) and another month's never count
select api.achievement_log('{"category": "CONTRACT_GOV", "title": "Made-up undated deal"}',
  '[{"system": "ticket", "value": "MADE-UP-TGT3-3"}]');
select api.achievement_log('{"category": "CONTRACT_GOV", "title": "Made-up October deal", "happened_on": "2026-10-02"}',
  '[{"system": "ticket", "value": "MADE-UP-TGT3-4"}]');

select test.as_person(current_setting('t.admin')::uuid);
select test.eq((select x ->> 'achieved_count' from jsonb_array_elements(api.targets(current_setting('t.p26')::uuid)) x
                where x ->> 'id' = current_setting('t.tp')), '2', 'the parent''s target counts its own and its sub-category''s');
select test.eq((select (x ->> 'achieved_value')::numeric from jsonb_array_elements(api.targets(current_setting('t.p26')::uuid)) x
                where x ->> 'id' = current_setting('t.tp')), 1250.50::numeric, 'and sums both deal values');
select test.eq((select x ->> 'achieved_count' from jsonb_array_elements(api.targets(current_setting('t.p26')::uuid)) x
                where x ->> 'id' = current_setting('t.ts')), '1', 'the sub-category''s target counts only its own');
