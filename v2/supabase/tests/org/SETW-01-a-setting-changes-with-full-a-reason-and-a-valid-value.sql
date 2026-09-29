-- SETW-01 — changing a setting (§3.2, V131): View on the group's page reads it, Full changes it, with a reason and a
-- value its schema accepts; a setting without an effective date applies from today, one with a date takes it; a second
-- change the same day replaces the first (one live row, one Undo brings it back); a department's own value, and back to
-- the company's.
-- Sabotage: supabase/tests/sabotage/view-changes-a-setting.sql.
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.dep', test.department('settings_one')::text, true);

select test.as_person(current_setting('t.head')::uuid);
select test.eq((api.settings('settings.app') ->> 'can_edit')::boolean, false, 'a head, with View on App, reads it');
select test.ok(exists (select 1 from jsonb_array_elements(api.settings('settings.app') -> 'settings') s
                       where s ->> 'key' = 'audit.undo_window_hours' and (s -> 'value')::int = 24),
  'with each setting''s value today');
select test.raises($$select api.setting_set('audit.undo_window_hours', null, '48', null, 'made up')$$, '42501',
  'a head with View on App cannot change its settings', 'access.needs_level');
select test.as_person(current_setting('t.am1')::uuid);
select test.raises($$select api.settings('settings.app')$$, '42501', 'a member without App sees none of it',
  'access.needs_level');

select test.as_person(current_setting('t.admin')::uuid);
select test.raises($$select api.setting_set('audit.undo_window_hours', null, '48', null, null)$$, 'P0001',
  'a change needs a reason', 'common.reason_required');
select test.raises($$select api.setting_set('audit.undo_window_hours', null, '"48"', null, 'made up')$$, 'P0001',
  'a value its schema refuses is refused', 'setting.invalid_value');
select test.raises($$select api.setting_set('no.such_setting', null, '1', null, 'made up')$$, 'P0002',
  'an unknown setting', 'setting.unknown_key');
select test.raises(format('select api.setting_set(%L, null, %L, %L, %L)', 'audit.undo_window_hours', '48',
  (core.riyadh_today() + 3)::text, 'made up'), 'P0001', 'a setting without an effective date applies from today',
  'setting.not_effective_dated');
select set_config('t.r1', api.setting_set('audit.undo_window_hours', null, '48', null, 'made up: longer') ->> 'request_id',
  true);
select set_config('t.r2', api.setting_set('audit.undo_window_hours', null, '36', null, 'made up: shorter') ->> 'request_id',
  true);
select test.as_owner();
select test.eq(core.setting_at('audit.undo_window_hours', null, core.riyadh_today()), '36'::jsonb,
  'a second change the same day replaces the first');
select test.eq((select count(*)::int from core.setting where key = 'audit.undo_window_hours'
                and valid_from = core.riyadh_today() and deleted_at is null), 1, 'one live row for the day');
select test.as_person(current_setting('t.admin')::uuid);
select api.undo(current_setting('t.r2')::uuid);
select test.as_owner();
select test.eq(core.setting_at('audit.undo_window_hours', null, core.riyadh_today()), '48'::jsonb,
  'one Undo brings the replaced value back');

-- an effective-dated setting, and a department's own value
select test.as_person(current_setting('t.admin')::uuid);
select api.setting_set('work.pipeline_weekly_target', null, '3', (core.riyadh_today() + 10), 'made up: from next week');
select test.as_owner();
select test.eq(core.setting_at('work.pipeline_weekly_target', null, core.riyadh_today()), '1'::jsonb,
  'a dated change waits for its date');
select test.eq(core.setting_at('work.pipeline_weekly_target', null, core.riyadh_today() + 10), '3'::jsonb,
  'and applies from it');
select test.as_person(current_setting('t.admin')::uuid);
select api.setting_set('files.max_mb', current_setting('t.dep')::uuid, '5', null, 'made up: this department');
select test.as_owner();
select test.eq(core.setting_at('files.max_mb', current_setting('t.dep')::uuid, core.riyadh_today()), '5'::jsonb,
  'a department has its own value');
select test.eq(core.setting_at('files.max_mb', null, core.riyadh_today()), '20'::jsonb, 'the company keeps its own');
select test.as_person(current_setting('t.admin')::uuid);
select test.raises($$select api.setting_clear('files.max_mb', null, 'made up')$$, 'P0001',
  'the company-wide value is changed, never cleared', 'setting.company_value_stays');
select api.setting_clear('files.max_mb', current_setting('t.dep')::uuid, 'made up: follow the company');
select test.as_owner();
select test.eq(core.setting_at('files.max_mb', current_setting('t.dep')::uuid, core.riyadh_today()), '20'::jsonb,
  'cleared, the department follows the company again');
