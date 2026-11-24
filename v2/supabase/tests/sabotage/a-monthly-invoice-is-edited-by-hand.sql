-- Sabotage: a-monthly-invoice-is-edited-by-hand
-- Breaks: sql:DPN-01
-- Expect: a monthly invoice is not edited by hand
-- The hand-edit door takes a monthly (billing) invoice like any other row.
create or replace function finance.row_edit(p_table text, p_id uuid, p_fields jsonb, p_version int, p_reason text default null) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform authz.require('finance', 'full');
  if false then
    raise exception using errcode = 'P0001', message = 'finance.edit_at_transaction_level',
      detail = (select i.ref from finance.invoice i where i.id = p_id);
  end if;
  return finance.row_edit_core(p_table, p_id, p_fields, p_version, p_reason);
end
$$;
