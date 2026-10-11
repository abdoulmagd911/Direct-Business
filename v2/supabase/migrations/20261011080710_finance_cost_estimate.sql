-- The flagged cost estimate (D23, V419, V611; spec §3.6 invoice_cost, item_class). A unit with no approved expense
-- that is not a commission and carries no "no supplier cost" product gets an estimate: the sum of its lines whose
-- last part ("… - 3rd Party Fee") an admin classed pass-through in Settings › Finance (finance.item_class), while the
-- setting finance.cost_estimate is on. It is shown apart and flagged: never in cost, never in profit or margin, and no
-- "profit with estimates" figure exists (V419). An approved expense replaces it. The Revenue Report's submitted total
-- (submitted_estimate) comes with that import. Forward-only.

-- The last part of a line name, folded: "Hotel night - Supplier Fee" → supplier fee (the old app's money_item_key).
create function finance.item_tail(p_name text) returns text
language sql immutable set search_path = ''
as $$
  select norm.fold(pg_catalog.btrim(pg_catalog.regexp_replace(coalesce(p_name, ''), '^.*\s[-–—|]\s', '')))
$$;

create table finance.item_class (
  id uuid primary key default gen_random_uuid(),
  key text not null unique default ('class_' || pg_catalog.replace(gen_random_uuid()::text, '-', ''))
    check (key ~ '^[a-z][a-z0-9_]*$'),
  name_en text not null check (pg_catalog.btrim(name_en) <> '' and pg_catalog.length(name_en) <= 200),
  name_ar text not null check (pg_catalog.btrim(name_ar) <> '' and pg_catalog.length(name_ar) <= 200),
  item_key text generated always as (finance.item_tail(name_en)) stored,
  class text not null check (class in ('pass_through', 'fee')),
  sort int not null default 0, active boolean not null default true,
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text,
  constraint item_class_readable check (finance.item_tail(name_en) is not null)
);
create unique index item_class_one_item on finance.item_class (item_key) where deleted_at is null;
comment on table finance.item_class is 'D23: the last part of a line name → pass_through or fee; the pass-through lines are a unit''s flagged estimate while no expense is approved. Admins keep it in Settings › Finance.';
alter table finance.item_class enable row level security;
select audit.track('finance.item_class'::regclass);
select core.index_foreign_keys('finance');

-- Cost as before, plus the estimate apart (estimate_sar; cost_basis says line_estimate).
create or replace view finance.invoice_cost with (security_invoker = true) as
select f.id,
       case when f.no_supplier_cost then 0 else coalesce(e.approved_sar, 0) end as cost_sar,
       coalesce(e.approved_count, 0) as approved_count,
       coalesce(e.pending_count, 0) as pending_count,
       case when f.no_supplier_cost then 'no_supplier_cost'
            when coalesce(e.approved_count, 0) > 0 then 'approved'
            when f.commission then 'commission'
            when est.sar is not null then 'line_estimate' else 'none' end as cost_basis,
       case when f.no_supplier_cost then 'ready'
            when coalesce(e.pending_count, 0) > 0 or i.expense_status in ('pending', 'under_review') then 'provisional'
            when coalesce(e.approved_count, 0) > 0 or i.expense_status in ('approved', 'issued') then 'ready'
            else 'provisional' end as cost_status,
       est.sar as estimate_sar
from finance.invoice_fact f
join finance.invoice i on i.id = f.id
left join lateral (
  select sum(x.amount_sar) filter (where x.status in ('approved', 'issued')) as approved_sar,
         count(*) filter (where x.status in ('approved', 'issued')) as approved_count,
         count(*) filter (where x.status in ('pending', 'under_review')) as pending_count
  from finance.expense_line x where x.invoice_id = f.id and x.deleted_at is null
) e on true
left join lateral (
  -- the pass-through lines, only while no expense is approved, never for a commission, and only while the setting is on
  select sum(l.total_sar) as sar
  from finance.invoice_line l
  join finance.item_class k on k.item_key = finance.item_tail(l.name) and k.class = 'pass_through' and k.active
    and k.deleted_at is null
  where l.invoice_id = f.id and l.deleted_at is null
    and not f.no_supplier_cost and not f.commission and coalesce(e.approved_count, 0) = 0
    and coalesce((core.setting_at('finance.cost_estimate', null, core.riyadh_today()) #>> '{}')::boolean, true)
) est on true
where f.kind in ('transaction', 'standalone');
comment on view finance.invoice_cost is 'V611: cost = approved expenses, 0 and Provisional while none; Ready when all are approved or no supplier cost applies. D23: the pass-through lines as an estimate apart, never in cost.';

create or replace view finance.money_row with (security_invoker = true) as
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

comment on view finance.money_row is 'One row per revenue unit (§3.6, V610, V611, V616): counted once fully paid, in its created month; cost 0 and Provisional while no expense is approved; a monthly invoice''s excess is a unit of its own; the estimate (D23) apart, never in profit.';

create or replace function finance.period_figures(p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  m0 date := pg_catalog.date_trunc('month', p_from::timestamp)::date;
  m1 date := pg_catalog.date_trunc('month', p_to::timestamp)::date;
begin
  perform authz.require('finance', 'view');
  if p_from is null or p_to is null or p_to < p_from then
    raise exception using errcode = 'P0001', message = 'common.invalid', detail = 'period';
  end if;
  return (
    with r as (select * from finance.money_row x where x.counted and x.month_on between m0 and m1)
    select pg_catalog.jsonb_build_object(
      'from', m0, 'to', m1,
      'units', (select pg_catalog.count(*) from r),
      'revenue', (select coalesce(sum(r.revenue), 0) from r),
      'cost', (select coalesce(sum(r.cost), 0) from r),
      'profit', (select coalesce(sum(r.profit), 0) from r),
      'provisional', pg_catalog.jsonb_build_object(
        'units', (select pg_catalog.count(*) from r where r.provisional),
        'revenue', (select coalesce(sum(r.revenue), 0) from r where r.provisional),
        'cost', (select coalesce(sum(r.cost), 0) from r where r.provisional),
        'profit', (select coalesce(sum(r.profit), 0) from r where r.provisional)),
      'losses', (select pg_catalog.count(*) from r where r.loss),
      'estimate', (select sum(r.estimate) from r where r.estimate is not null),
      'estimated_units', (select pg_catalog.count(*) from r where r.estimate is not null),
      'months', coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(m) order by m.month_on)
                          from finance.money_month m where m.month_on between m0 and m1), '[]'::jsonb))
  );
end
$$;


drop function api.finance_period_units(date, date);
drop function finance.period_units(date, date);
create function finance.period_units(p_from date, p_to date) returns table (
  invoice_id uuid, unit_kind text, ref text, dpin text, month_on date, paid_on date, partner_id uuid, channel text,
  counted boolean, excluded_reason text, revenue numeric, cost numeric, profit numeric, cost_is text, loss boolean,
  estimate numeric)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform authz.require('finance', 'view');
  if p_from is null or p_to is null or p_to < p_from then
    raise exception using errcode = 'P0001', message = 'common.invalid', detail = 'period';
  end if;
  return query
  select r.invoice_id, r.unit_kind, r.ref, coalesce(t.dpin, tb.dpin), r.month_on, r.paid_on, r.partner_id, r.channel, r.counted,
         r.excluded_reason, r.revenue, r.cost, r.profit, finance.cost_word(r.cost_status), r.loss, r.estimate
  from finance.money_row r
  left join finance.tax_invoice t on t.parent_invoice_id = r.invoice_id and t.deleted_at is null
  left join finance.billing_link bl on bl.transaction_invoice_id = r.invoice_id and bl.deleted_at is null
  left join finance.tax_invoice tb on tb.parent_invoice_id = bl.billing_invoice_id and tb.deleted_at is null
  where r.month_on between pg_catalog.date_trunc('month', p_from::timestamp)::date
                       and pg_catalog.date_trunc('month', p_to::timestamp)::date
  order by r.month_on, r.ref, r.unit_kind;
end
$$;

create function api.finance_period_units(p_from date, p_to date) returns table (
  invoice_id uuid, unit_kind text, ref text, dpin text, month_on date, paid_on date, partner_id uuid, channel text,
  counted boolean, excluded_reason text, revenue numeric, cost numeric, profit numeric, cost_is text, loss boolean,
  estimate numeric)
language sql stable security invoker set search_path = ''
as $$ select * from finance.period_units(p_from, p_to) $$;
revoke all on function finance.period_units(date, date) from public;
grant execute on function finance.period_units(date, date) to authenticated;
grant execute on function api.finance_period_units(date, date) to authenticated;

create or replace function finance.health(p_from date default null, p_to date default null) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  m0 date := pg_catalog.date_trunc('month', coalesce(p_from, '2000-01-01')::timestamp)::date;
  m1 date := pg_catalog.date_trunc('month', coalesce(p_to, '2100-12-31')::timestamp)::date;
begin
  perform authz.require('finance', 'view');
  if m1 < m0 then
    raise exception using errcode = 'P0001', message = 'common.invalid', detail = 'period';
  end if;
  return (
    with latest as (
      select distinct on (b.file) b.id, b.file from finance.import_batch b order by b.file, b.export_time desc, b.created_at desc
    ),
    held as (
      select h.reason_key, l.file, h.ref, finance.raw_amount(h.raw) as amount
      from finance.import_held h join latest l on l.id = h.batch_id
      where not h.written
    ),
    u as (select * from finance.money_row r where r.month_on between m0 and m1),
    items as (
      select 'held_' || h.file || '_' || h.reason_key as key, pg_catalog.count(*)::int as n, sum(h.amount) as amount
      from held h where not (h.file = 'expenses' and h.reason_key = 'no_invoice')
      group by h.file, h.reason_key
      union all
      select 'drop_cost_export_again', pg_catalog.count(distinct h.ref)::int, sum(h.amount)
      from held h
      where h.file = 'expenses' and h.reason_key = 'no_invoice'
        and exists (select 1 from finance.invoice i where i.ref = h.ref and i.deleted_at is null)
      union all
      select 'excluded', pg_catalog.count(*)::int, sum(u.revenue) from u where u.excluded_by is not null and u.paid
      union all
      select 'hidden', pg_catalog.count(*)::int, sum(i.total_sar)
      from finance.invoice i cross join lateral finance.exclusion_of(i.id) x
      where i.deleted_at is null and x.mode = 'hide' and i.month_on between m0 and m1
      union all
      select 'no_organisation', pg_catalog.count(*)::int, sum(u.revenue) from u where u.counted and u.match_state = 'none'
      union all
      select 'unknown_client_id', pg_catalog.count(*)::int, sum(u.revenue)
      from u where u.counted and u.match_state = 'unknown_client_id'
      union all
      select 'match_conflict', pg_catalog.count(*)::int, sum(u.revenue) from u where u.counted and u.match_state = 'conflict'
      union all
      select 'provisional', pg_catalog.count(*)::int, sum(u.revenue) from u where u.counted and u.provisional
      union all
      select 'losses', pg_catalog.count(*)::int, sum(u.profit) from u where u.counted and u.loss
      union all
      select 'checks_failed', pg_catalog.count(*)::int, sum(pg_catalog.abs(c.amount_sar))
      from finance.check c join finance.invoice i on i.id = c.invoice_id
      where not c.ok and i.month_on between m0 and m1
      union all
      select 'differences_open', pg_catalog.count(*)::int, null::numeric
      from finance.import_difference d where d.state = 'open' and d.deleted_at is null
      union all
      select 'proposals_open', pg_catalog.count(*)::int, null::numeric
      from finance.billing_proposal p where p.state = 'open' and p.deleted_at is null
      union all
      select 'estimates_in_use', pg_catalog.count(*)::int, sum(u.estimate) from u where u.counted and u.estimate is not null
      union all
      select 'pins_stale', pg_catalog.count(*)::int, sum(i.total_sar)
      from partner.match_pin p
      join finance.invoice i on i.id = p.source_id and i.deleted_at is null
      cross join lateral finance.partner_match_unpinned(i.id) x
      where p.deleted_at is null and x.state = 'matched' and x.partner_id <> p.partner_id and i.month_on between m0 and m1
    )
    select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('key', i.key, 'count', i.n, 'amount_sar', i.amount)
                                         order by i.key) filter (where i.n > 0), '[]'::jsonb)
    from items i
  );
end
$$;


create or replace view finance.partner_month with (security_invoker = true) as
select r.partner_id, r.month_on, pg_catalog.count(*)::int as units, sum(r.revenue) as revenue, sum(r.cost) as cost,
       sum(r.profit) as profit, (pg_catalog.count(*) filter (where r.provisional))::int as provisional_units,
       coalesce(sum(r.revenue) filter (where r.provisional), 0) as provisional_revenue,
       (pg_catalog.count(*) filter (where r.loss))::int as losses,
       sum(r.estimate) as estimate
from finance.money_row r
where r.counted and r.partner_id is not null
group by r.partner_id, r.month_on;

