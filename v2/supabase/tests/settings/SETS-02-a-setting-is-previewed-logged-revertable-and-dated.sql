-- SETS-02 — settings are safe to change (V97): a preview shows the value before and after on its day and changes
-- nothing; every change made on a Settings page is in the settings log, kept, and an admin reverts it with Undo; the
-- Work settings that change numbers take an effective date (V126); every setting answers from the floor date
-- (2000-01-01) — the seeded default is a row of its own there, never over an admin's (the sync writes one only where
-- none exists, V123) — and the log and the preview are an admin's. Made up.
-- Sabotage: supabase/tests/sabotage/a-preview-that-saves.sql.
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.head', test.person('Test Head', 'head')::text, true);

select set_config('t.n0', (select count(*)::text from audit.request), true);
select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.pv', api.setting_preview('audit.undo_window_hours', null, '48')::text, true);
select test.as_owner();
select test.eq((current_setting('t.pv')::jsonb -> 'value_before')::int, 24, 'the preview shows the value before');
select test.eq((current_setting('t.pv')::jsonb -> 'value_after')::int, 48, 'and after');
select test.eq(core.setting_at('audit.undo_window_hours', null, core.riyadh_today()), '24'::jsonb,
  'the preview changes nothing');
select test.eq((select count(*)::text from audit.request), current_setting('t.n0'), 'and logs nothing');

select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.r', api.setting_set('files.max_mb', null, '30', null, 'made up: bigger files') ->> 'request_id', true);
select test.ok(exists (select 1 from jsonb_array_elements(api.settings_log()) x
                       where x ->> 'request_id' = current_setting('t.r') and x -> 'changes' -> 0 ->> 'entity' = 'setting'),
  'the change is in the settings log');
select test.as_owner();
select test.eq(core.setting_at('files.max_mb', null, core.riyadh_today()), '30'::jsonb, 'the change is in force today');
select test.as_person(current_setting('t.admin')::uuid);
select api.undo(current_setting('t.r')::uuid);
select test.as_owner();
select test.eq(core.setting_at('files.max_mb', null, core.riyadh_today()), '20'::jsonb, 'an admin reverts it with Undo');
select test.eq(core.setting_at('files.max_mb', null, date '2010-06-01'), '20'::jsonb,
  'every setting answers from the floor date');

select test.as_person(current_setting('t.admin')::uuid);
select api.setting_set('work.no_update_days', null, '10', core.riyadh_today() + 7, 'made up: from next week');
select test.as_owner();
select test.eq(core.setting_at('work.no_update_days', null, core.riyadh_today()), '7'::jsonb,
  'a Work setting that changes numbers waits for its effective date');
select test.eq(core.setting_at('work.no_update_days', null, core.riyadh_today() + 7), '10'::jsonb, 'and applies from it');

select test.as_person(current_setting('t.head')::uuid);
select test.raises('select api.settings_log()', '42501', 'the settings log is an admin''s', 'access.needs_admin');
select test.raises($$select api.setting_preview('files.max_mb', null, '30')$$, '42501', 'so is a preview',
  'access.needs_level');
