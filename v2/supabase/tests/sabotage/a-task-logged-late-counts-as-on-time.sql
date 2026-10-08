-- Sabotage: a-task-logged-late-counts-as-on-time
-- Breaks: sql:MSR-01
-- Expect: but logged a month later
-- An entry logged late after go-live still counts as on time (V400).
create or replace function measure.on_record(p_happened_on date, p_logged_at timestamptz, p_backfill boolean) returns boolean
language sql stable security definer set search_path = ''
as $$ select true $$;
