-- QA-546 (V620, as QA-541): a closed month's figures by segment do not move when an organisation's Client type changes
-- later. The close keeps each unit's segment in its snapshot; Finance lists and every finance measure read a closed
-- month's segment from it, and an open month's from the organisation now. A month closed before this keeps reading
-- its kept organisation's type now, as before. Forward-only.

create or replace view finance.money_row_live with (security_invoker = true) as
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
       u.estimate,
       -- the organisation's Client type (V98), for every Finance filter and figure by segment
       (select t.key from partner.side_type t where t.id = measure.client_segment(u.partner_id)) as segment,
       measure.client_segment(u.partner_id) as segment_id
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
                                                                    'channel_credits_owner', r.channel_credits_owner,
                                                                    'segment_id', r.segment_id)
                                       order by r.ref, r.unit_kind), '[]'::jsonb)
  into snap from finance.money_row_live r where r.counted and r.month_on = m;
  insert into finance.month_close (month, closed_by, snapshot, note, created_by)
  values (m, me, snap, p_note, me) returning id into rid;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', rid, 'month', m, 'units', pg_catalog.jsonb_array_length(snap));
end
$$;

-- A unit's segment in its month: as the close kept it when the month is closed and the snapshot holds it (QA-546),
-- else the organisation's Client type now.
create function measure.unit_segment(p_invoice uuid, p_unit_kind text, p_month date, p_partner uuid) returns uuid
language sql stable security definer set search_path = ''
as $$
  select coalesce((select (e ->> 'segment_id')::uuid
                   from finance.month_close c cross join pg_catalog.jsonb_array_elements(c.snapshot) e
                   where c.deleted_at is null and c.month = pg_catalog.date_trunc('month', p_month::timestamp)::date
                     and e ->> 'invoice_id' = p_invoice::text and e ->> 'unit_kind' = p_unit_kind and e ? 'segment_id'
                   limit 1),
                  measure.client_segment(p_partner))
$$;

revoke all on function measure.unit_segment(uuid, text, date, uuid) from public;

create or replace function measure.finance_scope_units(p_params jsonb, p_scope_kind text, p_scope_id uuid, p_from date, p_to date)
  returns table (invoice_id uuid, unit_kind text, person_id uuid, partner_id uuid, created_on date, month_on date,
                 revenue numeric, profit numeric, cost_final boolean, commission boolean, share numeric)
language plpgsql stable security definer set search_path = ''
as $$
declare
  seg uuid := measure.segment_id(p_params);
begin
  perform measure.check_scope(p_scope_kind);
  if coalesce(p_scope_kind, 'company') in ('company', 'partner') then
    return query
    select r.invoice_id, r.unit_kind, null::uuid, r.partner_id, r.created_on, r.month_on, r.revenue, r.profit,
           not r.provisional, r.commission, 1::numeric
    from finance.money_row r
    where r.counted and r.created_on between p_from and p_to
      and measure.in_scope(p_scope_kind, p_scope_id, null, null, null, r.partner_id)
      and (seg is null or r.segment_id is not distinct from seg);
  else
    return query
    select c.invoice_id, c.unit_kind, c.person_id, r.partner_id, r.created_on, r.month_on, c.revenue, c.profit,
           not r.provisional, r.commission, case when r.revenue = 0 then 0 else c.revenue / r.revenue end
    from finance.credit_row c
    join finance.money_row r on r.invoice_id = c.invoice_id and r.unit_kind = c.unit_kind
    left join core.person p on p.id = c.person_id
    where r.counted and r.created_on between p_from and p_to and c.person_id is not null
      and measure.in_scope(p_scope_kind, p_scope_id, c.person_id, p.team_id, p.department_id, r.partner_id)
      and (seg is null or r.segment_id is not distinct from seg);
  end if;
end
$$;

create or replace function measure.finance_commercial_part(p_invoice uuid, p_unit_kind text, p_partner uuid, p_month date,
                                                p_revenue numeric, p_profit numeric, p_commission boolean,
                                                p_share numeric) returns numeric
language plpgsql stable security definer set search_path = ''
as $$
declare
  d jsonb := coalesce(core.setting_at('finance.revenue_definition', null, p_month), '{}'::jsonb);
  margin boolean := coalesce(d ->> 'basis', 'revenue') = 'margin';
  services text[] := array(select pg_catalog.jsonb_array_elements_text(coalesce(d -> 'services', '[]'::jsonb)));
  types text[] := array(select pg_catalog.jsonb_array_elements_text(coalesce(d -> 'client_types', '[]'::jsonb)));
begin
  if p_commission and not coalesce((d ->> 'commissions')::boolean, true) then
    return null;
  end if;
  if pg_catalog.cardinality(types) > 0
     and not exists (select 1 from partner.side_type t
                     where t.id = measure.unit_segment(p_invoice, p_unit_kind, p_month, p_partner)
                       and t.key = any (types)) then
    return null;
  end if;
  if pg_catalog.cardinality(services) = 0 then
    return case when margin then p_profit else p_revenue end;
  end if;
  return (select coalesce(sum(case when margin then s.revenue - s.cost else s.revenue end), 0) * p_share
          from finance.money_service_row s join finance.service v on v.id = s.service_id
          where s.invoice_id = p_invoice and s.unit_kind = p_unit_kind and s.part = 'service' and v.key = any (services));
end
$$;
