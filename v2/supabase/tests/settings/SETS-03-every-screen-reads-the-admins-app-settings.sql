-- SETS-03 — every screen reads the admin's App settings (QA-207; V214, V182): the default theme, the default density,
-- the default start page and whether Arabic is on reach a signed-in person through api.app_settings(); the server reads
-- them before sign-in with its secret key; someone not signed in reaches nothing (M87). Made-up people.
-- Sabotages: supabase/tests/sabotage/app-settings-read-from-the-registry.sql,
-- app-settings-without-the-start-page.sql, app-settings-open-before-sign-in.sql.
select test.ok(exists (select 1 from core.setting_def where key = 'app.default_start_page' and active),
  'the registry has the default start page');

select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.mem', test.person('Test Member', 'member')::text, true);

select test.as_person(current_setting('t.mem')::uuid);
select test.eq(api.app_settings() ->> 'app.default_start_page', 'my_day',
  'until an admin sets one, the default start page is My day');

select test.as_person(current_setting('t.admin')::uuid);
select test.runs($$select api.setting_set('app.default_theme', null, '"dark"', null, 'made up: a darker default')$$,
  'an admin sets the default theme');
select test.runs($$select api.setting_set('app.default_density', null, '"compact"', null, 'made up: denser lists')$$,
  'an admin sets the default density');
select test.runs($$select api.setting_set('app.default_start_page', null, '"tasks"', null, 'made up: start on tasks')$$,
  'an admin sets the default start page');
select test.runs($$select api.setting_set('app.arabic_enabled', null, 'true', null, 'made up: Arabic tested')$$,
  'an admin switches Arabic on');
select test.raises($$select api.setting_set('app.default_start_page', null, '"nowhere"', null, 'made up')$$,
  'P0001', 'a start page that is not a page is refused', 'setting.invalid_value');

select test.as_person(current_setting('t.mem')::uuid);
select test.eq(api.app_settings() ->> 'app.default_theme', 'dark', 'a member reads the admin''s default theme');
select test.eq(api.app_settings() ->> 'app.default_density', 'compact', 'and the default density');
select test.eq(api.app_settings() ->> 'app.default_start_page', 'tasks', 'and the default start page');
select test.eq(api.app_settings() -> 'app.arabic_enabled', 'true'::jsonb, 'and that Arabic is on');

-- before sign-in: the server, with its secret key, reads whether Arabic is on for the sign-in page
select test.as_owner();
set local role service_role;
select test.eq(api.app_settings() -> 'app.arabic_enabled', 'true'::jsonb,
  'before sign-in, the server reads whether Arabic is on');
reset role;

-- someone not signed in reaches nothing (M87)
select test.as_anon();
select test.raises($$select api.app_settings()$$, '42501', 'someone not signed in reaches nothing');
select test.as_owner();
