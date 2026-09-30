-- SETS-02 — settings are safe to change (V97): a preview shows the value before and after on its day and changes
-- nothing; every change made on a Settings page is in the settings log, kept, and an admin reverts it with Undo; the
-- Work settings that change numbers take an effective date (V126); every setting answers from the floor date
-- (2000-01-01) — the seeded default is a row of its own there, never over an admin's (the sync writes one only where
-- none exists, V123; a changed default only where no admin value is in force, V155) — and the log and the preview are
-- an admin's. Made up.
-- Sabotages: supabase/tests/sabotage/a-preview-that-saves.sql,
--            supabase/tests/sabotage/a-default-over-an-admins-value.sql,
--            supabase/tests/sabotage/a-setting-without-its-floor-row.sql.
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
update core.setting_def set default_value = '99' where key = 'files.max_mb';
select test.eq(core.setting_at('files.max_mb', null, date '2010-06-01'), '20'::jsonb,
  'every setting answers from its own row at the floor date, not from its definition');
select test.eq((select count(*)::int from core.setting where key = 'files.max_mb' and department_id is null
                and reason = 'default' and valid_from = date '2000-01-01' and deleted_at is null), 1, 'which is there, once');

select test.as_person(current_setting('t.admin')::uuid);
select api.setting_set('work.no_update_days', null, '10', core.riyadh_today() + 7, 'made up: from next week');
select test.as_owner();
select test.eq(core.setting_at('work.no_update_days', null, core.riyadh_today()), '7'::jsonb,
  'a Work setting that changes numbers waits for its effective date');
select test.eq(core.setting_at('work.no_update_days', null, core.riyadh_today() + 7), '10'::jsonb, 'and applies from it');

-- the registry's defaults never overwrite an admin's value (V123, V155, V161): a changed default lands only where no
-- admin value is in force, from today, the past kept
select set_config('t.nd', (select count(*)::text from core.setting where key = 'work.no_update_days' and reason = 'default'
                            and deleted_at is null), true);
select core.setting_defaults_sync('[{"key": "work.no_update_days", "value": 9}, {"key": "work.late_days", "value": 21}]');
select test.eq(core.setting_at('work.no_update_days', null, core.riyadh_today() + 7), '10'::jsonb,
  'a changed default never overwrites an admin''s value');
select test.eq((select count(*)::int from core.setting where key = 'work.no_update_days' and reason = 'default'
                and deleted_at is null), current_setting('t.nd')::int, 'nor adds a default under it');
select test.eq(core.setting_at('work.late_days', null, core.riyadh_today()), '21'::jsonb,
  'where no admin value is in force, the new default answers from today');
select test.eq(core.setting_at('work.late_days', null, core.riyadh_today() - 1), '14'::jsonb, 'and the past keeps the old one');
-- ten days on, a value an admin set a week ago is the one in force: a changed default lands under it, never over it
select set_config('v2.test_now', (now() + interval '10 days')::text, true);
insert into core.setting (key, department_id, value, valid_from, reason)
values ('partner.stale_after_days', null, '30', core.riyadh_today() - 7, 'made up: an admin''s value');
select core.setting_defaults_sync('[{"key": "partner.stale_after_days", "value": 25}]');
select test.eq(core.setting_at('partner.stale_after_days', null, core.riyadh_today()), '30'::jsonb,
  'a changed default never overwrites the value an admin set before it');
select set_config('v2.test_now', '', true);

select test.as_person(current_setting('t.head')::uuid);
select test.raises('select api.settings_log()', '42501', 'the settings log is an admin''s', 'access.needs_admin');
select test.raises($$select api.setting_preview('files.max_mb', null, '30')$$, '42501', 'so is a preview',
  'access.needs_level');
