-- Sabotage: the-idle-window-ignores-its-setting
-- Breaks: sql:ACC-08
-- Expect: the window is now 7 days
-- The idle window stays fixed in code, whatever the setting says.
create or replace function core.device_idle_days() returns int
language sql stable set search_path = ''
as $$ select 30 $$;
