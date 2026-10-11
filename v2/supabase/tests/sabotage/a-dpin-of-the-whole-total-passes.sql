-- Sabotage: a-dpin-of-the-whole-total-passes
-- Breaks: sql:CNT-02
-- Expect: the excess is flagged; a DPIN of the whole total says expenses missing, and it came before the units were Ready; the shortfall fails; SA-25's DPIN is 100 off; SA-24 passes
-- A DPIN equal to the whole total on a non-commission unit passes, though its expenses are missing (§3.6).
create or replace view finance.check with (security_invoker = true) as
with parent as (
  select f.id, f.ref, f.kind, f.total_sar, f.dpin, f.dpin_total,
         case when f.kind = 'billing'
              then (select sum(x.total_sar) from finance.billing_link l join finance.invoice x on x.id = l.transaction_invoice_id
                    where l.billing_invoice_id = f.id and l.deleted_at is null and x.deleted_at is null) end as linked_sar,
         (select sum(c.cost_sar) from finance.invoice_cost c
          where c.id = f.id or c.id in (select l.transaction_invoice_id from finance.billing_link l
                                        where l.billing_invoice_id = f.id and l.deleted_at is null)) as approved_sar,
         (select bool_or(c.cost_status <> 'ready') from finance.invoice_cost c
          where c.id = f.id or c.id in (select l.transaction_invoice_id from finance.billing_link l
                                        where l.billing_invoice_id = f.id and l.deleted_at is null)) as any_not_ready,
         (select bool_and(x.commission) from finance.invoice_fact x
          where x.id = f.id or x.billing_invoice_id = f.id) as all_commission
  from finance.invoice_fact f
  where f.kind in ('billing', 'standalone')
)
select p.id as invoice_id, p.ref, x.check_key, x.ok, x.amount_sar
from parent p
cross join lateral (values
  ('billing_has_no_transactions', false, p.total_sar, p.kind = 'billing' and p.linked_sar is null),
  ('fee_on_monthly_invoice', true, p.total_sar - p.linked_sar, p.kind = 'billing' and p.total_sar > p.linked_sar),
  ('billing_short', false, p.linked_sar - p.total_sar, p.kind = 'billing' and p.total_sar < p.linked_sar),
  ('dpin_differs', false, p.dpin_total - (p.total_sar - coalesce(p.approved_sar, 0)),
   p.dpin_total is not null and pg_catalog.abs(p.dpin_total - (p.total_sar - coalesce(p.approved_sar, 0))) > 1
   and not (p.dpin_total = p.total_sar and coalesce(p.approved_sar, 0) = 0)),
  ('expenses_missing', false, p.dpin_total, false and p.dpin_total = p.total_sar
   and coalesce(p.approved_sar, 0) = 0 and not coalesce(p.all_commission, false)),
  ('dpin_before_ready', false, null::numeric, p.dpin is not null and coalesce(p.any_not_ready, false))
) x(check_key, ok, amount_sar, applies)
where x.applies;
