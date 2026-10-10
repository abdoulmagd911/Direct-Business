-- Sabotage: a-late-payment-is-folded-in-silently
-- Breaks: sql:CNT-04
-- Expect: late-paid, dropped and cost changed, each with its riyals, against the closed month
-- A unit paid after its month closed is not listed as late-paid (V610).
create or replace view finance.late_change with (security_invoker = true) as
with snap as (
  select c.month, (e ->> 'invoice_id')::uuid as invoice_id, e ->> 'unit_kind' as unit_kind, e ->> 'ref' as ref,
         (e ->> 'revenue')::numeric as revenue, (e ->> 'cost')::numeric as cost
  from finance.month_close c cross join pg_catalog.jsonb_array_elements(c.snapshot) e
  where c.deleted_at is null
), now_counted as (
  select r.month_on as month, r.invoice_id, r.unit_kind, r.ref, r.revenue, r.cost from finance.money_row r
  where r.counted and r.month_on in (select c.month from finance.month_close c where c.deleted_at is null)
)
select coalesce(n.month, s.month) as month, coalesce(n.invoice_id, s.invoice_id) as invoice_id,
       coalesce(n.unit_kind, s.unit_kind) as unit_kind, coalesce(n.ref, s.ref) as ref,
       case when s.invoice_id is null then 'late_paid' when n.invoice_id is null then 'dropped' else 'cost_changed' end as change,
       coalesce(n.revenue, 0) - coalesce(s.revenue, 0) as revenue_change,
       coalesce(n.cost, 0) - coalesce(s.cost, 0) as cost_change,
       -- the day of the change: a late payment's paid day; a drop's last change to the invoice; a cost change's last
       -- change to the invoice's expenses
       case when s.invoice_id is null then i.paid_on
            when n.invoice_id is null then (coalesce(i.updated_at, i.created_at) at time zone 'Asia/Riyadh')::date
            else (select (pg_catalog.max(coalesce(e.updated_at, e.created_at)) at time zone 'Asia/Riyadh')::date
                  from finance.expense_line e where e.invoice_id = i.id) end as changed_on
from now_counted n
full join snap s on s.month = n.month and s.invoice_id = n.invoice_id and s.unit_kind = n.unit_kind
left join finance.invoice i on i.id = coalesce(n.invoice_id, s.invoice_id)
where s.invoice_id is not null and (n.invoice_id is null or s.cost is distinct from n.cost);
