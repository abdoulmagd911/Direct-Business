-- Sabotage: app-settings-open-before-sign-in
-- Breaks: sql:SETS-03
-- Expect: someone not signed in reaches nothing
-- The read is opened to anon, so anyone on the internet reaches v2 before signing in (against M87).
grant usage on schema api, core to anon;
grant execute on function core.app_settings(), api.app_settings() to anon;
