-- SET-02 — a setting row never changes in place: a new value is a new dated row; only removing a row (for Undo) is an
-- update (§3.2).
-- Sabotage: supabase/tests/sabotage/settings-change-in-place.sql.
select test.page('settings.app');
insert into core.setting_def (key, group_page, schema, default_value, label_key)
values ('app.default_theme', 'settings.app', '{"enum": ["light", "dark", "colorful", "direct"]}', '"direct"', 'setting.app.default_theme');
insert into core.setting (key, value, valid_from, reason) values ('app.default_theme', '"light"', '2026-10-01', 'made up for a test');
select test.raises($$update core.setting set value = '"dark"' where key = 'app.default_theme'$$, 'P0001',
  'the value cannot be rewritten', 'setting.rows_never_change');
select test.raises($$update core.setting set valid_from = '2026-09-01' where key = 'app.default_theme'$$, 'P0001',
  'the date cannot be rewritten', 'setting.rows_never_change');
update core.setting set deleted_at = now(), delete_reason = 'made up for a test' where key = 'app.default_theme';
select test.eq(core.setting_at('app.default_theme', null, '2026-12-01'), '"direct"'::jsonb,
  'a removed row no longer counts: the default is back');
