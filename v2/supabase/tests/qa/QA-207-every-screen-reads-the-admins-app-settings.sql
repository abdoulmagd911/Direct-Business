-- QA-207 — Every screen reads the admin's App settings (V214; ACC-090/091, ACC-129/139): the default theme, the default
-- density, the default start page and whether Arabic is on reach the screens through api.app_settings(), builder A's
-- public read of those keys — callable by every signed-in person and, for app.arabic_enabled, before sign-in. On
-- v2/main at 0755dbf (and on #127 at 4fa2265) it does not exist, so core/settings/app.ts falls back to the registry's
-- defaults: an admin's change to any of the four never reaches a screen, and the browser tests that need it skip by name.
-- The registry has no app.default_start_page key either. Written by the QA auditor to fail until built. Made-up people.
select test.ok(to_regprocedure('api.app_settings()') is not null, 'api.app_settings() exists');
select test.ok(exists (select 1 from core.setting_def where key = 'app.default_start_page' and active),
  'the registry has the default start page the screens read');

select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.mem', test.person('Test Member', 'member')::text, true);

select test.as_person(current_setting('t.admin')::uuid);
select test.runs($$select api.setting_set('app.default_theme', null, '"dark"', null, 'made up: a darker default')$$,
  'an admin sets the default theme');
select test.runs($$select api.setting_set('app.default_density', null, '"compact"', null, 'made up: denser lists')$$,
  'an admin sets the default density');
select test.runs($$select api.setting_set('app.arabic_enabled', null, 'true', null, 'made up: Arabic tested')$$,
  'an admin switches Arabic on');

select test.as_person(current_setting('t.mem')::uuid);
select test.eq(api.app_settings() ->> 'app.default_theme', 'dark', 'a member reads the admin''s default theme');
select test.eq(api.app_settings() ->> 'app.default_density', 'compact', 'and the default density');
select test.eq(api.app_settings() -> 'app.arabic_enabled', 'true'::jsonb, 'and that Arabic is on');
select test.ok(api.app_settings() ? 'app.default_start_page', 'and the default start page (null until an admin sets it)');

select test.as_anon();
select test.eq(api.app_settings() -> 'app.arabic_enabled', 'true'::jsonb,
  'before sign-in, the door reads whether Arabic is on');
