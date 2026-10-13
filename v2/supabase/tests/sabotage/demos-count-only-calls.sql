-- Sabotage: demos-count-only-calls
-- Breaks: sql:CALL-01
-- Expect: am1's demos
-- A demo held is not counted — only calls setting one (V88).
create or replace function measure.partner_demos_items(p_params jsonb, p_scope_kind text, p_scope_id uuid, p_from date, p_to date)
  returns setof measure.item
language sql stable security definer set search_path = ''
as $$ select * from measure.activities(p_scope_kind, p_scope_id, p_from, p_to, 'call', null, true) $$;
