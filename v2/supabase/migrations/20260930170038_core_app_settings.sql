-- QA-207 (QA round 22; V214, V182): the admin's App settings reach the screens. The theme and density a person without
-- their own gets, the start page, and whether Arabic is on were saved in Settings → App but read by nothing:
-- core/settings/app.ts asks api.app_settings(), which did not exist, and fell back to the registry's defaults.
--
-- One read of the four app-wide keys, as they stand today (Riyadh): the same for everyone, naming no one and no record.
-- A signed-in person may call it, and so may the app's own server — which reads it for the sign-in page, before anyone
-- has signed in, with its secret key. Nobody who is not signed in reaches it: anon reaches nothing in v2 (M87,
-- GRANTS-03). Forward-only (V103).
create function core.app_settings() returns jsonb
language sql stable security definer set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'app.arabic_enabled', core.setting_at('app.arabic_enabled', null, core.riyadh_today()),
    'app.default_theme', core.setting_at('app.default_theme', null, core.riyadh_today()),
    'app.default_density', core.setting_at('app.default_density', null, core.riyadh_today()),
    'app.default_start_page', core.setting_at('app.default_start_page', null, core.riyadh_today()))
$$;
comment on function core.app_settings() is
  'The four app-wide settings every screen needs (V214, V182): Arabic on, the default theme, density and start page.';

create function api.app_settings() returns jsonb
language sql stable security invoker set search_path = '' as $$ select core.app_settings() $$;
comment on function api.app_settings() is
  'The four app-wide settings (V182): a signed-in person, or the server before sign-in (its secret key). Not anon.';

revoke all on function core.app_settings(), api.app_settings() from public;
grant execute on function core.app_settings(), api.app_settings() to authenticated, service_role;
