-- Sabotage: a-unit-counts-in-its-paid-month
-- Breaks: sql:CNT-01
-- Expect: paid the next month, it counts in its created month (V610)
-- A unit counts in the month it was paid, not the month it was created (V610).
create or replace view finance.invoice_fact with (security_invoker = true) as
select i.id, i.ref, i.kind, i.created_on, coalesce(pg_catalog.date_trunc('month', i.paid_on::timestamp)::date, i.month_on) as month_on, i.paid_on, i.total_sar, i.source, i.payments_as_of,
       i.figure_state, i.code_key,
       s.maps_to as pay_state, coalesce(s.audit_required, false) as audit_required,
       ch.key as channel, coalesce(ch.credits_owner, false) as channel_credits_owner,
       coalesce(ln.line_total, 0) as line_total, coalesce(ln.wallet_sar, 0) as wallet_sar,
       coalesce(pr.commission, false) or coalesce(ln.commission, false) as commission,
       coalesce(ln.all_no_supplier_cost, pr.no_supplier_cost, false) as no_supplier_cost,
       bl.billing_invoice_id,
       ti.dpin, ti.total_sar as dpin_total,
       m.partner_id, m.state as match_state, m.level as match_level
from finance.invoice i
left join finance.status_map s on s.id = i.status_id
left join finance.channel ch on ch.id = i.channel_id
left join finance.product pr on pr.id = i.product_id
left join lateral (
  select sum(l.total_sar) as line_total,
         sum(l.total_sar) filter (where finance.is_wallet_line(l.product_id, l.name)) as wallet_sar,
         bool_or(coalesce(lp.commission, false)
                 or exists (select 1 from finance.commission_word w where w.deleted_at is null and w.active
                            and (pg_catalog.strpos(norm.fold(l.name), norm.fold(w.name_en)) > 0
                                 or pg_catalog.strpos(norm.fold(l.name), norm.fold(w.name_ar)) > 0))) as commission,
         bool_and(coalesce(lp.no_supplier_cost, false)) as all_no_supplier_cost
  from finance.invoice_line l left join finance.product lp on lp.id = l.product_id
  where l.invoice_id = i.id and l.deleted_at is null
) ln on true
left join finance.billing_link bl on bl.transaction_invoice_id = i.id and bl.deleted_at is null
left join finance.tax_invoice ti on ti.parent_invoice_id = i.id and ti.deleted_at is null
left join lateral finance.partner_match(i.id) m on true
where i.deleted_at is null;
