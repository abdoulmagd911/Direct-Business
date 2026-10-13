-- Sabotage: a-closed-month-reads-whose-live
-- Breaks: sql:FCL-04
-- Expect: the closed month stays the first organisation's in full
-- A closed month reads each unit's organisation as it is now, so a later match moves the month to another organisation (QA-541, V620).
create or replace view finance.money_row with (security_invoker = true) as
with closed as (
  select c.month from finance.month_close c where c.deleted_at is null
), snap as (
  select c.month, (e ->> 'invoice_id')::uuid as invoice_id, e ->> 'unit_kind' as unit_kind, e ->> 'ref' as ref,
         (e ->> 'revenue')::numeric as revenue, (e ->> 'cost')::numeric as cost, e ->> 'cost_status' as cost_status,
         -- the organisation and the credit owner as the close took them (QA-541); a snapshot taken before they were
         -- kept says neither, and the unit's own are read
         false as kept_who, (e ->> 'partner_id')::uuid as partner_id,
         (e ->> 'channel_credits_owner')::boolean as channel_credits_owner,
         -- the segment as the close took it (QA-546); a snapshot taken before it was kept says none, and the kept
         -- organisation's type is read
         e ? 'segment_id' as kept_segment, (e ->> 'segment_id')::uuid as segment_id
  from finance.month_close c cross join pg_catalog.jsonb_array_elements(c.snapshot) e
  where c.deleted_at is null
)
-- every unit as it stands; in a closed month, counted and valued as the snapshot took it
select r.invoice_id, r.unit_kind, r.ref, r.dpin,
       case when s.kept_who then s.partner_id else r.partner_id end as partner_id,
       r.match_state, r.month_on, r.quarter_on, r.created_on, r.paid_on, r.channel,
       case when s.kept_who then s.channel_credits_owner else r.channel_credits_owner end as channel_credits_owner,
       r.pay_state, r.paid, r.audit_required, r.commission,
       case when cl.month is null then r.counted else s.invoice_id is not null end as counted,
       r.excluded_by, r.excluded_reason,
       case when s.invoice_id is null then r.revenue else s.revenue end as revenue,
       case when s.invoice_id is null then r.cost else s.cost end as cost,
       case when s.invoice_id is null then r.cost_status else s.cost_status end as cost_status,
       case when s.invoice_id is null then r.provisional else s.cost_status = 'provisional' end as provisional,
       case when s.invoice_id is null then r.profit else s.revenue - s.cost end as profit,
       case when s.invoice_id is null then r.loss else s.revenue - s.cost < 0 end as loss,
       r.fee_on_monthly_invoice, r.payment_type, r.estimate,
       (select t.key from partner.side_type t where t.id = g.segment_id) as segment,
       g.segment_id
from finance.money_row_live r
left join closed cl on cl.month = r.month_on
left join snap s on s.month = r.month_on and s.invoice_id = r.invoice_id and s.unit_kind = r.unit_kind
cross join lateral (select case when s.kept_segment then s.segment_id
                                when s.kept_who then measure.client_segment(s.partner_id)
                                else r.segment_id end as segment_id) g
union all
-- a unit the snapshot counted that is no longer there at all (its invoice removed) still counts in its closed month
select s.invoice_id, s.unit_kind, s.ref, null::text, s.partner_id, null::text, s.month,
       pg_catalog.date_trunc('quarter', s.month::timestamp)::date, null::date, null::date, null::text, s.channel_credits_owner,
       null::text, true, null::boolean, null::boolean, true, null::text, null::text,
       s.revenue, s.cost, s.cost_status, s.cost_status = 'provisional', s.revenue - s.cost, s.revenue - s.cost < 0,
       s.unit_kind = 'monthly_fee', null::text, null::numeric,
       (select t.key from partner.side_type t
        where t.id = case when s.kept_segment then s.segment_id else measure.client_segment(s.partner_id) end),
       case when s.kept_segment then s.segment_id else measure.client_segment(s.partner_id) end
from snap s
where not exists (select 1 from finance.money_row_live r
                  where r.month_on = s.month and r.invoice_id = s.invoice_id and r.unit_kind = s.unit_kind);
