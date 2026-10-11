-- Sabotage: credit-takes-a-limit-not-yet-in-force
-- Breaks: sql:CRD-01
-- Expect: the limit in force today, not next week's; what is owed against it; over the limit is said
-- The credit line reads a limit whose effective day has not come yet (V70).
create or replace view finance.partner_credit with (security_invoker = true) as
with lim as (
  select distinct on (c.partner_id) c.partner_id, c.amount_sar, c.effective_from, c.approved_by
  from partner.credit_limit c
  where c.deleted_at is null
  order by c.partner_id, c.effective_from desc, c.created_at desc
)
select l.partner_id, l.amount_sar as credit_limit, l.effective_from, l.approved_by,
       coalesce(o.outstanding, 0) as outstanding, l.amount_sar - coalesce(o.outstanding, 0) as available,
       coalesce(o.outstanding, 0) > l.amount_sar as over_limit
from lim l
left join (select r.partner_id, sum(r.outstanding) as outstanding from finance.receivable r
           where r.partner_id is not null group by r.partner_id) o on o.partner_id = l.partner_id;
