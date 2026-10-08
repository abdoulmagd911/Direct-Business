-- Sabotage: search-finds-only-the-transaction-number
-- Breaks: sql:FRD-02
-- Expect: a tax invoice number finds its invoice, and the hit shows both numbers apart
-- The Finance search looks at the transaction number only, never the tax invoice number (V617 (3), the screens brief I.5).
create or replace function finance.search_numbers(p_text text, p_limit int default 20) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  q text := pg_catalog.upper(pg_catalog.regexp_replace(coalesce(p_text, ''), '[^[:alnum:]]', '', 'g'));
begin
  perform authz.require('finance', 'view');
  if pg_catalog.length(q) < 2 then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
             'invoice_id', h.id, 'kind', h.kind, 'ref', h.ref, 'dpin', h.dpin, 'billing_ref', h.billing_ref,
             'matched', h.matched,
             'customer_name', h.customer_name, 'created_on', h.created_on, 'paid_on', h.paid_on, 'total_sar', h.total_sar)
           order by h.rank, h.created_on desc, h.ref)
    from (
      select i.id, i.kind, i.ref, coalesce(t.dpin, tb.dpin) as dpin, b.ref as billing_ref, i.customer_name, i.created_on, i.paid_on, i.total_sar,
             case when x.r and x.d then 'both' when x.r then 'ref' else 'dpin' end as matched,
             case when x.rk = q or x.dk = q then 0
                  when pg_catalog.left(x.rk, pg_catalog.length(q)) = q or pg_catalog.left(x.dk, pg_catalog.length(q)) = q then 1
                  else 2 end as rank
      from finance.invoice i
      left join finance.tax_invoice t on t.parent_invoice_id = i.id and t.deleted_at is null
      left join finance.billing_link bl on bl.transaction_invoice_id = i.id and bl.deleted_at is null
      left join finance.invoice b on b.id = bl.billing_invoice_id and b.deleted_at is null
      left join finance.tax_invoice tb on tb.parent_invoice_id = b.id and tb.deleted_at is null
      cross join lateral (
        select pg_catalog.upper(pg_catalog.regexp_replace(i.ref, '[^[:alnum:]]', '', 'g')) as rk,
               pg_catalog.upper(pg_catalog.regexp_replace(coalesce(t.dpin, tb.dpin, ''), '[^[:alnum:]]', '', 'g')) as dk) k
      cross join lateral (
        select k.rk, k.dk, pg_catalog.strpos(k.rk, q) > 0 as r, q <> '' and false as d) x
      where i.deleted_at is null and (x.r or x.d)
      order by rank, i.created_on desc, i.ref
      limit greatest(1, least(coalesce(p_limit, 20), 100))) h), '[]'::jsonb);
end
$$;
