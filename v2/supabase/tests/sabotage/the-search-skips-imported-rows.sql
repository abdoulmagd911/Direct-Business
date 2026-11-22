-- Sabotage: the-search-skips-imported-rows
-- Breaks: sql:FNC-02
-- Expect: an imported row that is not paid is found by its number
-- The search by number reads only the invoices recorded here, as before Landing 37.
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
             'customer_name', h.customer_name, 'created_on', h.created_on, 'paid_on', h.paid_on, 'total_sar', h.total_sar,
             'status', h.status, 'pay_state', h.pay_state, 'source', h.source, 'partner_id', h.partner_id)
           order by h.rank, h.created_on desc nulls last, h.ref)
    from (
      select u.* from (
        select i.id, i.kind, i.ref, coalesce(t.dpin, tb.dpin) as dpin, b.ref as billing_ref, i.customer_name, i.created_on, i.paid_on, i.total_sar,
               case when x.r and x.d then 'both' when x.r then 'ref' else 'dpin' end as matched,
               case when x.rk = q or x.dk = q then 0
                    when pg_catalog.left(x.rk, pg_catalog.length(q)) = q or pg_catalog.left(x.dk, pg_catalog.length(q)) = q then 1
                    else 2 end as rank,
               i.status_raw as status, sm.maps_to as pay_state, 'manual'::text as source, null::uuid as partner_id
        from finance.invoice i
        left join finance.status_map sm on sm.id = i.status_id
        left join finance.tax_invoice t on t.parent_invoice_id = i.id and t.deleted_at is null
        left join finance.billing_link bl on bl.transaction_invoice_id = i.id and bl.deleted_at is null
        left join finance.invoice b on b.id = bl.billing_invoice_id and b.deleted_at is null
        left join finance.tax_invoice tb on tb.parent_invoice_id = b.id and tb.deleted_at is null
        cross join lateral (
          select pg_catalog.upper(pg_catalog.regexp_replace(i.ref, '[^[:alnum:]]', '', 'g')) as rk,
                 pg_catalog.upper(pg_catalog.regexp_replace(coalesce(t.dpin, tb.dpin, ''), '[^[:alnum:]]', '', 'g')) as dk) k
        cross join lateral (
          select k.rk, k.dk, pg_catalog.strpos(k.rk, q) > 0 as r, q <> '' and pg_catalog.strpos(k.dk, q) > 0 as d) x
        where i.deleted_at is null and (x.r or x.d)
          -- a hidden row is shown nowhere but the rules (D16, MF5)
          and (finance.exclusion_of(i.id)).mode is distinct from 'hide'
        union all
        -- an imported row, by its transaction number or its invoice number; one recorded here too is listed above
        select r.id, r.mapped_kind, coalesce(r.transaction_ref, r.invoice_ref), null::text,
               case when r.transaction_ref is not null then r.invoice_ref end,
               coalesce(p.trade_name_en, p.trade_name_ar), r.record_date, null::date,
               r.amount_sar, 'ref'::text,
               case when y.tk = q or y.ik = q then 0
                    when pg_catalog.left(y.tk, pg_catalog.length(q)) = q or pg_catalog.left(y.ik, pg_catalog.length(q)) = q then 1
                    else 2 end,
               r.status_text, case when r.fully_paid then 'paid' else 'pending' end, 'import'::text, r.partner_id
        from finance.import_unit r
        left join partner.partner p on p.id = r.partner_id
        cross join lateral (
          select pg_catalog.upper(pg_catalog.regexp_replace(coalesce(r.transaction_ref, ''), '[^[:alnum:]]', '', 'g')) as tk,
                 pg_catalog.upper(pg_catalog.regexp_replace(coalesce(r.invoice_ref, ''), '[^[:alnum:]]', '', 'g')) as ik) y
        where false and r.kind in ('transaction', 'invoice')
          and r.excluded_mode is distinct from 'hide'
          and (pg_catalog.strpos(y.tk, q) > 0 or pg_catalog.strpos(y.ik, q) > 0)
          and not exists (select 1 from finance.invoice i2
                          where i2.deleted_at is null and i2.ref = coalesce(r.transaction_ref, r.invoice_ref))
      ) u
      order by u.rank, u.created_on desc nulls last, u.ref
      limit greatest(1, least(coalesce(p_limit, 20), 100))) h), '[]'::jsonb);
end
$$;
