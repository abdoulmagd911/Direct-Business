-- Sabotage: a-held-row-is-dropped-from-the-ledger
-- Breaks: sql:HLD-01
-- Expect: the held rows are all in the Ledger and counted
-- A row with no organisation is dropped from the Ledger rows instead of being held in view.
create or replace function finance.unified_ledger(p_from date, p_to date, p_partner uuid default null, p_client_id text default null,
  p_kind text default null, p_code text default null, p_project text default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  answer jsonb;
begin
  perform authz.require('finance', 'view');
  answer := finance.unified_ledger_core(p_from, p_to, p_partner, p_client_id, p_kind, p_code, p_project);
  answer := answer || finance.ledger_marks(answer);
  return answer || pg_catalog.jsonb_build_object('rows', coalesce((select pg_catalog.jsonb_agg(r)
    from pg_catalog.jsonb_array_elements(answer -> 'rows') r where (r ->> 'partner_id') is not null), '[]'::jsonb));
end
$$;
