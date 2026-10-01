-- Sabotage: app-settings-without-the-start-page
-- Breaks: sql:SETS-03
-- Expect: until an admin sets one, the default start page is My day
-- The admin's default start page never reaches the root: the read leaves it out.
create or replace function core.app_settings() returns jsonb
language sql stable security definer set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'app.arabic_enabled', core.setting_at('app.arabic_enabled', null, core.riyadh_today()),
    'app.default_theme', core.setting_at('app.default_theme', null, core.riyadh_today()),
    'app.default_density', core.setting_at('app.default_density', null, core.riyadh_today()))
$$;
