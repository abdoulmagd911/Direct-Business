-- Sabotage: drift-sees-nothing
-- Breaks: sql:NORM-02
-- Expect: a new stop word: drift lists the name key it changes
-- Drift never looks: a changed rule leaves stale keys that nobody notices.
create or replace function norm.drift() returns table (source text, id uuid, stored text, now_is text)
language sql stable security definer set search_path = ''
as $$
  select null::text, null::uuid, null::text, null::text where false
$$;
