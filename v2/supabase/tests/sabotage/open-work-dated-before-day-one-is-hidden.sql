-- Sabotage: open-work-dated-before-day-one-is-hidden
-- Breaks: sql:PAST-03
-- Expect: an open task with an owner is live work, whatever its date
-- The rule before D: everything dated before day one is past work, open or not.
create or replace function work.task_is_past(t work.task) returns boolean
language sql stable security definer set search_path = ''
as $$ select t.origin = 'backfill' or work.is_past(t.happened_on) $$;
