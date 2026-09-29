-- SET-01 — a setting is read as of a date: the department's latest row dated on or before it, else the company-wide
-- one, else the definition's default; a row dated later does not count yet (§3.2, §5a).
-- Sabotage: supabase/tests/sabotage/settings-ignore-the-department.sql.
select test.page('settings.work');
insert into core.setting_def (key, group_page, schema, default_value, effective_dated, label_key)
values ('test.no_update_days', 'settings.work', '{"type": "integer"}', '7', true, 'setting.test.no_update_days');
insert into core.setting (key, department_id, value, valid_from, reason)
values ('test.no_update_days', null, '10', '2026-01-01', 'made up for a test'),
       ('test.no_update_days', test.department(), '5', '2026-06-01', 'made up for a test'),
       ('test.no_update_days', test.department(), '3', '2026-10-01', 'made up for a test');
select test.eq(core.setting_at('test.no_update_days', test.department(), '2026-09-15'), '5'::jsonb,
  'the department''s row in force on 15 Sep');
select test.eq(core.setting_at('test.no_update_days', test.department(), '2026-10-01'), '3'::jsonb,
  'the later row counts from its own date');
select test.eq(core.setting_at('test.no_update_days', test.department(), '2026-03-01'), '10'::jsonb,
  'before the department had a row, the company-wide one');
select test.eq(core.setting_at('test.no_update_days', test.department('other'), '2026-09-15'), '10'::jsonb,
  'another department reads the company-wide row');
select test.eq(core.setting_at('test.no_update_days', null, '2025-12-31'), '7'::jsonb, 'before any row, the default');
select test.raises($$select core.setting_at('work.nothing', null, '2026-01-01')$$, 'P0001', 'an unknown key',
  'setting.unknown_key');
