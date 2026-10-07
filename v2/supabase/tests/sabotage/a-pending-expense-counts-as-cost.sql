-- Sabotage: a-pending-expense-counts-as-cost
-- Breaks: sql:CNT-01
-- Expect: every paid unit counts: cost 0 and Provisional with no approved expense, the pending one left out, Ready when done or no supplier cost; the wallet part is not revenue; a published unit and an excluded one do not count
-- A pending expense counts as cost (V611: only approved expenses do).
create or replace view finance.invoice_cost with (security_invoker = true) as
select f.id,
       case when f.no_supplier_cost then 0 else coalesce(e.approved_sar, 0) end as cost_sar,
       coalesce(e.approved_count, 0) as approved_count,
       coalesce(e.pending_count, 0) as pending_count,
       case when f.no_supplier_cost then 'no_supplier_cost'
            when coalesce(e.approved_count, 0) > 0 then 'approved' else 'none' end as cost_basis,
       case when f.no_supplier_cost then 'ready'
            when coalesce(e.pending_count, 0) > 0 or i.expense_status in ('pending', 'under_review') then 'provisional'
            when coalesce(e.approved_count, 0) > 0 or i.expense_status in ('approved', 'issued') then 'ready'
            else 'provisional' end as cost_status
from finance.invoice_fact f
join finance.invoice i on i.id = f.id
left join lateral (
  select sum(x.amount_sar) filter (where x.status in ('approved', 'issued', 'pending', 'under_review')) as approved_sar,
         count(*) filter (where x.status in ('approved', 'issued')) as approved_count,
         count(*) filter (where x.status in ('pending', 'under_review')) as pending_count
  from finance.expense_line x where x.invoice_id = f.id and x.deleted_at is null
) e on true
where f.kind in ('transaction', 'standalone');
