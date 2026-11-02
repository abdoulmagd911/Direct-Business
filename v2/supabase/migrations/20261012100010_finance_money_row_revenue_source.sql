-- V629 (2), (5): every money row says where it came from — revenue_source, payments or manual — so any view or total
-- can take or leave the manual rows; and a manual row with no cost typed keeps an empty cost, never 0: it adds nothing
-- to Cost, its profit is its revenue, and it stays Provisional until a cost is typed. The column follows QA-546's
-- segment_id. Forward-only.

create or replace view finance.money_row_live with (security_invoker = true) as
with units as (
  select f.id as invoice_id, f.kind as unit_kind, f.ref, f.dpin, f.partner_id, f.match_state, f.month_on, f.created_on,
         f.paid_on, f.channel, f.channel_credits_owner, f.pay_state, f.audit_required, f.commission,
         f.total_sar - f.wallet_sar as revenue,
         -- a manual row with no cost typed has no cost — empty, never 0 (V629 (5))
         case when iv.revenue_source = 'manual'
                   and not exists (select 1 from finance.expense_line e where e.invoice_id = f.id and e.deleted_at is null)
              then null else c.cost_sar end as cost,
         c.cost_status, f.code_key, c.estimate_sar as estimate, iv.revenue_source
  from finance.invoice_fact f join finance.invoice_cost c on c.id = f.id join finance.invoice iv on iv.id = f.id
  union all
  select b.id, 'monthly_fee', b.ref, b.dpin, b.partner_id, b.match_state, b.month_on, b.created_on, b.paid_on, b.channel,
         b.channel_credits_owner, b.pay_state, b.audit_required, false,
         b.total_sar - t.linked_sar, 0::numeric, 'ready', b.code_key, null::numeric, 'payments'
  from finance.invoice_fact b
  join lateral (select sum(x.total_sar) as linked_sar from finance.billing_link l join finance.invoice x on x.id = l.transaction_invoice_id
                where l.billing_invoice_id = b.id and l.deleted_at is null and x.deleted_at is null) t on true
  where b.kind = 'billing' and t.linked_sar is not null and b.total_sar > t.linked_sar
    -- while a person has not ticked or dismissed the proposal for what the links lack, the excess is not a fee: it may
    -- be a transaction already counted on its own (QA-528)
    and not exists (select 1 from finance.billing_proposal p where p.billing_invoice_id = b.id and p.deleted_at is null
                    and p.state = 'open')
)
select u.invoice_id, u.unit_kind, u.ref, u.dpin, u.partner_id, u.match_state, u.month_on,
       pg_catalog.date_trunc('quarter', u.month_on::timestamp)::date as quarter_on, u.created_on, u.paid_on, u.channel,
       u.channel_credits_owner, u.pay_state, u.pay_state = 'paid' as paid, u.audit_required, u.commission,
       u.pay_state = 'paid' and x.id is null as counted,
       x.kind as excluded_by, x.reason as excluded_reason,
       u.revenue, u.cost, u.cost_status, u.cost_status = 'provisional' as provisional,
       u.revenue - coalesce(u.cost, 0) as profit, u.revenue - coalesce(u.cost, 0) < 0 as loss,
       u.unit_kind = 'monthly_fee' as fee_on_monthly_invoice,
       coalesce(pt.subkind, case when u.code_key is not null then 'code' end) as payment_type,
       u.estimate,
       -- the organisation's Client type (V98), for every Finance filter and figure by segment
       (select t.key from partner.side_type t where t.id = measure.client_segment(u.partner_id)) as segment,
       measure.client_segment(u.partner_id) as segment_id,
       u.revenue_source
from units u
left join lateral finance.exclusion_of(u.invoice_id) x on x.id is not null
left join lateral (select d.subkind from finance.invoice i join partner.identifier d
                   on d.deleted_at is null and d.kind = 'payments_client_id' and d.value_key = i.client_id_key
                   where i.id = u.invoice_id limit 1) pt on true
where x.mode is distinct from 'hide';

create or replace view finance.money_row with (security_invoker = true) as
with closed as (
  select c.month from finance.month_close c where c.deleted_at is null
), snap as (
  select c.month, (e ->> 'invoice_id')::uuid as invoice_id, e ->> 'unit_kind' as unit_kind, e ->> 'ref' as ref,
         (e ->> 'revenue')::numeric as revenue, (e ->> 'cost')::numeric as cost, e ->> 'cost_status' as cost_status,
         -- the organisation and the credit owner as the close took them (QA-541); a snapshot taken before they were
         -- kept says neither, and the unit's own are read
         e ? 'partner_id' as kept_who, (e ->> 'partner_id')::uuid as partner_id,
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
       case when s.invoice_id is null then r.profit else s.revenue - coalesce(s.cost, 0) end as profit,
       case when s.invoice_id is null then r.loss else s.revenue - coalesce(s.cost, 0) < 0 end as loss,
       r.fee_on_monthly_invoice, r.payment_type, r.estimate,
       (select t.key from partner.side_type t where t.id = g.segment_id) as segment,
       g.segment_id,
       r.revenue_source
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
       s.revenue, s.cost, s.cost_status, s.cost_status = 'provisional', s.revenue - coalesce(s.cost, 0),
       s.revenue - coalesce(s.cost, 0) < 0,
       s.unit_kind = 'monthly_fee', null::text, null::numeric,
       (select t.key from partner.side_type t
        where t.id = case when s.kept_segment then s.segment_id else measure.client_segment(s.partner_id) end),
       case when s.kept_segment then s.segment_id else measure.client_segment(s.partner_id) end,
       coalesce((select i.revenue_source from finance.invoice i where i.id = s.invoice_id), 'payments')
from snap s
where not exists (select 1 from finance.money_row_live r
                  where r.month_on = s.month and r.invoice_id = s.invoice_id and r.unit_kind = s.unit_kind);
