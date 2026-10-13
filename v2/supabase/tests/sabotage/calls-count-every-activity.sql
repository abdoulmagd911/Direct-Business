-- Sabotage: calls-count-every-activity
-- Breaks: sql:CALL-01
-- Expect: am1's calls this week
-- Every activity counts as a call: demos and meetings too.
create or replace function measure.partner_calls_items(p_params jsonb, p_scope_kind text, p_scope_id uuid, p_from date, p_to date)
  returns setof measure.item
language sql stable security definer set search_path = ''
as $$
  select * from measure.activities(p_scope_kind, p_scope_id, p_from, p_to, null,
    (select pg_catalog.array_agg(x) from pg_catalog.jsonb_array_elements_text(p_params -> 'outcomes') x), false)
$$;
