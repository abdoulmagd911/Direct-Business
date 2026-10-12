-- QA-541 (V620): a closed month never changes — not its figures, and not whose they are. The close now keeps, for each
-- counted unit, its organisation and whether its channel credits the owner, and a closed month reads both from there: a
-- unit whose invoice was removed after the close still counts for its organisation (its months, credit, sales by code),
-- and an invoice matched to another organisation after the close leaves the closed month where it was. A snapshot
-- taken before this keeps neither, and its units read their own as before. Forward-only.

create or replace view finance.money_row with (security_invoker = true) as
with closed as (
  select c.month from finance.month_close c where c.deleted_at is null
), snap as (
  select c.month, (e ->> 'invoice_id')::uuid as invoice_id, e ->> 'unit_kind' as unit_kind, e ->> 'ref' as ref,
         (e ->> 'revenue')::numeric as revenue, (e ->> 'cost')::numeric as cost, e ->> 'cost_status' as cost_status,
         -- the organisation and the credit owner as the close took them (QA-541); a snapshot taken before they were
         -- kept says neither, and the unit's own are read
         e ? 'partner_id' as kept_who, (e ->> 'partner_id')::uuid as partner_id,
         (e ->> 'channel_credits_owner')::boolean as channel_credits_owner
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
       r.fee_on_monthly_invoice, r.payment_type, r.estimate
from finance.money_row_live r
left join closed cl on cl.month = r.month_on
left join snap s on s.month = r.month_on and s.invoice_id = r.invoice_id and s.unit_kind = r.unit_kind
union all
-- a unit the snapshot counted that is no longer there at all (its invoice removed) still counts in its closed month
select s.invoice_id, s.unit_kind, s.ref, null::text, s.partner_id, null::text, s.month,
       pg_catalog.date_trunc('quarter', s.month::timestamp)::date, null::date, null::date, null::text, s.channel_credits_owner,
       null::text, true, null::boolean, null::boolean, true, null::text, null::text,
       s.revenue, s.cost, s.cost_status, s.cost_status = 'provisional', s.revenue - s.cost, s.revenue - s.cost < 0,
       s.unit_kind = 'monthly_fee', null::text, null::numeric
from snap s
where not exists (select 1 from finance.money_row_live r
                  where r.month_on = s.month and r.invoice_id = s.invoice_id and r.unit_kind = s.unit_kind);

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
                                                                    'cost_status', r.cost_status,
                                                                    'partner_id', r.partner_id,
                                                                    'channel_credits_owner', r.channel_credits_owner)
                                       order by r.ref, r.unit_kind), '[]'::jsonb)
  into snap from finance.money_row_live r where r.counted and r.month_on = m;
  insert into finance.month_close (month, closed_by, snapshot, note, created_by)
  values (m, me, snap, p_note, me) returning id into rid;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', rid, 'month', m, 'units', pg_catalog.jsonb_array_length(snap));
end
$$;
