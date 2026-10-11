-- QA-536 (the Architect's ruling of 11 Oct; V620, V610 (4)): a closed month shows its snapshot. Every figure — the
-- period's tiles, the monthly totals, income by service, an organisation's months, sales by code, credit and the finance
-- measures — reads finance.money_row, which now gives, for a closed month, the units the snapshot counted with the
-- revenue and cost it took (a unit paid or changed later is not counted there); an open month is live. What the units
-- are now is finance.money_row_live: the close takes its snapshot from it and finance.late_change compares it with the
-- snapshot, so each later change stays listed beside the month as a dated late change with its riyals. Forward-only.

create view finance.money_row_live with (security_invoker = true) as
with units as (
  select f.id as invoice_id, f.kind as unit_kind, f.ref, f.dpin, f.partner_id, f.match_state, f.month_on, f.created_on,
         f.paid_on, f.channel, f.channel_credits_owner, f.pay_state, f.audit_required, f.commission,
         f.total_sar - f.wallet_sar as revenue, c.cost_sar as cost, c.cost_status, f.code_key, c.estimate_sar as estimate
  from finance.invoice_fact f join finance.invoice_cost c on c.id = f.id
  union all
  select b.id, 'monthly_fee', b.ref, b.dpin, b.partner_id, b.match_state, b.month_on, b.created_on, b.paid_on, b.channel,
         b.channel_credits_owner, b.pay_state, b.audit_required, false,
         b.total_sar - t.linked_sar, 0::numeric, 'ready', b.code_key, null::numeric
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
       u.revenue - u.cost as profit, u.revenue - u.cost < 0 as loss,
       u.unit_kind = 'monthly_fee' as fee_on_monthly_invoice,
       coalesce(pt.subkind, case when u.code_key is not null then 'code' end) as payment_type,
       u.estimate
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
         (e ->> 'revenue')::numeric as revenue, (e ->> 'cost')::numeric as cost, e ->> 'cost_status' as cost_status
  from finance.month_close c cross join pg_catalog.jsonb_array_elements(c.snapshot) e
  where c.deleted_at is null
)
-- every unit as it stands; in a closed month, counted and valued as the snapshot took it
select r.invoice_id, r.unit_kind, r.ref, r.dpin, r.partner_id, r.match_state, r.month_on, r.quarter_on, r.created_on,
       r.paid_on, r.channel, r.channel_credits_owner, r.pay_state, r.paid, r.audit_required, r.commission,
       case when cl.month is null then r.counted else s.invoice_id is not null end as counted,
       r.excluded_by, r.excluded_reason,
       case when s.invoice_id is null then r.revenue else s.revenue end as revenue,
       case when s.invoice_id is null then r.cost else s.cost end as cost,
       case when s.invoice_id is null then r.cost_status else s.cost_status end as cost_status,
       case when s.invoice_id is null then r.provisional else s.cost_status = 'provisional' end as provisional,
       case when s.invoice_id is null then r.profit else s.revenue - s.cost end as profit,
       case when s.invoice_id is null then r.loss else s.revenue - s.cost < 0 end as loss,
       r.fee_on_monthly_invoice, r.payment_type, r.estimate
from finance.money_row_live r
left join closed cl on cl.month = r.month_on
left join snap s on s.month = r.month_on and s.invoice_id = r.invoice_id and s.unit_kind = r.unit_kind
union all
-- a unit the snapshot counted that is no longer there at all (its invoice removed) still counts in its closed month
select s.invoice_id, s.unit_kind, s.ref, null::text, null::uuid, null::text, s.month,
       pg_catalog.date_trunc('quarter', s.month::timestamp)::date, null::date, null::date, null::text, null::boolean,
       null::text, true, null::boolean, null::boolean, true, null::text, null::text,
       s.revenue, s.cost, s.cost_status, s.cost_status = 'provisional', s.revenue - s.cost, s.revenue - s.cost < 0,
       s.unit_kind = 'monthly_fee', null::text, null::numeric
from snap s
where not exists (select 1 from finance.money_row_live r
                  where r.month_on = s.month and r.invoice_id = s.invoice_id and r.unit_kind = s.unit_kind);
comment on view finance.money_row is 'The counted units every figure reads (§3.6, V610, V611, V616): live for an open month; for a closed month counted and valued as its snapshot took them, so its tiles and measures never move (V620, QA-536) — later changes are finance.late_change.';

create or replace function finance.month_close_do(p_month date, p_note text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := authz.require('finance', 'full');
  m date := pg_catalog.date_trunc('month', p_month::timestamp)::date;
  snap jsonb;
  rid uuid;
begin
  if m >= pg_catalog.date_trunc('month', core.riyadh_today()::timestamp)::date then
    raise exception using errcode = 'P0001', message = 'finance.month_not_over', detail = m::text;
  end if;
  if exists (select 1 from finance.month_close c where c.month = m and c.deleted_at is null) then
    raise exception using errcode = 'P0001', message = 'finance.month_closed', detail = m::text;
  end if;
  perform audit.begin('ui', 'finance.month_closed', pg_catalog.jsonb_build_object('month', m), p_note);
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('invoice_id', r.invoice_id, 'unit_kind', r.unit_kind,
                                                                    'ref', r.ref, 'revenue', r.revenue, 'cost', r.cost,
                                                                    'cost_status', r.cost_status)
                                       order by r.ref, r.unit_kind), '[]'::jsonb)
  into snap from finance.money_row_live r where r.counted and r.month_on = m;
  insert into finance.month_close (month, closed_by, snapshot, note, created_by)
  values (m, me, snap, p_note, me) returning id into rid;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', rid, 'month', m, 'units', pg_catalog.jsonb_array_length(snap));
end
$$;

create or replace view finance.late_change with (security_invoker = true) as
with snap as (
  select c.month, (e ->> 'invoice_id')::uuid as invoice_id, e ->> 'unit_kind' as unit_kind, e ->> 'ref' as ref,
         (e ->> 'revenue')::numeric as revenue, (e ->> 'cost')::numeric as cost
  from finance.month_close c cross join pg_catalog.jsonb_array_elements(c.snapshot) e
  where c.deleted_at is null
), now_counted as (
  select r.month_on as month, r.invoice_id, r.unit_kind, r.ref, r.revenue, r.cost from finance.money_row_live r
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
where s.invoice_id is null or n.invoice_id is null or s.revenue is distinct from n.revenue or s.cost is distinct from n.cost;
