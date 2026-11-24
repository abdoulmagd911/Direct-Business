-- Sabotage: a-monthly-invoice-is-removed-by-hand
-- Breaks: sql:DPN-01
-- Expect: nor removed by hand
-- The hand-removal door takes a monthly (billing) invoice like any other row.
create or replace function finance.rows_remove(p_table text, p_ids uuid[], p_reason text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform authz.require('finance', 'full');
  if false then
    raise exception using errcode = 'P0001', message = 'finance.edit_at_transaction_level',
      detail = (select i.ref from finance.invoice i where i.id = any (p_ids) and i.kind = 'billing' limit 1);
  end if;
  return finance.rows_remove_core(p_table, p_ids, p_reason);
end
$$;
