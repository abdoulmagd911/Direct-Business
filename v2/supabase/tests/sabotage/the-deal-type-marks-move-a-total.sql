-- Sabotage: the-deal-type-marks-move-a-total
-- Breaks: sql:DTY-01
-- Expect: every total is the kept statement
-- Adding the marks changes a figure: the Ledger revenue gains one riyal.
create or replace function finance.unified_ledger(p_from date, p_to date, p_partner uuid default null, p_client_id text default null,
  p_kind text default null, p_code text default null, p_project text default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  answer jsonb;
begin
  perform authz.require('finance', 'view');
  answer := finance.unified_ledger_core(p_from, p_to, p_partner, p_client_id, p_kind, p_code, p_project);
  answer := answer || finance.ledger_marks(answer);
  return answer || pg_catalog.jsonb_build_object('totals', (answer -> 'totals')
    || pg_catalog.jsonb_build_object('revenue', (answer -> 'totals' ->> 'revenue')::numeric + 1));
end
$$;
