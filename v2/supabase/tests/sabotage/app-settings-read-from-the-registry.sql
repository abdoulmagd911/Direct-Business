-- Sabotage: app-settings-read-from-the-registry
-- Breaks: sql:SETS-03
-- Expect: a member reads the admin's default theme
-- The screens are answered the registry's defaults, never what the admin saved (QA-207 as it was found).
create or replace function core.app_settings() returns jsonb
language sql stable security definer set search_path = ''
as $$
  select pg_catalog.jsonb_object_agg(d.key, d.default_value) from core.setting_def d
  where d.key in ('app.arabic_enabled', 'app.default_theme', 'app.default_density', 'app.default_start_page')
$$;
