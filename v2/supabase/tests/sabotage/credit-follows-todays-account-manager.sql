-- Sabotage: credit-follows-todays-account-manager
-- Breaks: sql:CNT-03
-- Expect: the account manager on the created date, not today's; the individuals credited to nobody
-- A unit is credited to today's account manager, not the one on its created date (V610).
create or replace view finance.credit_row with (security_invoker = true) as
with who as (
  select r.invoice_id, r.unit_kind, r.ref, r.month_on, r.revenue, r.profit, s.person_id, s.share,
         pg_catalog.row_number() over (partition by r.invoice_id, r.unit_kind order by s.created_at, s.person_id) as k
  from finance.money_row r
  join finance.credit_split s on s.invoice_id = r.invoice_id and s.deleted_at is null
  where r.counted and (r.partner_id is not null or r.channel_credits_owner)
  union all
  select r.invoice_id, r.unit_kind, r.ref, r.month_on, r.revenue, r.profit, o.person_id, 1::numeric, 1
  from finance.money_row r
  left join partner.side_owner o on o.partner_id = r.partner_id and o.side = 'client' and o.deleted_at is null
    and o.effective_from <= core.riyadh_today() and (o.effective_to is null or core.riyadh_today() < o.effective_to)
  where r.counted
    and not exists (select 1 from finance.credit_split s where s.invoice_id = r.invoice_id and s.deleted_at is null
                    and (r.partner_id is not null or r.channel_credits_owner))
)
select w.invoice_id, w.unit_kind, w.ref, w.month_on, w.person_id, w.share, w.person_id is null as uncredited,
       pg_catalog.round(w.revenue * w.share, 2)
         + case when w.k = 1 then w.revenue - sum(pg_catalog.round(w.revenue * w.share, 2)) over (partition by w.invoice_id, w.unit_kind)
                else 0 end as revenue,
       pg_catalog.round(w.profit * w.share, 2)
         + case when w.k = 1 then w.profit - sum(pg_catalog.round(w.profit * w.share, 2)) over (partition by w.invoice_id, w.unit_kind)
                else 0 end as profit
from who w;
