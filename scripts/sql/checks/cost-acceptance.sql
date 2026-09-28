-- READ-ONLY acceptance check for the cost import (D25): 2026 by the paid date (D21 — invoice_date holds it for a paid
-- invoice), paid B2B sales only (money_that_counts: no top-ups, no billing links, no excluded companies such as Takamol).
-- Run after the real Payments exports are imported in the browser. Nothing is written. The oversight's ruling of 28 Sep:
-- the app's own revenue is the reference (its Q3 is right); the cost is checked against the Revenue Report's expense
-- coverage on the references the app counts. The reference figures stay out of this public repository (rule 7).
--   cost_approved   = approved expense lines only (cost_sar)
--   cost_with_est   = approved lines, else the Revenue Report's submitted expenses, else the D23 pass-through lines
--   rev_no_cost     = revenue with neither an approved cost nor an estimate (mostly commissions)
--   rr_invoices / rr_expenses / rr_revenue_covered = the counted invoices the Revenue Report gives an expense figure (> 0)
--                     for, that figure's sum, and their revenue — whatever their approved cost
with m as (
  select c.invoice_date, c.revenue_sar, c.cost_sar, c.est_cost_sar, pf.rr_total_expense_sar as rr
  from public.money_that_counts c
  left join public.finance_payments_facts pf on pf.ref = c.invoice_no
  where c.invoice_date >= date '2026-01-01' and c.invoice_date < date '2027-01-01'
)
select coalesce('Q' || extract(quarter from invoice_date)::int, '2026') as period,
       round(sum(revenue_sar), 0)                                                    as revenue,
       round(sum(cost_sar), 0)                                                       as cost_approved,
       round(sum(coalesce(cost_sar, est_cost_sar)), 0)                               as cost_with_est,
       round(sum(revenue_sar) - sum(coalesce(cost_sar, est_cost_sar)), 0)            as profit_with_est,
       round(100 * (sum(revenue_sar) - sum(coalesce(cost_sar, est_cost_sar))) / nullif(sum(revenue_sar), 0), 1) as margin_pct,
       round(sum(revenue_sar) filter (where cost_sar is null and est_cost_sar is null), 0) as rev_no_cost,
       count(*) filter (where rr > 0)                                                as rr_invoices,
       round(sum(rr) filter (where rr > 0), 0)                                       as rr_expenses,
       round(sum(revenue_sar) filter (where rr > 0), 0)                              as rr_revenue_covered,
       count(*)                                                                      as invoices
from m
group by rollup (extract(quarter from invoice_date))
order by period;
