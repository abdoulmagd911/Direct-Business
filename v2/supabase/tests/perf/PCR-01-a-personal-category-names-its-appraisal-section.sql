-- PCR-01 — personal credit (V625 (3), (6)): every category starts as a department one with no appraisal section; a
-- personal category must name the appraisal section it feeds, and a department one may not; a section code has the
-- template's shape. An admin sets it through the category's own door, logged, and Undo takes it back; the next year's plan copies
-- it personal, with its section. Every value is made up.
-- Sabotage: supabase/tests/sabotage/a-personal-category-without-a-section.sql.
select set_config('v2.test_now', '2026-10-01 09:00:00+03', true);
select set_config('t.adm', test.person('Test Admin', 'admin')::text, true);
select test.as_person(current_setting('t.adm')::uuid);
select set_config('t.p26', api.plan_open(test.department('commercial'), 2026) ->> 'id', true);
select test.as_owner();
select set_config('t.c', (select id from perf.achievement_category
                          where plan_id = current_setting('t.p26')::uuid and code = 'PROBLEM')::text, true);
select set_config('t.v', (select version from perf.achievement_category where id = current_setting('t.c')::uuid)::text, true);

select test.eq((select count(*)::int from perf.achievement_category where scope <> 'department' or appraisal_section_code is not null),
  0, 'every category starts as a department one with no appraisal section');

select test.as_person(current_setting('t.adm')::uuid);
select test.raises(format('select api.achievement_category_save(%L, null, %L, %s)', current_setting('t.c'),
                          '{"scope": "personal"}', current_setting('t.v')),
  'P0001', 'a personal category without its appraisal section is refused', 'achievement_category.invalid');
select test.raises(format('select api.achievement_category_save(%L, null, %L, %s)', current_setting('t.c'),
                          '{"appraisal_section_code": "SEC-LEARNING"}', current_setting('t.v')),
  'P0001', 'a department category names no appraisal section', 'achievement_category.invalid');
select test.raises(format('select api.achievement_category_save(%L, null, %L, %s)', current_setting('t.c'),
                          '{"scope": "personal", "appraisal_section_code": "made up section"}', current_setting('t.v')),
  'P0001', 'a section code keeps the template''s shape', 'achievement_category.invalid');

select set_config('t.r', api.achievement_category_save(current_setting('t.c')::uuid, null,
  '{"scope": "personal", "appraisal_section_code": "SEC-LEARNING"}', current_setting('t.v')::int)::text, true);
select test.as_owner();
select test.eq((select jsonb_build_object('scope', scope, 'section', appraisal_section_code)
                from perf.achievement_category where id = current_setting('t.c')::uuid),
  '{"scope": "personal", "section": "SEC-LEARNING"}'::jsonb, 'an admin makes a category personal, naming its section');
select test.as_person(current_setting('t.adm')::uuid);
select test.eq((select x ->> 'scope' || ' ' || (x ->> 'appraisal_section_code') from jsonb_array_elements(
  api.achievement_categories(current_setting('t.p26')::uuid)) x where x ->> 'code' = 'PROBLEM'), 'personal SEC-LEARNING',
  'the category list shows it');

select test.as_person(current_setting('t.adm')::uuid);
select set_config('t.p27', api.plan_open(test.department('commercial'), 2027) ->> 'id', true);
select test.as_owner();
select test.eq((select jsonb_build_object('scope', scope, 'section', appraisal_section_code)
                from perf.achievement_category where plan_id = current_setting('t.p27')::uuid and code = 'PROBLEM'),
  '{"scope": "personal", "section": "SEC-LEARNING"}'::jsonb, 'the next year''s plan copies it personal, with its section');

select test.as_person(current_setting('t.adm')::uuid);
select api.undo((current_setting('t.r')::jsonb ->> 'request_id')::uuid);
select test.as_owner();
select test.eq((select scope from perf.achievement_category where id = current_setting('t.c')::uuid), 'department',
  'and Undo takes it back');
