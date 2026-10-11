-- Sabotage: a-revenue-change-after-the-close-is-silent
-- Breaks: sql:FCL-02
-- Expect: an edit to a closed month's total is listed as a late revenue change, with its riyals and day
-- A closed month lists late payments, drops and cost changes but not a revenue change, so an edited total after the close is never seen (QA-533, V620).
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
       case when s.invoice_id is null then 'late_paid' when n.invoice_id is null then 'dropped'
            when s.revenue is distinct from n.revenue then 'revenue_changed' else 'cost_changed' end as change,
       coalesce(n.revenue, 0) - coalesce(s.revenue, 0) as revenue_change,
       coalesce(n.cost, 0) - coalesce(s.cost, 0) as cost_change,
       -- the day of the change: a late payment's paid day; a drop's last change to the invoice; a revenue change's last
       -- change to the invoice or to its monthly invoice's links; a cost change's last change to the invoice's expenses
       case when s.invoice_id is null then i.paid_on
            when n.invoice_id is null then (coalesce(i.updated_at, i.created_at) at time zone 'Asia/Riyadh')::date
            when s.revenue is distinct from n.revenue then
              (greatest(coalesce(i.updated_at, i.created_at),
                        (select pg_catalog.max(greatest(l.created_at, l.updated_at, l.deleted_at)) from finance.billing_link l
                         where l.billing_invoice_id = i.id)) at time zone 'Asia/Riyadh')::date
            else (select (pg_catalog.max(coalesce(e.updated_at, e.created_at)) at time zone 'Asia/Riyadh')::date
                  from finance.expense_line e where e.invoice_id = i.id) end as changed_on
from now_counted n
full join snap s on s.month = n.month and s.invoice_id = n.invoice_id and s.unit_kind = n.unit_kind
left join finance.invoice i on i.id = coalesce(n.invoice_id, s.invoice_id)
where s.invoice_id is null or n.invoice_id is null or s.cost is distinct from n.cost;
