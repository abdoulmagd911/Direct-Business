-- Sabotage: what-is-owed-ignores-the-receipts
-- Breaks: sql:REC-01
-- Expect: each invoice owes its total less its receipts, due on its own date or the setting's days after issue; fully paid, gathered and draft ones owe nothing here
-- What is owed is the whole total, the receipts allocated to the invoice ignored (V416).
create or replace view finance.receivable with (security_invoker = true) as
with inv as (
  select f.id as invoice_id, f.ref, f.kind, f.partner_id, f.pay_state, f.total_sar,
         coalesce(i.generated_on, i.created_on) as issued_on, i.due_on, i.month_on
  from finance.invoice_fact f
  join finance.invoice i on i.id = f.id
  where f.kind in ('billing', 'standalone', 'transaction') and f.billing_invoice_id is null
    and f.pay_state in ('paid', 'pending') and coalesce(f.total_sar, 0) > 0
    and not exists (select 1 from finance.exclusion_of(f.id) x where x.id is not null)
),
owed as (
  select v.*, coalesce((select sum(r.amount_sar) from finance.receipt r
                        where r.invoice_id = v.invoice_id and r.deleted_at is null), 0) as received,
         coalesce(v.due_on, v.issued_on + coalesce((core.setting_at('finance.collection_due_days', null, v.issued_on) #>> '{}')::int,
                                                   30)) as due_date,
         case when v.due_on is not null then 'own' else 'setting' end as due_basis
  from inv v
)
select o.invoice_id, o.ref, o.kind, o.partner_id, o.month_on, o.issued_on, o.due_date, o.due_basis, o.total_sar,
       o.received, case when o.pay_state = 'paid' then 0 else o.total_sar end as outstanding,
       case when o.pay_state <> 'paid' and o.total_sar > o.received and o.due_date < core.riyadh_today()
            then core.riyadh_today() - o.due_date else 0 end as days_overdue,
       case when o.pay_state = 'paid' or o.total_sar <= o.received then 'settled'
            when o.due_date >= core.riyadh_today() then 'not_due'
            when core.riyadh_today() - o.due_date <= 30 then 'days_1_30'
            when core.riyadh_today() - o.due_date <= 60 then 'days_31_60'
            when core.riyadh_today() - o.due_date <= 90 then 'days_61_90'
            else 'days_over_90' end as bucket
from owed o;
