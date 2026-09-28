-- Sabotage: days-cut-at-utc-midnight
-- Breaks: sql:CORE-01
-- Expect: midnight in Riyadh is 21:00 UTC
-- The day of an instant is cut at UTC midnight instead of Riyadh's (D20).
create or replace function core.riyadh_day(t timestamptz) returns date
language sql immutable parallel safe set search_path = ''
as $$ select (t at time zone 'UTC')::date $$;
