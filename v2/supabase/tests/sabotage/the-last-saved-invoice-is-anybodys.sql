-- Sabotage: the-last-saved-invoice-is-anybodys
-- Breaks: sql:FNC-03
-- Expect: a colleague who has saved none is answered nothing
-- The form reads back the newest invoice recorded here by anybody, not the reader's own.
create or replace function finance.last_saved() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.require('finance', 'full');
begin
  return (
    select pg_catalog.jsonb_build_object(
             'invoice_id', i.id, 'ref', i.ref, 'kind', i.kind, 'status', i.status_raw, 'pay_state', sm.maps_to,
             'created_on', i.created_on, 'paid_on', i.paid_on, 'total_sar', i.total_sar, 'saved_at', i.created_at)
    from finance.invoice i
    left join finance.status_map sm on sm.id = i.status_id
    where i.deleted_at is null and i.source = 'manual' 
    -- two saves in one moment are told apart by the change log's own order
    order by i.created_at desc,
             (select pg_catalog.max(c.id) from audit.change c
              where c.table_name = 'finance.invoice' and c.row_id = i.id and c.action = 'insert') desc nulls last,
             i.id desc
    limit 1);
end
$$;
